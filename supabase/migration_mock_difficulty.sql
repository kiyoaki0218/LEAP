-- ------------------------------------------------------------
-- 模試の難易度つき採点（3PL/EAP）への移行
-- ------------------------------------------------------------
-- 1) mock_exams に question_levels（Part 1..5）を追加
-- 2) mock_ability_deviation() を追加（js/mock-score.js と同じ推定式）
-- 3) get_mock_exam_report() の偏差値をモデル推定に差し替え
--    （question_levels が未設定の回は従来の式にフォールバック）
-- 偏差値は 20〜80 にクリップ。判定はクライアント側で信頼区間の下限を使う。
-- ------------------------------------------------------------

alter table public.mock_exams
  add column if not exists question_levels int[] default '{}'::int[];

-- 難易度（Part）つき答案から 3PL + EAP で偏差値を推定する
-- p(θ) = 0.25 + 0.75 / (1 + exp(-(θ - b)))   b は Part 1..5 → -1.7 / -1.0 / -0.3 / 0.5 / 1.2
-- 事前分布 N(0,1)、θ は -4〜4 を 0.1 刻みで評価（js/mock-score.js と同じ式）
create or replace function public.mock_ability_deviation(
  p_exam public.mock_exams,
  p_answers jsonb
)
returns numeric
language plpgsql
immutable
as $mockdev$
declare
  v_levels int[] := coalesce(p_exam.question_levels, '{}'::int[]);
  v_ids int[] := coalesce(p_exam.question_ids, '{}'::int[]);
  v_b_map float8[] := array[-1.7, -1.0, -0.3, 0.5, 1.2];
  v_b float8[] := '{}';
  v_u boolean[] := '{}';
  v_n int;
  v_i int;
  v_j int;
  v_idx int;
  v_level int;
  v_t float8;
  v_ll float8;
  v_p float8;
  v_w float8;
  v_sum float8 := 0;
  v_sumt float8 := 0;
  v_sumt2 float8 := 0;
  v_mean float8;
begin
  if array_length(v_levels, 1) is null or array_length(v_ids, 1) is null then
    return null;
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return null;
  end if;
  for v_j in 0 .. jsonb_array_length(p_answers) - 1 loop
    v_idx := null;
    select t.ord into v_idx
      from jsonb_array_elements(to_jsonb(v_ids)) with ordinality as t(q, ord)
     where (t.q #>> '{}')::int = (p_answers -> v_j ->> 'id')::int
     limit 1;
    if v_idx is null or v_idx > array_length(v_levels, 1) then
      continue;
    end if;
    v_level := v_levels[v_idx];
    if v_level is null or v_level < 1 or v_level > 5 then
      v_b := v_b || 0::float8;
    else
      v_b := v_b || v_b_map[v_level];
    end if;
    v_u := v_u || coalesce((p_answers -> v_j ->> 'correct')::boolean, false);
  end loop;
  v_n := coalesce(array_length(v_u, 1), 0);
  if v_n = 0 then
    return null;
  end if;
  for v_i in 0 .. 80 loop
    v_t := -4 + v_i * 0.1;
    v_ll := 0;
    for v_j in 1 .. v_n loop
      v_p := 0.25 + 0.75 / (1 + exp(-(v_t - v_b[v_j])));
      v_p := least(1 - 1e-6, greatest(1e-6, v_p));
      if v_u[v_j] then
        v_ll := v_ll + ln(v_p);
      else
        v_ll := v_ll + ln(1 - v_p);
      end if;
    end loop;
    v_w := exp(v_ll - 0.5 * v_t * v_t);
    v_sum := v_sum + v_w;
    v_sumt := v_sumt + v_t * v_w;
    v_sumt2 := v_sumt2 + v_t * v_t * v_w;
  end loop;
  if v_sum <= 0 then
    return null;
  end if;
  v_mean := v_sumt / v_sum;
  return least(80, greatest(20, round((50 + 10 * v_mean)::numeric, 1)));
end;
$mockdev$;

create or replace function public.get_mock_exam_report(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.mock_exams%rowtype;
  v_question_count int := 0;
  v_n int := 0;
  v_n_all int := 0;
  v_n_late int := 0;
  v_mean numeric := 0;
  v_trim_mean numeric := 0;
  v_sd numeric := 0;
  v_p_bar numeric := 0.55;
  v_rates float8[] := '{}';
  v_theory_mean numeric := 0;
  v_sd_theory numeric := 0;
  v_weight numeric := 0;
  v_mu numeric := 0;
  v_sd_floor numeric := 2;
  v_sd_eff numeric := 2;
  v_provisional boolean := true;
  v_my_result public.mock_exam_results%rowtype;
  v_has_result boolean := false;
  v_score numeric := null;
  v_my_total numeric := null;
  v_rank int := null;
  v_percentile numeric := null;
  v_deviation numeric := null;
  v_choices jsonb := '[]'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_all_groups jsonb := '[]'::jsonb;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'exam_not_found');
  end if;

  v_question_count := greatest(coalesce(array_length(v_exam.question_ids, 1), 0), 1);

  select count(*),
         count(*) filter (where not is_late),
         count(*) filter (where is_late)
    into v_n_all, v_n, v_n_late
    from public.mock_exam_results
   where exam_id = p_exam_id;

  -- 理論平均（出題単語の事前正答率の合計＝期待正解数）
  v_rates := coalesce(v_exam.expected_rates, '{}'::float8[]);
  select coalesce(sum(coalesce(v_rates[i], 0.55)), v_question_count * 0.55)
    into v_theory_mean
    from generate_series(1, v_question_count) as g(i);

  v_p_bar := least(0.95, greatest(0.05, v_theory_mean / v_question_count));
  v_sd_theory := sqrt(v_question_count * v_p_bar * (1 - v_p_bar));

  select coalesce(avg(score), 0), coalesce(stddev_samp(score), 0)
    into v_mean, v_sd
    from public.mock_exam_results
   where exam_id = p_exam_id and not is_late;

  -- トリム平均（N>=8 のとき上下10%を除外）
  with ranked as (
    select score,
           row_number() over (order by score, submitted_at) as rn,
           count(*) over () as n
      from public.mock_exam_results
     where exam_id = p_exam_id and not is_late
  )
  select coalesce(avg(score), 0)
    into v_trim_mean
    from ranked
   where n < 8
      or (rn > floor(n * 0.1) and rn <= n - floor(n * 0.1));

  v_weight := v_n::numeric / (v_n + 8);
  v_mu := case when v_n = 0 then v_theory_mean
               else v_weight * v_trim_mean + (1 - v_weight) * v_theory_mean end;

  v_sd_floor := greatest(v_question_count * 0.06, 2.0);
  v_sd_eff := greatest(
    v_weight * v_sd + (1 - v_weight) * v_sd_theory,
    v_sd_floor
  );
  v_sd_eff := least(v_sd_eff, greatest(v_question_count * 0.35, v_sd_floor));

  -- 自分の結果・エントリー
  select * into v_my_result
    from public.mock_exam_results
   where exam_id = p_exam_id and user_id = v_uid;
  v_has_result := found;
  if v_has_result then
    v_score := v_my_result.score;
    v_my_total := greatest(v_my_result.total, 1);
    select count(*) + 1 into v_rank
      from public.mock_exam_results
     where exam_id = p_exam_id and not is_late and score > v_my_result.score;
    select round(100.0 * count(*) / greatest(v_n, 1), 1) into v_percentile
      from public.mock_exam_results
     where exam_id = p_exam_id and not is_late and score <= v_my_result.score;
    v_deviation := public.mock_ability_deviation(v_exam, v_my_result.answers);
    if v_deviation is null then
      v_deviation := 50 + 10 * (v_score - v_mu) / v_sd_eff;
    end if;
    v_deviation := least(80, greatest(20, v_deviation));
  end if;

  select coalesce(choices, '[]'::jsonb) into v_choices
    from public.mock_exam_entries
   where exam_id = p_exam_id and user_id = v_uid;
  if v_choices is null then v_choices := '[]'::jsonb; end if;

  v_provisional := v_n < 5;

  -- 志望校別（大学×文理）集計。母数が少ない場合は tier → category → 全体 へフォールバック
  with my_choices as (
    select (c->>'groupId') as gid,
           coalesce(c->>'groupName', c->>'groupId') as gname,
           coalesce(c->>'tier', '') as tier,
           coalesce(c->>'category', '') as category,
           ord::int as ord
      from jsonb_array_elements(v_choices) with ordinality as t(c, ord)
     where c ? 'groupId'
  ),
  my_groups as (
    select distinct on (gid) gid, gname, tier, category, ord
      from my_choices
     order by gid, ord
  ),
  entry_choices as (
    select e.user_id,
           c->>'groupId' as gid,
           coalesce(c->>'groupName', c->>'groupId') as gname,
           coalesce(c->>'tier', '') as tier,
           coalesce(c->>'category', '') as category
      from public.mock_exam_entries e
      cross join lateral jsonb_array_elements(coalesce(e.choices, '[]'::jsonb)) c
     where e.exam_id = p_exam_id and c ? 'groupId'
  ),
  scored as (
    select r.user_id, r.score, r.total
      from public.mock_exam_results r
     where r.exam_id = p_exam_id and not r.is_late
  ),
  cohorts as (
    select mg.gid, 'group'::text as unit, mg.gname as label, ec.user_id
      from my_groups mg
      join entry_choices ec on ec.gid = mg.gid
    union all
    select mg.gid, 'tier', mg.tier, ec.user_id
      from my_groups mg
      join entry_choices ec on ec.tier = mg.tier and mg.tier <> ''
    union all
    select mg.gid, 'category', mg.category, ec.user_id
      from my_groups mg
      join entry_choices ec on ec.category = mg.category and mg.category <> ''
    union all
    select mg.gid, 'all', '全体', s.user_id
      from my_groups mg cross join scored s
  ),
  cohort_stats as (
    select c.gid, c.unit,
           count(distinct c.user_id)::int as applicants,
           count(distinct s.user_id)::int as scored,
           avg(s.score) as avg_score,
           max(s.score) as top_score,
           count(distinct s.user_id) filter (where s.score > coalesce(v_score, -1)) as better
      from cohorts c
      left join scored s on s.user_id = c.user_id
     group by c.gid, c.unit
  ),
  picked as (
    select mg.ord, mg.gid, mg.gname, mg.tier, mg.category, cs.*
      from my_groups mg
      cross join lateral (
        select cs2.unit, cs2.applicants, cs2.scored, cs2.avg_score, cs2.top_score, cs2.better
          from cohort_stats cs2
         where cs2.gid = mg.gid and (cs2.applicants >= 5 or cs2.unit = 'all')
         order by case cs2.unit when 'group' then 1 when 'tier' then 2 when 'category' then 3 else 4 end
         limit 1
      ) cs
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'groupId', p.gid,
           'groupName', p.gname,
           'tier', p.tier,
           'category', p.category,
           'unit', p.unit,
           'unitLabel', case p.unit
                          when 'group' then '大学×文理：' || p.gname
                          when 'tier' then '同tier志望者群（tier ' || p.tier || '）'
                          when 'category' then p.category || '志望者群'
                          else '全体' end,
           'applicants', p.applicants,
           'scored', p.scored,
           'avgScore', round(p.avg_score::numeric, 1),
           'topScore', p.top_score,
           'myRank', case when v_has_result then (p.better + 1) else null end,
           'percentileWithin', case when v_has_result and p.scored > 0
                                    then round(100.0 * (p.scored - p.better) / p.scored, 1) else null end,
           'provisional', (p.applicants < 5 or v_n < 5)
         ) order by p.ord), '[]'::jsonb)
    into v_groups
    from picked p;

  -- 全大学×文理群の目安一覧（志望者分布）
  with entry_choices as (
    select e.user_id,
           c->>'groupId' as gid,
           coalesce(c->>'groupName', c->>'groupId') as gname,
           coalesce(c->>'tier', '') as tier,
           coalesce(c->>'category', '') as category
      from public.mock_exam_entries e
      cross join lateral jsonb_array_elements(coalesce(e.choices, '[]'::jsonb)) c
     where e.exam_id = p_exam_id and c ? 'groupId'
  ),
  scored as (
    select r.user_id, r.score
      from public.mock_exam_results r
     where r.exam_id = p_exam_id and not r.is_late
  ),
  agg as (
    select ec.gid, max(ec.gname) as gname, max(ec.tier) as tier, max(ec.category) as category,
           count(distinct ec.user_id)::int as applicants,
           round(avg(s.score)::numeric, 1) as avg_score,
           max(s.score) as top_score
      from entry_choices ec
      left join scored s on s.user_id = ec.user_id
     group by ec.gid
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'groupId', a.gid, 'groupName', a.gname, 'tier', a.tier, 'category', a.category,
           'applicants', a.applicants, 'avgScore', a.avg_score, 'topScore', a.top_score,
           'provisional', a.applicants < 5
         ) order by a.applicants desc, a.gid), '[]'::jsonb)
    into v_all_groups
    from agg a;

  return jsonb_build_object(
    'ok', true,
    'exam', jsonb_build_object(
      'id', v_exam.id, 'title', v_exam.title, 'subject', v_exam.subject,
      'range_label', v_exam.range_label, 'question_count', v_question_count,
      'duration_sec', v_exam.duration_sec, 'start_at', v_exam.start_at, 'end_at', v_exam.end_at
    ),
    'stats', jsonb_build_object(
      'n', v_n, 'n_all', v_n_all, 'n_late', v_n_late,
      'mean', round(v_mean, 1),
      'trimmed_mean', round(v_trim_mean, 1),
      'theory_mean', round(v_theory_mean, 1),
      'hybrid_mean', round(v_mu, 1),
      'sd_sample', round(v_sd, 2),
      'sd_effective', round(v_sd_eff, 2),
      'provisional', v_provisional
    ),
    'me', jsonb_build_object(
      'choices', v_choices,
      'result', case when v_has_result then jsonb_build_object(
        'score', v_my_result.score, 'total', v_my_result.total,
        'elapsed_sec', v_my_result.elapsed_sec, 'is_late', v_my_result.is_late,
        'submitted_at', v_my_result.submitted_at, 'answers', v_my_result.answers
      ) else null end,
      'rank', v_rank,
      'percentile', v_percentile,
      'deviation', round(v_deviation, 1),
      'provisional', v_provisional
    ),
    'groups', v_groups,
    'allGroups', v_all_groups
  );
end;
$$;
