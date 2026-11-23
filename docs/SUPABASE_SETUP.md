# Supabase セットアップ手順（Google / LINE ログイン + クラウド同期 + フレンド）

LEAP 4択英単語クイズを、ログイン・端末間同期・相互フレンド対応にするための手順書です。
所要時間の目安は 30〜45 分（Google は 10 分、LINE は 20 分ほど）。

> このアプリは**ビルド不要の静的サイト**です。Supabase のキーは **`supabase_config.js`** に
> 書きます（`index.html` と管理画面 `admin.html` が共有）。anon key は公開前提のキーで、
> データは RLS で保護します。**service_role キーは絶対に貼り付けないでください。**

---

## 0. 全体像

```
ブラウザ（Vercel の静的配信）
   │  Supabase JS v2（CDN）
   ├─ Auth  ── Google OAuth / LINE Login（Custom OAuth Provider）
   └─ Postgres（profiles / friendships / user_progress）＋ RLS
```

| 使うもの | 用途 |
|---|---|
| `profiles` | 表示名・フレンドコード・装着中アバター/称号・一覧用 `quick_stats` |
| `friendships` | 申請（pending）と承認（accepted） |
| `user_progress` | `LEAP_QUIZ_USER_DATA_V3` 相当の JSON、実績、詳細公開フラグ |

設定が空のときは Supabase を初期化せず、従来どおり localStorage だけで動きます。

---

## 1. Supabase プロジェクトを作成

1. https://supabase.com/dashboard にログイン → **New project**。
2. Organization / プロジェクト名（例: `leap-quiz`）/ データベースパスワード / リージョン（`Northeast Asia (Tokyo)` 推奨）を入力。
3. 作成完了まで待つ（1〜2 分）。

### 1-1. スキーマを実行

1. 左メニュー **SQL Editor** → **New query**。
2. リポジトリの `supabase/schema.sql` を全文貼り付けて **Run**。
3. 成功したら **Table Editor** で `profiles` / `friendships` / `user_progress` の 3 テーブルができていることを確認。

`schema.sql` は再実行しても壊れないように書いてあります（`if not exists` / `drop policy if exists`）。
含まれるもの:

- テーブル 3 つ＋ユニーク制約（フレンドコード、双方向の申請重複）
- `updated_at` 自動更新トリガー
- `auth.users` への INSERT でプロフィールと `LEAP-XXXX` コードを自動作成するトリガー
- RLS ポリシー一式（本人のみ書き込み、フレンドは承認済みのみ閲覧）

確認クエリ:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

select policyname, tablename, cmd from pg_policies
where schemaname = 'public' order by tablename, policyname;
```

---

## 2. API キーを取得してアプリに設定

1. **Project Settings（歯車）→ API** を開く。
2. 次の 2 つを控える。
   - **Project URL** … `https://xxxxxxxx.supabase.co`
   - **anon public**（新 UI では **publishable key**）… `sb_publishable_...` または `eyJ...`
3. `supabase_config.js` の設定を書き換える（`index.html` と `admin.html` の両方が読み込む）。

```js
window.LEAP_SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "sb_publishable_xxxxxxxx"
};
```

4. `sw.js` の `CACHE` と `index.html` の `APP_VER` を 1 つ上げてからデプロイ（古いキャッシュ対策）。

> `service_role` / `secret` キーはサーバー専用です。静的サイトには絶対に置かないでください。
> anon key はブラウザに配布される前提で、アクセス制御は RLS が行います。

---

## 3. URL Configuration（全ログイン共通・最重要）

**Authentication → URL Configuration** を開きます。

| 項目 | 設定値 |
|---|---|
| Site URL | `https://<本番ドメイン>`（例: `https://leap-quiz.vercel.app`） |
| Redirect URLs | `https://<本番ドメイン>/**` |
| 追加 | `https://*.vercel.app/**`（Vercel プレビューを使う場合） |
| 追加 | `http://localhost:8000/**` |
| 追加 | `http://127.0.0.1:8000/**` |

アプリは `window.location.origin + window.location.pathname` を `redirectTo` に渡します。
**末尾スラッシュや `www` 有無が変わると一致しない**ため、実際に開く URL を登録してください。

---

## 4. Google ログイン

### 4-1. Google Cloud Console

1. https://console.cloud.google.com/ でプロジェクトを作成（または選択）。
2. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - アプリ名・サポートメール・デベロッパー連絡先を入力
   - Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile` を追加
   - テスト中は **Test users** に自分の Google アカウントを追加（公開するなら Publish）
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**
     - `https://<本番ドメイン>`
     - `http://localhost:8000`
   - **Authorized redirect URIs**
     - `https://<project-ref>.supabase.co/auth/v1/callback`
       （`<project-ref>` は Project URL の `https://` と `.supabase.co` の間）
4. 作成後に表示される **Client ID / Client secret** を控える。

### 4-2. Supabase

1. **Authentication → Sign In / Providers → Google** を開く。
2. Enable を ON。
3. Client ID / Client Secret を貼り付け → Save。
4. 画面に表示される **Callback URL** が 4-1 の redirect URI と一致していることを確認。

---

## 5. LINE ログイン

Supabase に LINE の組み込みプロバイダはありません。**Custom OAuth Provider** として `custom:line` を登録します。
アプリ側はすでに `signInWithOAuth({ provider: "custom:line" })` を呼ぶ実装になっています。

### 5-1. LINE Developers Console

1. https://developers.line.biz/console/ にログイン。
2. **プロバイダー** を作成（例: `LEAP Quiz`）。
3. プロバイダー内で **LINE ログイン** チャネルを作成。
   - チャネル名: `LEAP Quiz`
   - サービスを提供する国: **日本**
   - アプリタイプ: **ウェブアプリ**
4. **チャネル基本設定** で以下を控える。
   - **チャネル ID**（= Client ID）
   - **チャネルシークレット**（= Client secret）
5. **LINE ログイン設定** タブ → **コールバック URL** に Supabase の Callback URL を追加。
   - `https://<project-ref>.supabase.co/auth/v1/callback`
6. （任意）**OpenID Connect → メールアドレス取得** を申請。
   - 承認されると `email` スコープが使えます。未承認でもログインは可能で、メールは空になります（アプリは空でも動作します）。

### 5-2. Supabase にカスタムプロバイダを作成

1. **Authentication → Sign In / Providers → Custom OAuth Providers → New Provider**。
2. **Manual configuration** を選択（OIDC 自動 discovery は使わない）。
3. 以下を入力する。

| 項目 | 値 |
|---|---|
| Identifier | `custom:line` （`custom:` から変更しない） |
| Display name | `LINE` |
| Client ID | LINE のチャネル ID |
| Client Secret | LINE のチャネルシークレット |
| Authorization URL | `https://access.line.me/oauth2/v2.1/authorize` |
| Token URL | `https://api.line.me/oauth2/v2.1/token` |
| UserInfo URL | `https://api.line.me/oauth2/v2.1/userinfo` |
| Scopes | `openid profile`（メール承認済みなら `openid profile email`） |
| Allow users without email | **ON**（LINE はメール未登録ユーザーがいるため） |

4. 画面上部の **Callback URL** をコピーし、5-1-5 のコールバック URL と一致させる。
5. **Create and enable provider**。

> **なぜ OIDC 自動 discovery ではダメか**
> LINE の Web ログインは ID Token を HS256 で署名しますが、Supabase の OIDC 検証は ES256 前提です。
> 自動 discovery だと検証で失敗するため、**Manual（OAuth2）＋ UserInfo URL** で登録します。

### 5-3. 動作確認

1. アプリを開く → **☁️ アカウント・同期** → **💬 LINE でログイン**。
2. LINE の認可画面 → 同意 → アプリに戻り、ホームのバッジが「ログイン中」になれば成功。
3. 失敗時は URL の `error_description` をアプリがダイアログ表示します（`docs/SUPABASE_SETUP.md` を案内）。

---

## 6. 動作確認チェックリスト

### 6-1. 認証・同期

- [ ] 未ログインでも起動してクイズが遊べる（ホームのバッジが「ローカルのみ」/「未ログイン」）
- [ ] Google / LINE でログインでき、`LEAP-XXXX` が表示される
- [ ] `profiles` に自分の行が 1 つだけある
- [ ] クイズ完走後、`user_progress.client_updated_at` が更新される
- [ ] 別ブラウザ（またはシークレットウィンドウ）で同じアカウントにログイン → 進捗が復元される
- [ ] 端末とクラウドの両方にデータがある状態でログイン → 3 択ダイアログが出る
      （「統合」でコイン/EXP が最大値、単語記録が合算される）
- [ ] ショップ購入・装備変更・「今すぐ同期」で `profiles.quick_stats` が更新される

### 6-2. フレンド

2 つのアカウント（例: 通常ウィンドウとシークレット）で確認します。

- [ ] A のコードを B が入力 → 申請（`friendships.status = pending`）
- [ ] A の「申請」タブで承認 → `status = accepted`
- [ ] 一覧カードに Lv・連続日数・マスター率・正答率・実績解放率が出る
- [ ] 詳細シートに Part 別進捗・コレクション・履歴・苦手 TOP10・語源記録が出る
- [ ] 「この苦手単語セットで挑戦」でクイズが始まる
- [ ] A が「集計とバッジのみ」に変更 → B 側で履歴と苦手単語がロック表示になる
- [ ] 解除すると互いの `user_progress` が読めなくなる

### 6-3. セキュリティ（SQL で確認）

```sql
-- 全ユーザーの進捗（anon キーでは自分の分＋承認済みフレンドのみ返る想定）
select user_id, share_detailed_logs, client_updated_at from public.user_progress;

-- 申請・承認の状態
select id, requester_id, addressee_id, status from public.friendships;
```

ブラウザの DevTools → Network で `user_progress` を直接叩き、
他人の `user_id` を指定しても 0 行（または RLS エラー）になることを確認します。

---

## 7. Vercel へのデプロイ

1. リポジトリを Vercel に接続（Framework Preset: **Other**、Build Command なし、Output Directory はルート）。
2. `supabase_config.js` に本番用 URL / anon key が入っていることを確認。
3. デプロイ後、Vercel の本番ドメインを Supabase の **Site URL / Redirect URLs** と
   Google の **Authorized JavaScript origins** に追加。
4. 本番ドメインでログイン → クイズ → リロードして同期を確認。
5. 更新時は `index.html` の `APP_VER` と `sw.js` の `CACHE` を上げる（古い SW キャッシュ対策）。

> ドメインを変えたときは、Supabase・Google・LINE の 3 か所すべての URL を更新してください。

---

## 8. トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `Invalid redirect URL` / ログイン後に元の画面へ戻らない | Supabase の Redirect URLs に実際のオリジン＋パスが無い。`https://ドメイン/**` と `http://localhost:8000/**` を追加 |
| Google: `redirect_uri_mismatch` | Google 側の Authorized redirect URI が `https://<ref>.supabase.co/auth/v1/callback` になっていない |
| Google: `access_blocked` / 403 | OAuth consent screen が Testing のまま。Test users に追加するか Publish |
| LINE ボタンで「provider is not enabled」 | Supabase に `custom:line` が無い/無効。Identifier が `custom:line` か確認 |
| LINE: `invalid redirect_uri` | LINE チャネルのコールバック URL が Supabase の Callback URL と不一致 |
| LINE ログイン後にメールが空 | 仕様（メール取得は申請制）。`Allow users without email` を ON にしていれば問題なし |
| LINE で `invalid id token` / discovery エラー | OIDC 自動 discovery を使っている。Manual 構成に変える（§5-2） |
| ログインできるが進捗が同期されない | `schema.sql` 未実行 / RLS で拒否。`user_progress` の insert/update ポリシーを確認 |
| フレンドの詳細が「まだ同期していません」 | 相手がログインして 1 回も同期していない。相手にクイズ完走か「今すぐ同期」をしてもらう |
| 古い画面・古い進捗が返る | `APP_VER` / `CACHE` を上げて再デプロイ。SW は Supabase をキャッシュしない設定済み |
| 同期が 401 / JWT エラー | セッション切れ。一度ログアウト→再ログイン。時計ずれも確認 |
| 同じ相手と重複申請できない | 仕様（双方向で 1 行のみ）。既存行を承認/削除してから再申請 |

---

## 9. 運用メモ

- **バックアップ**: `user_progress.user_data` は JSON なので、SQL Editor から `copy` や CSV エクスポートで退避できます。
- **パスワード/秘密情報**: Client secret は Supabase と LINE/Google の画面にのみ保存し、リポジトリへコミットしない。
- **退会**: Supabase のユーザー削除で `profiles` / `user_progress` / `friendships` は `on delete cascade` で消えます。
- **無料枠**: Custom OAuth Provider は無料プランで 3 個まで（本アプリは LINE の 1 個）。
- **プライバシー**: `share_detailed_logs = false` の制御はアプリ側表示です。RLS は承認済みフレンドに `user_progress` 全体を許可するため、より強い秘匿が必要なら Supabase の View / RPC に切り出すことを検討してください。
