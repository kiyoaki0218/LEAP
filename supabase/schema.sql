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
