/* Supabase の公開設定
   - anon / publishable key は「公開前提」のキーです（データは RLS で保護）。
   - index.html と admin.html の両方がこのファイルを読みます。
   - 未設定（空文字）でもアプリはローカルモードで動作します。
   - service_role キーは絶対にここへ書かないでください。 */
window.LEAP_SUPABASE_CONFIG = {
  url: "https://eqyksnvfkjgyjutcixqs.supabase.co",
  anonKey: "sb_publishable_ubwPgv7b6RejCSSqRYwamQ_QPSqZ_hp"
};

/* 管理画面の許可リスト（admin_users）に追加する手順:
   1. Supabase Dashboard → Authentication → Users → Add user
      で管理者のメールアドレスとパスワードを作成する
   2. SQL Editor で以下を実行する
        insert into public.admin_users (user_id)
        select id from auth.users where email = 'ここに管理者メール';
   3. admin.html を開き、そのメールアドレスとパスワードでログインする
   ※ パスワードはこのファイルやリポジトリに書かない。 */
