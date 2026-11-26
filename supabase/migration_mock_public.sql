-- ============================================================
-- LEAP: 全国一斉模試をログインなしで受験できるようにする移行 SQL
-- ============================================================
-- 既存プロジェクトの SQL Editor でこれを 1 回実行する（schema.sql 全体の再実行は不要）。
--
-- 追加するのは公開スケジュール RPC のみ:
--   * 開催日時・問題数は anon でも参照できる（模試一覧・カウントダウン用）
--   * question_ids / expected_rates は受験時間枠内だけ返す（開始前のネタバレ防止）
--
-- 受験結果そのものは従来どおりログイン時のみ mock_exam_results に保存する。
-- 未ログインの受験結果は端末内（localStorage: LEAP_MOCK_LOCAL_RESULTS_V1）に保存し、
-- ログイン後に公開側の「全国集計に提出する」から提出できる。
-- ============================================================

create or replace function public.get_mock_exam_schedule()
returns table (
  id uuid,
  title text,
  subject text,
  range_label text,
  question_ids int[],
  expected_rates float8[],
  question_count int,
  start_at timestamptz,
  end_at timestamptz,
  duration_sec int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.title,
    m.subject,
    m.range_label,
    case when now() >= m.start_at and now() <= m.end_at then m.question_ids end,
    case when now() >= m.start_at and now() <= m.end_at then m.expected_rates end,
    coalesce(cardinality(m.question_ids), 0),
    m.start_at,
    m.end_at,
    m.duration_sec
  from public.mock_exams m
  order by m.start_at desc
  limit 30;
$$;

revoke all on function public.get_mock_exam_schedule() from public;
grant execute on function public.get_mock_exam_schedule() to anon, authenticated;

comment on function public.get_mock_exam_schedule() is '模試の公開スケジュール（未ログイン可。問題IDは受験時間内のみ返す）';
