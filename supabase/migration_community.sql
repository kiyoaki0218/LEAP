-- ============================================================
-- LEAP: 意見箱・お知らせ・管理者（Phase 1）追加分のみの移行SQL
-- ------------------------------------------------------------
-- 既存プロジェクト（すでに schema.sql の Phase 1 以前を適用済み）向け。
-- schema.sql 全体を再実行すると既存テーブルのロックを取り、
-- 稼働中のアプリとデッドロックすることがあるため、こちらを使う。
--
-- 実行前にアプリのタブを閉じ、書き込みが止まっている状態で
-- Supabase SQL Editor から実行する。
-- 何度実行しても安全（create ... if not exists / create or replace /
-- drop policy if exists）。
-- ============================================================

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
