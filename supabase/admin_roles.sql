-- ============================================================
-- LEAP 管理者権限の運用（UID 指定で付与・解除）
-- ============================================================
-- 前提: supabase/schema.sql の「9. 管理者許可リスト」を適用済みの環境で実行する。
--
-- 背景:
--   LINE ログイン（custom:line）のユーザーは auth.users.email が NULL になる。
--   そのため従来の
--     insert into public.admin_users (user_id)
--     select id from auth.users where email = '...';
--   では 0 行になり、管理者権限が付かない（＝admin.html で弾かれる）。
--   ここでは UID（uuid）をそのまま受け取って付与する。
--
-- 追加される関数（すべて security definer。実行できるのは authenticated のみ）:
--   admin_list_members(p_search) … ユーザー一覧＋管理者かどうか（管理者だけ）
--   admin_grant(p_user_id, p_note) … UID で管理者を追加（管理者だけ）
--   admin_revoke(p_user_id)       … 管理者権限を解除（管理者だけ／最後の1人は不可）
--   admin_claim_first()           … admin_users が空のときだけ自分を最初の管理者にする
-- ============================================================

-- ------------------------------------------------------------
-- 1. ユーザー一覧（管理者のみ）
--    メールが無い LINE ユーザーも UID・表示名・プロバイダで探せるようにする。
-- ------------------------------------------------------------
create or replace function public.admin_list_members(p_search text default null)
returns table (
  user_id uuid,
  email text,
  display_name text,
  providers text[],
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with needle as (
    select nullif(btrim(coalesce(p_search, '')), '') as q
  )
  select
    u.id,
    u.email,
    nullif(coalesce(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'display_name',
      u.raw_user_meta_data->>'nickname',
      ''
    ), ''),
    coalesce(array_agg(distinct i.provider) filter (where i.provider is not null), '{}'::text[]),
    u.created_at,
    u.last_sign_in_at,
    exists (select 1 from public.admin_users a where a.user_id = u.id)
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  cross join needle n
  where public.is_admin()
    and (
      n.q is null
      or u.id::text ilike '%' || n.q || '%'
      or coalesce(u.email, '') ilike '%' || n.q || '%'
      or coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', '') ilike '%' || n.q || '%'
    )
  group by u.id
  order by exists (select 1 from public.admin_users a where a.user_id = u.id) desc,
           u.created_at desc
  limit 50;
$$;

revoke all on function public.admin_list_members(text) from public;
revoke all on function public.admin_list_members(text) from anon;
grant execute on function public.admin_list_members(text) to authenticated;

comment on function public.admin_list_members(text) is '管理画面用: ユーザー一覧（メール未登録のLINEユーザーを含む）と管理者フラグ';

-- ------------------------------------------------------------
-- 2. 管理者の付与（UID 指定）
-- ------------------------------------------------------------
create or replace function public.admin_grant(p_user_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user not found: %', p_user_id using errcode = '23503';
  end if;

  insert into public.admin_users (user_id, note)
  values (p_user_id, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id) do update
    set note = coalesce(excluded.note, public.admin_users.note);
end;
$$;

revoke all on function public.admin_grant(uuid, text) from public;
revoke all on function public.admin_grant(uuid, text) from anon;
grant execute on function public.admin_grant(uuid, text) to authenticated;

comment on function public.admin_grant(uuid, text) is '管理画面用: UID を指定して管理者権限を付与する';

-- ------------------------------------------------------------
-- 3. 管理者の解除（最後の1人は解除できない）
-- ------------------------------------------------------------
create or replace function public.admin_revoke(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if exists (select 1 from public.admin_users where user_id = p_user_id)
     and (select count(*) from public.admin_users) <= 1 then
    raise exception 'last admin cannot be removed' using errcode = '23514';
  end if;

  delete from public.admin_users where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_revoke(uuid) from public;
revoke all on function public.admin_revoke(uuid) from anon;
grant execute on function public.admin_revoke(uuid) to authenticated;

comment on function public.admin_revoke(uuid) is '管理画面用: 管理者権限を解除する（最後の1人は不可）';

-- ------------------------------------------------------------
-- 4. 最初の1人だけ、ログイン中の本人が管理者になれる
--    （メールでの insert が使えない LINE ユーザー向けのブートストラップ）
-- ------------------------------------------------------------
create or replace function public.admin_claim_first()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- 既に管理者がいる環境では何もしない（横取り防止）
  if exists (select 1 from public.admin_users) then
    return false;
  end if;

  insert into public.admin_users (user_id, note)
  values (auth.uid(), 'first admin (self claim)')
  on conflict (user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.admin_claim_first() from public;
revoke all on function public.admin_claim_first() from anon;
grant execute on function public.admin_claim_first() to authenticated;

comment on function public.admin_claim_first() is 'admin_users が空のときだけ、ログイン中の本人を最初の管理者にする';

-- PostgREST の関数キャッシュを更新
notify pgrst, 'reload schema';
