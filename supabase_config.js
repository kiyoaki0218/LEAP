/* Supabase の公開設定
   - anon / publishable key は「公開前提」のキーです（データは RLS で保護）。
   - index.html と admin.html の両方がこのファイルを読みます。
   - 未設定（空文字）でもアプリはローカルモードで動作します。
   - service_role キーは絶対にここへ書かないでください。 */
window.LEAP_SUPABASE_CONFIG = {
  url: "https://eqyksnvfkjgyjutcixqs.supabase.co",
  anonKey: "sb_publishable_ubwPgv7b6RejCSSqRYwamQ_QPSqZ_hp"
};

/* 管理画面の許可リスト（admin_users）への追加手順:
   1. supabase/admin_roles.sql を SQL Editor で実行する（管理者用の RPC が作成される）
   2. admin.html を開き、メール＋パスワード または LINE でログインする
      - 最初の1人だけは「初回セットアップ: このアカウントを最初の管理者にする」を押す
      - 2人目以降は「👤 管理者」タブで UID・メール・表示名を検索して付与する
   3. LINE ユーザーはメールアドレスを持たない（auth.users.email が NULL）ため、
      メールでの `insert ... where email = ...` では追加できない。UID か管理画面から付与する。
   ※ 管理画面のログイン状態は公開サイトと別（storageKey: leap-admin-auth-v1）。
   ※ パスワードはこのファイルやリポジトリに書かない。 */
