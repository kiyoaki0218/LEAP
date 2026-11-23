-- ============================================================
-- LEAP 4択英単語クイズ — Supabase スキーマ（Auth / Postgres / RLS）
-- ============================================================
-- 実行手順:
--   1. Supabase ダッシュボード → SQL Editor → New query
--   2. このファイル全体を貼り付けて Run（何度実行しても安全なように書いてあります）
--   3. Authentication → Providers → Google を有効化
--   4. Authentication → URL Configuration
--        Site URL:            https://<本番ドメイン>
--        Redirect URLs:       https://<本番ドメイン>/**
--                             http://localhost:8000/**
--   5. Project Settings → API の Project URL / anon (publishable) key を
--      index.html 冒頭の SUPABASE_CONFIG に貼り付ける
--
-- 設計メモ:
--   * profiles / friendships / user_progress の 3 テーブル。
--   * user_progress.user_data は localStorage の LEAP_QUIZ_USER_DATA_V3 と同形の JSON。
--   * achievements は LEAP_ACHIEVEMENTS_V1 と同形の ID 配列。
--   * 進捗の SELECT は本人 + 承認済みフレンドのみ（RLS）。
--   * 詳細ログ（苦手単語・履歴）の表示可否は share_detailed_logs でアプリ側が制御する。
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  friend_code text unique not null,
  display_name text,
  equipped_avatar text,
  equipped_frame text,
  prefix text,
  suffix text,
  quick_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. friendships（pending → accepted の申請・承認制）
-- ------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- 同じ2人の組み合わせ（向きを問わず）は1行だけ
create unique index if not exists friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ------------------------------------------------------------
-- 3. user_progress
-- ------------------------------------------------------------
create table if not exists public.user_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  user_data jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  share_detailed_logs boolean not null default true,
  client_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. 共通: updated_at 自動更新
-- ------------------------------------------------------------
create or replace function public.leap_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.leap_set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.leap_set_updated_at();

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
  before update on public.user_progress
  for each row execute function public.leap_set_updated_at();

-- ------------------------------------------------------------
-- 5. フレンドコード生成 & サインアップ時のプロフィール自動作成
-- ------------------------------------------------------------
create or replace function public.leap_new_friend_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := 'LEAP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.leap_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, friend_code, display_name)
  values (new.id, public.leap_new_friend_code(), coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.leap_handle_new_user();

-- ------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.user_progress enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;

-- profiles: 本人は全操作可。認証済みは検索・一覧のため SELECT 可。
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- friendships: 当事者のみ閲覧可。申請は requester 本人、承認は addressee のみ。
drop policy if exists friendships_select_party on public.friendships;
create policy friendships_select_party
  on public.friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists friendships_update_addressee on public.friendships;
create policy friendships_update_addressee
  on public.friendships for update
  to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

drop policy if exists friendships_delete_party on public.friendships;
create policy friendships_delete_party
  on public.friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- user_progress: 書き込みは本人のみ。閲覧は本人 + 承認済みフレンドのみ。
drop policy if exists user_progress_select_self_or_friend on public.user_progress;
create policy user_progress_select_self_or_friend
  on public.user_progress for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = user_progress.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = user_progress.user_id)
        )
    )
  );

drop policy if exists user_progress_insert_self on public.user_progress;
create policy user_progress_insert_self
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_progress_update_self on public.user_progress;
create policy user_progress_update_self
  on public.user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_progress_delete_self on public.user_progress;
create policy user_progress_delete_self
  on public.user_progress for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 4. 全国一斉模試（全国模試モード）
-- ============================================================
-- 設計メモ:
--   * mock_exams        : 開催回マスタ（問題IDと事前正答率を持つ）
--   * mock_exam_entries : 事前エントリー＋第1〜第5志望。choices は自己記述の jsonb 配列
--                         [{ facultyId, univ, faculty, groupId, groupName, tier, category }, ...]
--                         groupId（大学×文理）と tier/category を各要素に持たせることで、
--                         追加のマスタテーブルなしに「大学×文理」「同tier」「同カテゴリ」で集計できる。
--   * mock_exam_results : 受験結果。(exam_id, user_id) で1人1回。
--   * 集計は security definer の get_mock_exam_report が行う（他ユーザーの生データは公開しない）。
--   * RLS: 模試マスタは認証済みが SELECT 可。エントリーは本人のみ CRUD。
--          結果は本人のみ INSERT / SELECT（UPDATE・DELETE は不可＝記録の改ざん防止）。

create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'leap' check (subject in ('leap', 'kobun')),
  range_label text,
  question_ids int[] not null,
  expected_rates float8[],
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_sec int not null default 1500,
  created_at timestamptz not null default now()
);

create index if not exists mock_exams_schedule_idx on public.mock_exams (start_at, end_at);

alter table public.mock_exams enable row level security;

drop policy if exists mock_exams_select_authenticated on public.mock_exams;
create policy mock_exams_select_authenticated on public.mock_exams
  for select to authenticated using (true);

-- ------------------------------------------------------------
create table if not exists public.mock_exam_entries (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  choices jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint mock_exam_entries_unique unique (exam_id, user_id),
  constraint mock_exam_entries_choices_array check (jsonb_typeof(choices) = 'array')
);

create index if not exists mock_exam_entries_exam_idx on public.mock_exam_entries (exam_id);

alter table public.mock_exam_entries enable row level security;

drop policy if exists mock_exam_entries_select_own on public.mock_exam_entries;
create policy mock_exam_entries_select_own on public.mock_exam_entries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists mock_exam_entries_insert_own on public.mock_exam_entries;
create policy mock_exam_entries_insert_own on public.mock_exam_entries
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists mock_exam_entries_update_own on public.mock_exam_entries;
create policy mock_exam_entries_update_own on public.mock_exam_entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mock_exam_entries_delete_own on public.mock_exam_entries;
create policy mock_exam_entries_delete_own on public.mock_exam_entries
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
create table if not exists public.mock_exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score int not null check (score >= 0),
  total int not null check (total > 0),
  elapsed_sec int not null default 0 check (elapsed_sec >= 0),
  answers jsonb not null default '[]'::jsonb,
  is_late boolean not null default false,
  submitted_at timestamptz not null default now(),
  constraint mock_exam_results_unique unique (exam_id, user_id),
  constraint mock_exam_results_answers_array check (jsonb_typeof(answers) = 'array')
);

create index if not exists mock_exam_results_exam_idx on public.mock_exam_results (exam_id, is_late);

alter table public.mock_exam_results enable row level security;

drop policy if exists mock_exam_results_select_own on public.mock_exam_results;
create policy mock_exam_results_select_own on public.mock_exam_results
  for select to authenticated using (user_id = auth.uid());

drop policy if exists mock_exam_results_insert_own on public.mock_exam_results;
create policy mock_exam_results_insert_own on public.mock_exam_results
  for insert to authenticated with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- 集計 RPC: ハイブリッド偏差値 + 志望校別（大学×文理）集計
-- ------------------------------------------------------------
-- 計算方針（少人数でも極端に振れないようにする）:
--   1) 理論平均 = Σ 事前正答率（未設定項目は 0.55 で補完）
--   2) 標本平均は N>=8 のとき上下10%を除いたトリム平均を使う
--   3) ハイブリッド平均 μ = w*標本平均 + (1-w)*理論平均, w = N/(N+8)
--   4) 標準偏差は 標本SD と 理論SD=√(n·p̄·(1-p̄)) を同じ重みで混ぜ、
--      下限 clip = max(total*0.06, 2.0)、上限 clip = max(total*0.35, 下限) を適用
--   5) 偏差値 = clamp(50 + 10*(score-μ)/SD_eff, 25, 75)
--   6) N < 5 は provisional = true（暫定・参考値）として返す
--   7) 志望校は groupId 単位。母数 < 5 なら 同tier → 同category → 全体 へフォールバック
-- ------------------------------------------------------------
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
    v_deviation := 50 + 10 * (v_score - v_mu) / v_sd_eff;
    v_deviation := least(75, greatest(25, v_deviation));
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

revoke all on function public.get_mock_exam_report(uuid) from public;
grant execute on function public.get_mock_exam_report(uuid) to authenticated;

-- ------------------------------------------------------------
-- 開催回のサンプル（不要なら削除可。日時はインストール時からの相対）
-- ------------------------------------------------------------
insert into public.mock_exams (id, title, subject, range_label, question_ids, expected_rates, start_at, end_at, duration_sec)
values (
  '00000000-0000-4000-8000-000000000001',
  '第1回 全国一斉 LEAP 模試',
  'leap',
  'LEAP Part 1（ID 1〜50）',
  (select array_agg(i order by i) from generate_series(1, 50) as i),
  (select array_agg(round((0.45 + 0.35 * ((i - 1)::numeric / 49))::numeric, 3)::float8 order by i) from generate_series(1, 50) as i),
  now() + interval '1 day',
  now() + interval '14 days',
  1500
)
on conflict (id) do nothing;

-- ============================================================
-- 意見箱・お知らせ・管理画面（Phase 1）
-- ============================================================
-- 管理者は「Supabase Auth でログインできる」だけでは足りず、
-- admin_users に UID が登録されている必要がある。
-- 追加手順:
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = '管理者メールアドレス';
-- ============================================================

-- ------------------------------------------------------------
-- 9. 管理者許可リスト
-- ------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- RLS を有効化し、ポリシーは作らない。
-- （security definer の is_admin() からのみ参照する。anon/authenticated は直接読めない）
alter table public.admin_users enable row level security;

-- 管理者判定。security definer なので RLS を迂回して admin_users を参照できる。
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is '管理者許可リスト admin_users にログイン中ユーザーが含まれるか';

-- ------------------------------------------------------------
-- 10. お知らせ
-- ------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  level text not null default 'info' check (level in ('info', 'warning', 'success')),
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_expires_after_publish
    check (expires_at is null or expires_at > published_at)
);

-- 既存テーブルが古い・不完全な定義で残っている場合の修復（新規作成時は何もしない）
alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists body text;
alter table public.announcements add column if not exists level text not null default 'info';
alter table public.announcements add column if not exists pinned boolean not null default false;
alter table public.announcements add column if not exists published_at timestamptz not null default now();
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists created_by uuid;
alter table public.announcements add column if not exists created_at timestamptz not null default now();
alter table public.announcements add column if not exists updated_at timestamptz not null default now();

create index if not exists announcements_public_idx
  on public.announcements (pinned desc, published_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.leap_set_updated_at();

alter table public.announcements enable row level security;

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
-- Supabase の既定権限に頼らず、anon の書き込みは明示的に塞ぐ
revoke insert, update, delete on public.announcements from anon;

-- 公開側: 公開期間内のものだけ読める（下書き・予約・期限切れは見えない）
drop policy if exists announcements_select_public on public.announcements;
create policy announcements_select_public
  on public.announcements for select
  to anon, authenticated
  using (
    published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- 管理側: 管理者は全件の作成・編集・削除ができる
drop policy if exists announcements_admin_all on public.announcements;
create policy announcements_admin_all
  on public.announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 11. 意見箱
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'other'
    check (category in ('opinion', 'request', 'bug', 'praise', 'other')),
  body text not null check (char_length(body) between 1 and 2000),
  rating smallint check (rating is null or (rating between 1 and 5)),
  page text,
  subject text,
  user_id uuid references auth.users(id) on delete set null,
  contact text,
  client_token uuid,
  status text not null default 'new'
    check (status in ('new', 'reading', 'done', 'archived')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既存テーブルが古い・不完全な定義で残っている場合の修復（新規作成時は何もしない）
alter table public.feedback add column if not exists category text not null default 'other';
alter table public.feedback add column if not exists body text;
alter table public.feedback add column if not exists rating smallint;
alter table public.feedback add column if not exists page text;
alter table public.feedback add column if not exists subject text;
alter table public.feedback add column if not exists user_id uuid;
alter table public.feedback add column if not exists contact text;
alter table public.feedback add column if not exists client_token uuid;
alter table public.feedback add column if not exists status text not null default 'new';
alter table public.feedback add column if not exists admin_note text;
alter table public.feedback add column if not exists created_at timestamptz not null default now();
alter table public.feedback add column if not exists updated_at timestamptz not null default now();

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_token_idx on public.feedback (client_token, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.leap_set_updated_at();

alter table public.feedback enable row level security;

-- 匿名・一般ユーザーには直接 INSERT/SELECT させない（投稿は submit_feedback RPC 経由）
grant select, update on public.feedback to authenticated;
grant insert on public.feedback to authenticated;
-- 匿名はテーブルへ直接アクセスできない（投稿は submit_feedback RPC のみ）
revoke all on public.feedback from anon;

drop policy if exists feedback_admin_select on public.feedback;
create policy feedback_admin_select
  on public.feedback for select
  to authenticated
  using (public.is_admin());

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 管理者が手動で入れる場合のみ（通常の投稿は RPC 経由）
drop policy if exists feedback_admin_insert on public.feedback;
create policy feedback_admin_insert
  on public.feedback for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_admin_delete
  on public.feedback for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 12. 意見の投稿 RPC
--     - anon / authenticated の両方から呼べる
--     - 本文長・評価・種別を検証
--     - ハニーポット（p_honeypot）に値があれば保存せず成功を返す
--     - レート制限: client_token 5件/時、ログイン済みは 10件/時
-- ------------------------------------------------------------
-- 旧シグネチャ（p_rating smallint）が残っている場合の後始末
drop function if exists public.submit_feedback(text, text, smallint, text, text, text, uuid, text);

create or replace function public.submit_feedback(
  p_category text,
  p_body text,
  p_rating integer default null,
  p_page text default '',
  p_subject text default '',
  p_contact text default '',
  p_client_token uuid default null,
  p_honeypot text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_category text := coalesce(nullif(btrim(p_category), ''), 'other');
  v_recent integer;
begin
  -- ボット: 何も保存せず「成功」を返す（相手に検知させない）
  if coalesce(btrim(p_honeypot), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if v_category not in ('opinion', 'request', 'bug', 'praise', 'other') then
    v_category := 'other';
  end if;

  if char_length(v_body) < 1 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  if char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    return jsonb_build_object('ok', false, 'error', 'bad_rating');
  end if;

  if p_client_token is not null then
    select count(*) into v_recent
      from public.feedback f
     where f.client_token = p_client_token
       and f.created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  if v_uid is not null then
    select count(*) into v_recent
      from public.feedback f
     where f.user_id = v_uid
       and f.created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  insert into public.feedback (category, body, rating, page, subject, user_id, contact, client_token)
  values (
    v_category,
    v_body,
    p_rating,
    nullif(left(btrim(coalesce(p_page, '')), 120), ''),
    nullif(left(btrim(coalesce(p_subject, '')), 20), ''),
    v_uid,
    nullif(left(btrim(coalesce(p_contact, '')), 200), ''),
    p_client_token
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_feedback(text, text, integer, text, text, text, uuid, text) from public;
grant execute on function public.submit_feedback(text, text, integer, text, text, text, uuid, text) to anon, authenticated;

comment on function public.submit_feedback(text, text, integer, text, text, text, uuid, text) is '意見箱の投稿（匿名可・レート制限・ハニーポット付き）';
