# LEAP 4択英単語クイズ — サービス全体仕様書

> このファイルは、このサービス（リポジトリ）の**唯一の全体像ドキュメント**です。
> コードを読まなくても「何のサービスで、どんな機能・データ・保存形式があり、どう動くか」が分かるように書いています。
> AI にこのファイルを渡せば、サービス概要の把握・改修方針の検討・データ追加の手順ができることを想定しています。
>
> **更新ルール（重要）**
> 1. 機能追加・仕様変更・データ追加・不具合修正を行ったら、**同じコミット内でこのファイルを更新**する。
> 2. 必ず末尾の「更新履歴」に日付・変更内容を追記する。
> 3. 数値（収録語数・実績数・ショップ点数など）や保存キーを変えた場合は、本文中の該当箇所も直す。
> 4. このルールは `AGENTS.md` にも記載している。

最終更新: 2026-11-28

---

## 0. 30秒サマリ（AI向け）

- **何か**: 大学受験英単語帳「LEAP」の 4択クイズ × ゲーム要素の学習 PWA。加えて「裏世界」ゾーンで古文単語クイズも遊べる。
- **構成**: ビルド不要の**静的サイト**。`index.html` に HTML（マークアップ）とアプリ本体のインライン JS を持ち、基盤 JS は `js/core.js`、全国一斉模試は `js/mock-exam.js`、クラウド同期・フレンドは `js/cloud-sync.js`、出題エンジン（範囲選択・採点・タイマー・到達度テスト・デイリーチャレンジ）は `js/quiz-engine.js`、辞典・実績・ショップは `js/ui-stats-dict.js`、アプリ固有 CSS は `assets/css/app.css`（いずれも外部ファイル）、データは `*_data.js` の JS 定数。
- **バックエンドは任意**: 基本は **localStorage** のみでオフライン動作。`supabase_config.js` に URL / anon key を設定すると **Supabase**（Auth / Postgres / RLS）によるクラウド同期・相互フレンド・お知らせ・意見箱が有効になる。未設定なら従来どおりローカルのみで正常動作する（お知らせは非表示、意見箱は文面コピーのみ）。
- **収録**: 英単語 2,300 語（Part 1〜5）／例文・単語詳細 2,300 語分・例文クイズ 2,000 語分／参考資料 5 章／接辞 32 グループ・132 語根／古文単語 150 語（2 章）・古文詳細 150 語分（例文 354 件）。
- **主な遊び**: 通常4択・例文穴埋め・リスニング4択・スペル入力・60秒スプリント・サドンデス、到達度テスト（50問・25分・S〜D判定）、**全国一斉模試（日時指定の時間割制・ハイブリッド偏差値・志望校判定）**、デイリーチャレンジ、忘却曲線の苦手復習、学習カレンダー/Part別マスター率の振り返り、コイン/EXP/レベル、称号・フレーム・アバター、実績 115 種（進捗バー・「あと少しで解除」付き）、共有URL（挑戦状）、任意ログインによるクラウド同期・相互フレンドの詳細ステータス閲覧。運営向けに **お知らせ**（ホーム表示）と **意見箱**（匿名可）、管理者用の `admin.html`（模試管理・新規模試作成・過去成績集約・お知らせ CRUD・意見トリアージ）を持つ。
- **ホスティング**: 静的ホスティング（Vercel 想定。`vercel.json` なし、`.vercel/` は gitignore）。
- **主要ファイル**: `index.html`（アプリ本体）、`js/core.js`（称号・ゾーン・画面遷移の基盤）、`js/mock-exam.js`（全国一斉模試）、`js/cloud-sync.js`（Supabase 認証・クラウド同期・フレンド）、`js/quiz-engine.js`（出題エンジン・到達度テスト・タイマー）、`js/quiz-resume.js`（つづきからの保存データ）、`js/cloud-merge.js`（苦手単語・克服記録のクラウド統合）、`tests/`（`resume` / `cloud-merge` の単体テスト）、`js/ui-stats-dict.js`（辞典・単語詳細・参考資料・実績・ショップ）、`assets/css/app.css`（アプリ固有 CSS）、`admin.html` ＋ `js/admin.js`（管理者ダッシュボード）、`supabase_config.js`（Supabase 公開設定の共有）、`words_data.js`、`examples_data.js`、`reference_data.js`、`affix_data.js`、`mock_schools_data.js`（模試の志望校マスタ）、`difficulty_data.js`（Part別の難易度）、`updates_data.js`（アプリ内の更新履歴）、`kobun/kobun_words_data.js`、`kobun/kobun_details_data.js`、`sw.js`、`manifest.json`、`supabase/schema.sql`（DB/RLS・模試集計RPC・意見箱RPC）、`supabase/admin_roles.sql`（管理者の一覧・付与・解除RPC）、`supabase/migration_mock_public.sql`（模試の公開スケジュールRPC）、`LEAP単語データ/`・`古文単語データ/`（元データ）、`patches/`（データ生成・一括改修スクリプト）。

---

## 1. サービス概要

| 項目 | 内容 |
|---|---|
| 名称 | LEAP 4択英単語クイズ（PWA 名: LEAP Quiz） |
| 目的 | 大学受験用英単語帳「LEAP」の語義を、4択クイズで素早く・反復して覚える |
| 対象 | 高校生・受験生（スマホ利用が主。ホーム画面に追加してアプリ風に使う） |
| 言語 | UI は日本語。学習対象は英単語（＋古文単語） |
| 課金 | なし。コインは学習で貯まるゲーム内通貨のみ |
| アカウント | 任意（Google OAuth / Supabase）。未ログインでも全機能をプレイ可能 |
| 端末間同期 | ログイン時のみ Supabase 経由で同期（未ログインは localStorage のみ） |
| フレンド | ログイン時のみ。フレンドコード検索 → 申請 → 承認で相互フレンド成立 |
| オフライン | Service Worker により、初回読み込み後はオフライン起動可（Supabase 通信は対象外） |
| 公開 | 静的ファイル一式をそのまま配信（ビルド工程なし） |

### コンセプト

「SIMPLE & SPEEDY」。1問あたりの操作を極力少なくし、正解テンポを保ったまま反復量を稼ぐ。
ゲーム的な報酬（コンボ、コイン、レベル、称号、実績）で継続を後押しする。

### 2つのゾーン（subject）

| key | 表示名 | 内容 | Part 定義 |
|---|---|---|---|
| `leap` | LEAP 英単語（表の世界） | 英単語 2,300 語 | Part 1〜5（ID 1〜2300） |
| `kobun` | 🌌 裏世界（古文単語） | 古文単語 150 語（1章・2章） | Part 101〜105（ID 10001〜10330・うち103〜105は枠のみ） |

- ゾーンはホーム画面上部のトグルで切替。選択は `LEAP_SUBJECT_V1` に保存。
- **進捗データは共通の `userData` に入るが、単語 ID 空間を分けている**（英単語 1〜2300 / 古文 10001〜）ため、学習履歴・苦手・辞典・実績が混ざらない。
- 古文ゾーンで使える出題スタイルは「通常4択」と「📝 例文（古典の例文の空所補充）」の2つ。読み上げは日本語（`ja-JP`）。
- 古文の追加構想・設計メモは `docs/古文単語330_追加構想.md`（5章330語構想。現状は2章150語を実装済み）。

---

## 2. 技術構成

| 層 | 採用技術 | 備考 |
|---|---|---|
| マークアップ | 単一 `index.html` | 画面（section）＋モーダル＋アプリ本体のインライン JS。基盤 JS と CSS は外部ファイル |
| スタイル | Tailwind CSS（CDN: `cdn.tailwindcss.com`）＋ `assets/css/app.css` | 旧インライン `<style>` を分離（結果カード画像の専用スタイルもここ）。ダークモードは `html.dark` / `data-theme="dark"` の CSS 上書き |
| フォント | Google Fonts（Inter / Noto Sans JP） | |
| 画像生成 | html2canvas 1.4.1（CDN） | 結果カードのスクリーンショット保存（`#result-share-card` を撮影） |
| 音声 | Web Speech API（`speechSynthesis`） | 英単語は `en-US`、古文は `ja-JP` |
| 永続化 | localStorage（＋任意で Supabase） | キー一覧は §11 |
| クラウド（任意） | Supabase JS v2（CDN） / Postgres / Auth / RLS | `supabase_config.js` が未設定なら初期化しない。anon / publishable key のみ使用（service_role は使わない） |
| 管理画面 | `admin.html` ＋ `js/admin.js`（別ページ・`noindex`） | Supabase Auth ＋ `admin_users` 許可リスト。`admin.html` と `js/admin.js` は SW のキャッシュ対象外（Network-First）。`js/admin.js` は `?v=` 付きで読み込む |
| オフライン | `sw.js`（Cache API） | キャッシュ名 `leap-v59`、Network-First。Supabase・認証コールバック・`admin.html`・`js/admin.js` は Network-Only |
| PWA | `manifest.json`、アイコン各種 | standalone 表示、theme `#059669` |
| ビルド | なし | `.js` データは `<script>` で直接読む |

### キャッシュ更新の仕組み

- `index.html` 冒頭の `APP_VER`（現在 `leap-v33-mobile-header`）が `localStorage.LEAP_APP_CACHE_VER` と違えば、全 Cache を削除。
- `sw.js` は `install` で `skipWaiting()`、`activate` で旧キャッシュ削除＋`clients.claim()`。
- 新しい Service Worker が `installed` になったときは**勝手にリロードせず**、画面下に「✨ 新しいバージョンがあります / 更新する」バナー（`#app-update-banner`、`showAppUpdateBanner` / `applyAppUpdate`）を出す。
- 取得は Network-First（HTML は常に最新、オフライン時のみキャッシュ）。
- **フロントを更新したら `sw.js` の `CACHE` 名と `index.html` の `APP_VER` を上げる**のが運用ルール。

### 画面（section）一覧

`SCREENS` 配列で管理し、`navigate(id)` で切替（ブラウザ戻る/進むにも対応）。

| id | 画面 | 役割 |
|---|---|---|
| `screen-home` | ホーム | ゾーン切替、お知らせ（模試のお知らせは模試ページへの直リンク付き）、次回模試バナー（開催中は残り時間）、はじめてガイド（学習履歴ゼロの人だけ）、クイズ／デイリーの主導線、プレイヤーカード、連続学習、苦手バナー、**常時表示の準メニュー**（3列のコンパクトタイル＝到達度テスト・模試・学習記録・語源ラッシュ・ショップ・実績、3列のツール＝辞典・ご意見・設定、その下にアップデート情報）、今日の目標リング（`DAILY_GOAL_COUNT`=20問／日、`dailyLog` で進捗、達成でトースト）、つづきからバナー（`LEAP_QUIZ_RESUME_V1`）、前回の到達度テストカード（`examHistory`）、最近の学習履歴 |
| `screen-select` | 出題範囲＆設定 | スタイル／ゲームモード／Part・カスタム範囲／出題数／学習状況フィルタ |
| `screen-quiz` | クイズ | 問題カード、4択、タイマー、コンボ、次へ |
| `screen-result` | 結果 | スコア、正答率、間違い一覧、共有・画像保存・再挑戦 |
| `screen-shop` | ショップ | 前称号／後称号／フレーム／アバターの購入・装着 |
| `screen-social` | ☁️ アカウント・同期 | Google ログイン、フレンドコード、申請一覧、公開範囲設定、手動同期 |
| `screen-dictionary` | 単語辞典 | 検索・Part/ID範囲/学習状況フィルタ・ページ送り・単語詳細・本誌ビュー（見開き） |
| `screen-reference` | 参考資料 | 語源・接頭辞・接尾辞・発音・英作文の解説と確認クイズ |
| `screen-affix` | 語源ラッシュ ハブ | ラッシュ／神経衰弱への入口、ベスト記録 |
| `screen-affix-rush` | 語源ラッシュ | 60秒・接辞の4択ラッシュ |
| `screen-affix-memory` | 接辞神経衰弱 | カードめくりで語根と意味を一致させる |
| `screen-reader` | レベル別リーダー | 例文から長文を自動生成して読む（**現在 UI 入口なし＝休眠機能**） |
| `screen-exam` | 🎓 到達度テスト | 範囲（全範囲／Part単位）を選んで 50問・25分のテスト。S〜D判定と過去の記録を表示 |
| `screen-stats` | 📊 学習記録 | 直近12週の日別ヒートマップ（学習カレンダー）、連続学習・累計解答・マスター/苦手語数、Part別マスター率 |
| `screen-mock-exam` | 🏫 全国一斉模試 | 開催スケジュール一覧、カウントダウン、志望校（第1〜第5）エントリー、制限時間つき受験、偏差値・順位・志望校判定・全大学×文理群の目安一覧、模試ごとの共有リンク（`?mock=<examId>`）。**受験はログイン不要**（結果は端末保存）、ログイン時に全国集計へ提出。Supabase 未設定でもオフライン練習模試（30問・20分）を表示 |

モーダル／ダイアログ: **設定・その他シート（`settings-modal`）**、**使い方ガイド（`guide-modal`）**、**お知らせ一覧（`announcements-modal`）**、**意見箱（`feedback-modal`）**、実績、苦手単語一覧、単語詳細シート、フレンド詳細ステータスシート、結果のフレンド共有シート、初回ログイン時の競合解決ダイアログ、リーダー単語ポップ、確認ダイアログ（`showConfirm`/`showAlert`）、トースト。

画面外のページ: `admin.html`（管理者ダッシュボード。`SCREENS` には含めない独立ページ）。

ホームの副次的な入口（実績・ショップ・アカウント／同期・自分の詳細・音声ON/OFF・追加JSON読込）は「⚙️ 設定」シートに集約している（`openSettingsModal` / `closeSettingsModal`）。各ボタンは既存IDを保つため、バッジやラベルの自動更新はそのまま動作する。

ホームの導線は「主導線を上・副次機能を下」の順に並べる。学習ツール（到達度テスト・模試・学習記録・語源・ショップ・実績）とツール（辞典・ご意見・設定）は **`#home-more-menu` として常時表示**する（以前は「📚 ほかのメニュー」の `<details>` に折りたたんでいたが、ショップなどの準メイン機能が設定経由でしか開けず見つけにくかったため廃止）。ヘッダーのコイン表示（`#header-coins-btn`）もタップでショップへ遷移する。ヘッダーの「?」ボタンと設定シートの「使い方ガイド」から `guide-modal`（3ステップ＋学習状況の見かた＋使える機能＋データ保存の説明）を開ける。`home-onboarding` は `totalQuizzes === 0` かつ `scoreHistory` と `wordStats` が空のときだけ表示し、閉じると `LEAP_ONBOARDING_DISMISSED_V1` に記録して以後は出さない。ガイドの「10問でためす」は先頭100語から10問を学習状況フィルタなしで開始する（`startBeginnerQuiz`）。

模試の共有リンク `?mock=<examId>` で開くと、Supabase クライアントの初期化だけを待ってから該当模試を開く（`checkMockExamLink` → `scheduleLinkedMockExam` → `openLinkedMockExam`）。**ログインは不要**。お知らせの本文かタイトルに「模試」を含む場合、ホームのお知らせ行と一覧モーダルに「模試ページを開く」ボタンが出る（`announcementAction`）。

---

## 3. 学習データ

すべて JS ファイル内の `const` として定義（fetch ではない）。`index.html` の `<head>` で読み込み。

### 3.1 英単語 `words_data.js`

```js
const LEAP_WORDS_DATA = [
  { id: 1, word: "agree", meaning: "賛成する、意見が一致する、(気候・食べ物が)合う", part: 1 },
  ...
];
```

- 収録: **2,300 語**（ID 1〜2300、欠番なし）。
- `meaning` は日本語語義。複数語義は読点・中黒で列挙。
- `part` は 1〜5。

| Part | 範囲 | 語数 | 位置づけ |
|---|---|---|---|
| 1 | 1–400 | 400 | 重要・基礎単語 |
| 2 | 401–1000 | 600 | 標準・頻出単語 |
| 3 | 1001–1400 | 400 | 応用・発展単語 |
| 4 | 1401–2000 | 600 | 最難関・発展単語 |
| 5 | 2001–2300 | 300 | +α 難単語 |

> Part 定義は `index.html` の `LEAP_PARTS`。データに存在する ID 範囲だけが「利用可能 Part」として表示される（`isPartAvailable`）。

### 3.2 単語詳細・例文 `examples_data.js`

2つの定数を持つ。

```js
const LEAP_WORD_DETAILS = {
  "1": {
    id: 1, word: "agree", ipa: "əgríː",
    senses: [{ tag: "自", text: "①賛成する ②…" }],
    senseText: "自：①賛成する ②…",
    posTags: ["vi"],
    notes: ["コラム：…", "頻出：agree with ～ …"],
    examples: [{ en, ja, plain, prompt, answer, hasBlank }]
  }, ...
};

const LEAP_EXAMPLE_DATA = {
  "1": { en: "I agree with you.", ja: "（…）", pos: "vi" }, ...
};
```

- `LEAP_WORD_DETAILS`: **2,300 語分（ID 1〜2300）**。IPA・語義タグ・品詞・コラム/頻出表現・例文。
- `ipa` は **ID で `words_data.js` の単語と対応**する（表示するのは `words_data.js` の `word`、発音記号はこの `ipa`）。この対応は `node patches/build_leap_data.js` が元テキストの見出し番号から決めるため、**元テキストの番号が `words.json` とずれると別単語の発音記号が表示される**（2026-11-28 に 615=obey / 616=resist の入れ替わりを修正済み）。発音記号を直したときは、`words_data.js` の `word` と `examples_data.js` の `word` / `ipa` が同じ単語を指しているかを確認すること。
- 例文付きの詳細: **2,000 語分（ID 1〜2000）**。`examples[].prompt` は空所化済みの問題文、`hasBlank` が true のものを例文クイズに使用。
- `LEAP_EXAMPLE_DATA`: **2,000 語分（ID 1〜2000）**。例文クイズ・品詞バッジ用の軽量データ。
- ID 2001〜2300 は「語義＋詳細（IPA/語義/コラム）」のみで、例文クイズ対象外。

### 3.3 参考資料 `reference_data.js`

```js
const LEAP_REFERENCE_DATA = [
  { title: "第1部", subtitle: "重要な基本動詞（pp.8-21）", words: [...], blocks: [...] },
  ...
];
```

| 章 | 内容 | 形 |
|---|---|---|
| 第1部 | 重要な基本動詞（43語） | `words[]`（IPA・語義・頻出・コラム） |
| 第2部 | 語源の捉え方 | `blocks[]` テキスト |
| 第3部 | ディスコースマーカー一覧 | `blocks[]` |
| 第4部 | 発音・アクセントのルール | `blocks[]` |
| 第5部 | 英作文で役立つ英単語の使い方 20問 | `blocks[]` を ①/② 選択クイズに変換 |

- 第5部は `parseReferenceQuiz()` が `blocks` から問題を抽出し、画面上で ①/② を選ぶと正解が表示される（記録は保存しない）。
- 語源・接辞の「一覧解説」はこの画面、**出題ゲーム**は `affix_data.js` 側。

### 3.4 接辞 `affix_data.js`

```js
const AFFIX_DATA = {
  prefixes: [{ affix: "pre-", meaning: "前に", note: "時間・位置が「前」", roots: [
    { root: "dict", core: "言う", word: "predict", ja: "予測する" }, ...
  ]}, ...],
  suffixes: [ ... ]
};
```

- 接頭辞 **16 グループ**、接尾辞 **16 グループ**、語根合計 **132**。
- 1グループ = 共通の接辞＋語根4〜5個。`core` は語根のコアイメージ。
- 語源ラッシュの4択は「この接辞＋語根でできる単語の意味は？」形式。神経衰弱は語根と意味のペア合わせ。

### 3.5 古文単語 `kobun/kobun_words_data.js`

```js
const KOBUN_WORDS_DATA = [
  { id: 10001, num: 1, word: "おどろく", reading: "おどろく",
    meaning: "（はっと）気づく。、（ふと）目を覚ます。", part: 101, subject: "kobun" },
  ...
];
const KOBUN_PARTS = [
  { id: 101, name: "1章 読解必修語", desc: "読解必修語", start: 10001, end: 10050, numStart: 1, numEnd: 50 },
  { id: 102, name: "2章 入試必修語", desc: "入試必修語", start: 10051, end: 10150, numStart: 51, numEnd: 150 },
  { id: 103, name: "3章 最重要敬語", desc: "最重要敬語", start: 10151, end: 10180, numStart: 151, numEnd: 180 },
  { id: 104, name: "4章 入試重要語", desc: "入試重要語", start: 10181, end: 10280, numStart: 181, numEnd: 280 },
  { id: 105, name: "5章 入試攻略語", desc: "入試攻略語", start: 10281, end: 10330, numStart: 281, numEnd: 330 }
];
```

- 収録: **150 語**（ID 10001〜10150）。`num` は冊子の通し番号。
- ID ルール: `id = 10000 + 冊内番号`。Part は章に対応（現状 101=50語、102=100語）。
- **5章すべてを `KOBUN_PARTS` に定義済み**。データが未投入の 103〜105 章は、出題範囲画面で `isPartAvailable()` が ID 範囲から自動判定し、ロックされたカードに「COMING SOON／今後追加予定」を出す（章の枠だけ先に見せる）。
- 範囲表記は `numStart` / `numEnd`（冊内番号）を使う。未定義でも `id - 10000` で補完する。
- 目標構成は `docs/古文単語330_追加構想.md` の 5章330語（103=敬語30語、104=入試重要100語、105=入試攻略50語）。
- **詳細データ**: `kobun/kobun_details_data.js` の `KOBUN_WORD_DETAILS`（`id` キー）。見出し漢字・活用/品詞・重要度（★1〜3）・コアイメージ・語義（`important` 付き）・解説/入試/関連（`notes[{label,text}]`）・例文（原文・現代語訳・出典・補足・`prompt`/`answer`）を持つ。`js/core.js` の読み込み時に各語の `detail` と `pos` へ紐づける。
- 例文は 150 語すべてに計 354 件。うち見出し語の訳に対応し空所を作れる 326 件を例文クイズに使い、関連語の例文や `【…】` の無い例文は辞典表示のみ（かたち等の 149 語が出題対象）。原文の `【…】` が空所・強調の対象。
- 元データは `古文単語データ/*.txt`（Drive の「古文単語データ」9ファイル）。`node patches/build_kobun_details.js` で再生成する（生成物は手編集しない）。
- `kobun/kobun_config.js` と `kobun/kobun_loader.js` は**未使用の足場**（`KOBUN_CONFIG.enabled = false`、`index.html` から読み込んでいない）。実装済みの統合は `index.html` 内の `SUBJECTS` / `applySubject()` 側。

### 3.6 元データ `LEAP単語データ/`

アプリ用データの生成元。

| ファイル | 内容 |
|---|---|
| `001_101.txt` 〜 `2001_2300.txt`（13ファイル） | 単語番号ごとの語義・IPA・コラム・頻出表現のテキスト |
| `code_artifact.txt` | 参考資料（基本動詞・語源・発音など）の元テキスト |
| `words.json` | 英単語の JSON 版（`LEAP_WORDS_DATA` と同形式） |

---

### 3.7 全国一斉模試の志望校マスタ `mock_schools_data.js`

```js
const MOCK_UNIV_GROUPS = {
  doshisha_bun: { name: "同志社大学（文系）", univ: "同志社大学", tier: 2, category: "関関同立" },
  ...
};
const MOCK_FACULTIES = [
  { id: "doshisha_bun_law", univ: "同志社大学", faculty: "法学部", groupId: "doshisha_bun" },
  ...
];
const MOCK_TIER_LABELS = { 1: "最難関", 2: "難関", 3: "中堅", 4: "チャレンジ" };
```

- **画面では大学＋学部を選ぶ**が、**集計・判定は `groupId`（大学×文理）単位**。
- `tier`（1=最難関 / 2=難関 / 3=中堅 / 4=チャレンジ）と `category`（国公立 / 関関同立 / 産近甲龍 / 早慶 / MARCH など）をグループに持たせ、母数不足時のフォールバック集計に使う。
- 収録: 関西の国公立（京都・大阪・神戸・大阪公立・京都府立・**京都工芸繊維**・滋賀県立・兵庫県立・神戸市外国語・教育大系 ほか）、関関同立、産近甲龍、関西中堅私立（大阪工業・関西医科・大阪医科薬科・武庫川女子・神戸学院・立命館APU ほか）、関東の難関（東京・一橋・東京科学・千葉・横浜国立・金沢・熊本・早慶・上智・MARCH・東京理科・芝浦工業 ほか）。
- 志望校の選択 UI は **検索＋カテゴリ＋難易度（tier）の絞り込み** 付き。絞り込みは `mockSchoolFilter`（画面内の状態）で行い、大学セレクトは該当大学だけ、学部セレクトはその大学の該当学部だけを出す（該当件数を「◯大学・◯学部」と表示、「条件をクリア」で解除）。絞り込みはエントリーの下書きには保存しない。
- 学部を追加するときは `MOCK_FACULTIES` に1行追加（既存 `groupId` を使えば同じ集計単位に入る）。新しい大学×文理を作る場合は `MOCK_UNIV_GROUPS` も追加する。
- `sw.js` の `ASSETS` に含める（キャッシュ更新時は `CACHE` と `APP_VER` も上げる）。

---

## 4. 出題（クイズ）ロジック

### 4.1 範囲の決め方

- **Part から選択**: Part を複数選択（`selectedRange.partIds`）。全選択／全解除あり。
- **カスタム範囲**: 開始 ID・終了 ID を直接入力（`getCustomRangeSelection()`）。ゾーンごとに保存キーが別。
- 出題数: 10 / 20 / 50 / 100 / 全問 / 自由入力（1〜1000）。
- 学習状況フィルタ（複数選択・OR）: `すべて` / `未学習` / `苦手` / `学習中` / `マスター`。各チップには現在の範囲での該当語数を表示する（`updateQuizStatusCounts`）。
- 例文・文脈テストでも同じ `wordStats` を更新するため、学習状況は通常4択と共通。例文モードでは「例文のある語」に絞ったうえで学習状況フィルタを適用し、ヒントに `該当 n 語 / 例文あり m 語` を表示する。

学習状況の判定（`getWordStatus`）:

| 状態 | 条件 |
|---|---|
| 未学習 | `wordStats[id]` が無い、または出題回数 0 |
| 苦手 | 正答率 50% 未満 |
| 学習中 | 正答率 50% 以上 |
| マスター | 正解 3 回以上 かつ 正答率 90% 以上 |

### 4.2 出題スタイル

| スタイル | 内容 | 制約 |
|---|---|---|
| `normal`（通常4択） | 英単語を見て日本語の語義を4択で選ぶ | 選択肢表示前に「自力想起」の待ち時間（`brainFirstDelayMs()`: 通常1200ms / スプリント800ms） |
| `context`（例文・文脈テスト） | 例文の空所に入る語を4択で選ぶ。和訳表示・例文読み上げあり | 英単語ゾーン。古文では同じ `context` を「📝 例文」として使い、古典の例文の空所に入る古語を4択で選ぶ |
| `listening`（リスニング4択） | 見出し語を隠し、音声だけを聞いて日本語の語義を4択で選ぶ。解答後に見出し語・IPAを開示 | 英単語ゾーンのみ（古文は押すと案内を表示）。音声は `voiceEnabled` に関係なく出題時に自動再生（🔊で再再生） |
| `spelling`（スペル入力） | 日本語の語義（＋品詞バッジ）を見て英単語を入力する。大文字・小文字は区別しない | 英単語ゾーンのみ（古文は押すと案内を表示）。選択肢は表示しない |

- 出題スタイルは `LEAP_QUIZ_STYLE_V1` に保存（`normal` / `context` / `listening`。未知の値は `normal` にフォールバック）。
- 古文ゾーンではスタイルボタンの文言を「📝 例文」に切り替える（ボタンの 4 列レイアウトは LEAP と共通）。
- スペル入力では `quiz-spelling-box`（語義＋入力欄＋決定）を表示し、見出し語と選択肢を隠す。採点は `submitSpellingAnswer()` が入力値を突き合わせ、**コイン・EXP・苦手登録・実績・学習状況は4択と同じ `handleAnswer()` に委譲**する（学習記録の整合性を保つため）。解答後は見出し語・IPAを開示し、誤答時は「あなたの解答 / 正解」を表示する。
- **入力補助**: 出題時に `focusSpellingInput()` で入力欄を自動フォーカスし、毎問の「入力欄タップ」を省く（`renderQuestion()` のスペル分岐から `requestAnimationFrame` + 40ms で呼ぶ。スペルボックスの余白をタップしてもフォーカスされる）。端末キーボードはそのまま使う（`lang="en"` / `autocapitalize="off"` / `enterkeyhint="go"`）。スマホではキーボードを英字（ABC）に切り替える必要がある旨を入力欄下に明記する。**アプリ内キーボード（`quiz-spelling-pad`）は 2026-11-28 に廃止**（端末標準キーボードで十分との判断）。出題語の文字数（`n文字`）を入力欄の横に表示する（`#quiz-spelling-length`）。リスニングでも `#quiz-listening-length` に同じ文字数ヒントを出す。


- リスニングでは `quiz-listening-box` を表示し、`quiz-word-row`（見出し語・IPA）を隠す。出題直後に `speakListeningWord()` で再生し、選択肢の自力想起マスクは他スタイルと同じく `brainFirstDelayMs()` だけ待つ。解答後は `revealListeningAnswer()` が見出し語を開示する。
- 例文クイズは `LEAP_WORD_DETAILS` の `examples[].prompt`（空所化済み）を優先。無ければ `LEAP_EXAMPLE_DATA` から `buildCloze()` で空所化。
- 例文があるのは ID 1〜2000。範囲に例文付き単語が無い場合は UI が「例文あり 0 語」と警告。
- **古文の例文クイズ**: `getContextData()` が古文ゾーンでは `w.detail.examples` から「見出し語の訳に対応し空所を作れる例文（`quizEligible` かつ `answer` あり）」をランダムに選び、`prompt`（`【…】` を `[ ____ ]` にした原文）を出題する。選択肢は古語（`optionMode = "word"`）で、各選択肢の下に語義を添える。訳（`【…】` ハイライト）は出題時から表示し、解答後に原文の該当語をハイライト＋出典を開示する。例文が無い語だけ従来の「現代語訳 → 古語」にフォールバックする。読み上げは `ja-JP`。
- 例文モードで正解・不正解した単語も `userData.wordStats[id]` に加算され、辞典・出題絞り込みの学習状況（未学習/苦手/学習中/マスター）に反映される。

### 4.3 ダミー選択肢（`pickDistractorWords`）

- 同じ品詞を優先。
- 苦手単語・つづりが似た語（共通接頭辞長 `sharedPrefixLength`）を混ぜる。
- クイズセット内の他の正解を `blocked` にして「メタ読み」を防止。
- 古文は同じ subject（古文）からダミーを作り、英語が混ざらない。古文の例文クイズでも同じ意味の語をダミーから除外する。

### 4.4 ゲームモード

| モード | key | ルール |
|---|---|---|
| 通常 | `normal` | 時間制限なし。スコアは `100 / 出題数` を1問正解ごとに加算 |
| 60秒スプリント | `sprint` | 60秒開始。5コンボごとに +3秒、誤答で -2秒。1問10点 |
| サドンデス | `sudden` | 1問8秒。誤答または時間切れで即終了。1問10点 |
| 到達度テスト | `exam` | ホーム→`screen-exam`から開始。50問（範囲の語数が少ない場合はその語数）・25分・通常4択固定。S/A/B/C/D判定 |

- 定数: `SPRINT_TOTAL_MS=60000` / `SPRINT_BONUS_MS=3000` / `SPRINT_PENALTY_MS=2000` / `SUDDEN_MS=8000`。
- 選択は `LEAP_GAME_MODE_V1` に保存。
- **忘却曲線復習とデイリーチャレンジは、この設定を引き継がず通常モード・通常4択**で出題。
- 正解後の「次へ」はボタン／画面タップで進行。誤タップ防止に 350ms のクールダウン。

### 4.5 報酬（コイン・EXP・レベル）

1問正解ごと（`handleAnswer`）:

- **コイン**: 基本 +10。コンボ 3 以上 +2（計12）、5 以上 +5（計15）、10 以上 +10（計20）。
- **EXP**: +10（`EXP_PER_CORRECT`）。
- コインと EXP は**1問ごとに即保存**（途中終了でも失わない）。

レベル:

```js
expRequiredForLevel(level) = 100 + (level - 1) * 50
```

- レベル上限 999。`getLevelState(totalExp)` が `{ level, intoLevel, required }` を返す。
- ホーム／ヘッダーに Lv・EXP バー・称号を表示。
- 画面上部の共通ヘッダーは、コイン・実績・ダークモード切替を常に表示する。狭い画面（`sm` 未満）では折り返しを許し、称号チップ（`#header-title`）は省略する（`sm` 以上で表示）。

### 4.6 デイリーチャレンジ

- ホームの「🌟 デイリーチャレンジ」。1日1回、20問、データ全体からランダム範囲。
- その日の初回クリア時のみ**獲得コインが2倍**（`lastDailyDate` で判定、`dailyClears` 加算）。
- クリア済みでも再プレイ可能（ボーナスなし）。

### 4.7 苦手・忘却曲線復習

- 不正解時（`registerWrongAnswer`）: `weakWords[id]` に登録 or リセット。`stage=1`、`nextReview=翌日`。あわせて `source` に直近の誤答元（`quiz` / `mock` / `exam` / `review` / `daily`）を記録し、苦手単語データ帳に「クイズ」「模試」「到達度テスト」などのバッジで表示する（`weakSourceLabel`）。
- 正解して復習を進めると（`stage` アップ）次回間隔: **1日 → 3日 → 7日 → 14日**（`FORGETTING_STAGES`、最大ステージ4）。
- 「本日復習」対象 = `nextReview <= 今日` の苦手単語。
- **克服（ステージ4クリア）** すると `weakWords[id]` を削除し、`graduatedWords[id] = 今日` を記録する。この記録がないと、クラウド統合で他端末の古い `weakWords` から復活してしまう。間違え直すと `graduatedWords[id]` は削除される。
- ホームの苦手バナーから「特訓する」（`startWeakWordsQuiz`）または「一覧」（モーダルで個別削除・ゾーン単位リセット）。
- 復習は**通常モード・通常4択固定**。完了で `reviewClears` 加算。
- **復習の出題プールは `ALL_WORDS` の単語オブジェクトに置き換える**。`weakWords` の保存レコードは `id / word / meaning / 復習状態` だけを持ち、`detail.ipa` や品詞を持たない。以前はこのレコードをそのまま出題していたため、**復習クイズだけ発音記号が出なかった**（`startWeakWordsQuiz` の `canonical()`）。
- 発音記号は `wordIpa(w)` が `detail.ipa` → `w.ipa` → `LEAP_WORD_DETAILS[String(w.id)].ipa` の順で引く。詳細データが未展開の単語（クラウドから復元した苦手など）でも表示できる。苦手単語一覧・結果画面の誤答一覧・模試の弱点分析レポートの誤答一覧にも同じヘルパーで発音記号を表示する。

### 4.8 連続学習（ストリーク）

- `recordPlayDay()` がクイズ完走時に `lastPlayDate` / `streak` を更新（前日なら+1、同日据え置き、途切れで1）。
- ホームに「連続学習 n 日」を表示。

---

### 4.9 到達度テスト（`screen-exam`）

- ホームの「🎓 到達度テスト（50問・25分）」から。`navigate("screen-exam")` で `renderExamScreen()` が描画される。
- **範囲**: 「全範囲」（現在のゾーン全体）または Part 単体（現在のゾーンの有効 Part）。選択は `LEAP_EXAM_RANGE_V1` に保存。
- **出題**: 選んだ範囲からランダムに `EXAM_QUESTION_COUNT = 50` 問（範囲の語数が50未満ならその語数）。スタイルは通常4択固定（リスニング・例文は使わない）、学習状況フィルタは適用しない。
- **制限時間**: `EXAM_TOTAL_MS = 25分`の全体カウントダウン（`startExamClock()`、1秒刻み、延長・誤答ペナルティなし）。0で `finishQuiz(false, "examtime")`。残り時間は既存の `quiz-timer-wrap` に `分:秒` で表示。
- **判定**: 正答率で5段階（`examGradeFor`）。S=95%以上 / A=85%以上 / B=70%以上 / C=55%以上 / D=55%未満。
- **記録**: `userData.examHistory`（最大20件）に `{ id, date, subject, range, correct, total, accuracy, grade, seconds }` を保存。中断時は保存しない（コイン・EXPの獲得分は残る）。
- 結果画面の `result-exam-banner` に判定・範囲・前回比を表示。再挑戦は `retryCurrentQuiz()` が到達度テストを再開する。
- クイズのゲームモード定義（`GAME_MODES`）には `exam` を含むが、出題範囲画面のモードボタンには出さない（専用画面から開始する）。

---

### 4.10 全国一斉模試（`screen-mock-exam`）

日時を揃えた「時間割制」の模試。**受験はログイン不要**で、未ログインでも受験・採点・復習・端末保存ができる。全国集計（偏差値・順位・志望校判定）への提出と `get_mock_exam_report` は Supabase ＋ ログイン時のみ。Supabase 未設定／通信不可のときは、端末内の単語から作る「いつでも実力診断模試」（Part 1〜5 を均等に混ぜた30問・20分・何度でも受験可）を一覧の先頭に表示する。診断模試も難易度つき採点で偏差値・志望校判定の目安を出す。

- **スケジュール**: `mock_exams` を新しい順に取得し、開催中／開催前を先、終了済みを後に並べる。`start_at` / `end_at` で次の3状態を判定（`mockPhase`）。
  - 開催前（`now < start_at`）: 開始までのカウントダウンと志望校登録。
  - 受験時間枠内（`start_at <= now <= end_at`）: 「模試を開始する」。制限時間は開催回の `duration_sec`（既定 1500 秒 = 25 分）。
  - 終了後（`now > end_at`）: 成績表（確定 or 暫定）と志望校判定を表示。
- **出題**: `mock_exams.question_ids` の単語をそのまま出題（`subject` = `leap` / `kobun`）。通常4択固定。診断模試（`mockBuildOfflineExam`）は Part ごとに均等な30問を組み立てる。
- **難易度（Part）つき採点**: `difficulty_data.js` の Part 別困難度 b（Part 1 = -1.7 / 2 = -1.0 / 3 = -0.3 / 4 = 0.5 / 5 = 1.2、`LEAP_DIFFICULTY.words` で語ごとに上書き可）を使い、4択の当て推量 c=0.25 を考慮した **3PL で能力 θ を EAP 推定**する（`js/mock-score.js`。事前分布 N(0,1)、θ は -4〜4 を 0.1 刻み）。偏差値 = 50 + 10θ（20〜80 にクリップ）。素点ではなく難易度で重み付けされるため、Part 1 だけ全問正解しても 75 に張り付かず、発展（Part 4–5）を取ると上がる。**受験者が 0 人でも算出できる**（母集団をモデルで仮定するため、人数が集まらなくても偏差値が出る）。
- **サーバ側の同一実装**: `mock_ability_deviation(p_exam, p_answers)` が同じ式で計算する（`supabase/migration_mock_difficulty.sql` / `schema.sql`）。`mock_exams.question_levels`（Part 1..5）が未設定の回は従来の素点式にフォールバックする。回答 `answers[{ id, correct, sec }]` を `question_ids` と突き合わせて難易度に変換する。
- **信頼区間と判定**: 事後分布の SD から 90% 区間を出し、成績表に「偏差値 62.8（目安 51–74）」と表示。**判定は区間の下限**を使う（`mockJudgeFor` → `LeapMockScore.judgeTier`。tier 別 A/B/C しきい値は tier1 65/58/50、tier2 62/55/47、tier3 58/50/43、tier4 53/45/38）。モデル推定があるときは N<5 でも「判定保留」にせず、N の注記つきで判定を出す。
- **難易度別の内訳**: `mockRenderDifficultyCard` が Part ごとの正答数・正答率・難易度ラベル（基礎〜難関）を成績表に表示する。
- **志望校（ロードマップ）判定**: `userData.roadmap` があれば、未ログイン・オフラインでも志望校 tier で A〜D 判定と合格圏ギャップを表示する（`mockRenderRoadmapJudge`）。
- **開始時刻の保持**: 開始時に `mockExamStartedAt` を記録し、`elapsed_sec` を提出。終了時刻を過ぎた提出は `is_late = true`（参考記録）として保存し、正規受験の集計から除外する。
- **エントリー**: 第1〜第5志望を `mock_exam_entries.choices`（jsonb 配列）に保存。各要素は `{ facultyId, univ, faculty, groupId, groupName, tier, category }` の自己記述形式で、これだけで大学×文理／tier／category の集計ができる。ローカル下書きは `LEAP_MOCK_CHOICES_V1`。
  - 選択 UI は「大学名・学部名の検索」＋「カテゴリ」「難易度（tier）」の絞り込みを備え、該当する大学・学部だけをセレクトに出す（件数表示・条件クリア付き）。
- **成績表**: `get_mock_exam_report` の返却値を表示。偏差値・順位・上位パーセンタイル・受験者数 N・平均・トリム平均・理論平均・実効SD・志望校判定（A/B/C/D または判定保留）・全大学×文理群の目安一覧（カテゴリ見出し付き・スクロール）。
- **判定**（`mockJudgeFor`）: モデル推定があるときは偏差値の**信頼区間下限**を使う（無いときは偏差値そのもの）。`tier` 別しきい値で A〜D を決め、志望者内パーセンタイルが上位25%なら1段上げ、下位20%なら1段下げる。モデル推定が無い旧記録で N < 5 のときだけ「判定保留（暫定）」。
- **合格圏ギャップ**（`mockJudgeGap`）: 志望校カードに、tier 別の A 基準偏差値と現在の偏差値（下限）の差を「🎯 合格圏（A）まで あと偏差値 X」として表示する（到達済みなら「✅ 合格圏（A）に到達しています」）。偏差値が算出できないときは表示しない。
- **ログイン不要の受験**: 開催スケジュールは未ログインでも読める公開 RPC `get_mock_exam_schedule()` で取得する（`question_ids` は受験時間枠内だけ返る。RPC 未適用ならログイン時のみ `mock_exams` を直接 SELECT）。志望校エントリーはローカル下書き（`LEAP_MOCK_CHOICES_V1`）に保存し、ログイン時のみ `mock_exam_entries` へ upsert。受験結果は未ログイン／通信エラー時 `LEAP_MOCK_LOCAL_RESULTS_V1`（`{ [examId]: { score, total, elapsed_sec, answers, is_late, submitted_at } }`）に保存し、結果画面は「端末内の採点結果」カード（得点・正答率・所要時間）を表示する。ログイン後に同じ回を開くと「☁️ 全国集計に提出する」（`resubmitLocalMockResult`）から `mock_exam_results` へ提出でき、成功したら端末側の記録は削除する。
- **弱点分析レポート**（`mockRenderWeaknessCard`）: 提出済みの `answers`（`[{ id, correct, sec }]`）を単語データへ引き直し、Part（古文は章）別の正答率バー・最も弱い分野のひとことコメント・間違えた単語の一覧（最大12件、語義つき）を成績表の下に表示する。全国集計・端末内採点の両方で動く（`mockBuildWeaknessAnalysis`）。
- **リマインド**: 開催回ごとに「⏰ リマインド設定」を切り替えられる（`toggleMockReminder`）。設定は `LEAP_MOCK_REMINDERS_V1` に保存し、開始24時間前〜終了までの間、起動時に1日1回トーストで知らせる（`mockCheckReminders`、同日重複は `LEAP_MOCK_REMINDER_SEEN_V1` で抑止）。終了から1日以上たった設定は自動で削除する。一覧にも「⏰ リマインド設定済み」を表示。
- **時間配分ログ**（`mockRenderTimeCard`）: 問題表示から解答までの秒数を `quizState.answerTimes` に記録し、`answers[i].sec` として提出する（クイズ側は `renderQuestion` で `questionShownAt` を更新）。成績表に解答合計・1問平均・最速/最遅・序盤/中盤/終盤の正答率・時間がかかった問題 TOP3 を表示する（`mockBuildTimeAnalysis`）。`sec` が無い旧記録ではカード自体を出さない。
- **振り返りメモ**: 成績表の下に 500 字までのメモ欄を表示し、`LEAP_MOCK_NOTES_V1` に模試ごとに保存する（`saveMockNote` / `deleteMockNote`、更新日時は `mockFormatDateTime`）。
- **成績履歴**（`mockRenderHistoryCard`）: 提出・端末保存のたびに `LEAP_MOCK_HISTORY_V1` へ1件記録する（`mockRecordHistory`、同じ模試は最新1件に置き換え、最大20件）。成績表に直近8件の正答率バー（古い→新しい）・自己ベスト・直近6件の一覧（得点・正答率・偏差値・日時）を表示する。ログイン前からあった記録も、成績表を開いたときに未登録なら遡って記録する（`mockBackfillHistory`）。
- **復習導線**: 結果画面と同じく間違えた単語を `startQuizWithPool` で復習できる（`reviewMockMistakes`）。直近の受験直後はその場のミス一覧（`mockLastMistakes`）を使い、再読み込み後や別端末の記録では保存済み `answers` から誤答を復元する（`mockSavedMistakes` / `mockMistakePool`）。同じ誤答を「🧠 間違えた単語を苦手に登録」（`registerMockMistakesToWeak`）で `weakWords` へまとめて登録でき、`source="mock"`・`stage=1`・翌日復習として忘却曲線に乗る（既存の苦手はミス回数を加算）。`html2canvas` の `#result-share-card` に偏差値・得点・要復習を流し込んで画像保存できる（`downloadMockResultImage`、要復習の一覧も同じ復元ロジックを使う）。
- **ホームの次回模試バナー**: 開催中または次に開催される模試があるとき、ホームのお知らせの下にバナーを出す（`mockRenderHomeBanner`、`#home-mock-banner`）。開催中は「受験受付中・終了まで ◯」、開催前は「次回の模試・開始まで ◯」と表示し、タップで `screen-mock-exam` へ遷移する。候補は「模試画面で取得済みのスケジュール → 起動時に公開 RPC で取得したもの（`mockRefreshHomeBanner`）→ リマインド設定 `LEAP_MOCK_REMINDERS_V1`」の順に探し、60秒ごとに残り時間を更新する。練習模試は対象外。
- **中断**: 模試中に中断した場合は提出せず、成績表画面へ戻る（コイン・EXP の獲得分は残る）。

---

### 4.11 中断したクイズの再開（`LEAP_QUIZ_RESUME_V1`）

- 通常モード（ゲームモード `normal`）のクイズは、問題を表示するたびに `saveResumeState()` で現在地を保存する（模試・到達度テストは対象外）。
- ホームに「⏯ 前回の続きがあります（範囲 ・ n / m 問目から）」バナー（`#home-resume-banner`）を出し、「つづきから」で `resumeQuiz()`、「破棄」で `discardResumeQuiz()`。
- 再開は保存した単語 ID・並び・スタイル・スコア・誤答を復元して同じ問題から続ける（正解数・コンボ・コインも引き継ぐ）。1問目のみの状態（`index < 1`）はバナーを出さない。
- **上書きは「2問目以降に進んだとき」だけ。** 新しいクイズを開始して1問目を表示しただけでは、前回の保存を消さない（`LeapQuizResume.canOverwrite(index)` が `index === 0` を拒否）。別のクイズを始め直してホームに戻っても、前回の「つづき」バナーは残る。
- **完走／中断時は、いま終えたクイズの保存だけを削除する**（`clearResumeStateIfCurrent()` → `LeapQuizResume.matchesQuiz()`）。別のクイズの保存は残る（例: 1問だけの別クイズを完了しても上書き・削除されない）。
- 保存形式・妥当性・上書き可否は DOM 非依存の `js/quiz-resume.js`（`LeapQuizResume`）に集約し、`tests/resume.test.js` で検証する。

### 4.12 正誤の効果音・バイブ

- `handleAnswer()` が `playAnswerFeedback(isCorrect)` を呼ぶ。`navigator.vibrate`（正解 10ms / 不正解 18-40-18ms）と WebAudio の短いビープ（正解 880Hz / 不正解 220Hz）。
- 設定シートの「🔔 効果音・バイブ ON/OFF」（`LEAP_FEEDBACK_V1`）で切り替え。初期値は ON。

### 4.13 今日の目標

- ホームのリング（SVG、`#home-goal-ring`）が `userData.dailyLog[today]` / 目標問数を表示。目標は通常 20 問だが、**志望校ロードマップがあれば「1日の新規語数 ＋ 復習期限の来た苦手語数」**（`roadmapDailyTarget()`）に置き換わる。20問に到達した日は `LEAP_DAILY_GOAL_SEEN_V1` で1日1回だけトーストを出す。

### 4.14 志望校ロードマップ（`screen-roadmap`）

志望校を主軸に、試験日から逆算した学習計画を出す。ログイン不要・端末内で完結する。

- **保存**: `userData.roadmap = { label, tier, grade, examType, targetDeviation, examDate, startDate, createdAt, updatedAt }`（クラウド同期対象）。`grade` は `k1` / `k2` / `k3` / `ronin`、`examType` は `private`（私大一般 2/1）/ `national`（国公立2次 2/25）。志望校は `MOCK_FACULTIES` の候補から選ぶと tier が入る（自由入力も可。その場合は tier 3）。
- **逆算**（`LeapRoadmapPlan.computePlan`、DOM 非依存・`tests/roadmap.test.js` で検証）: `remaining = 総語数 − マスター語数`、`wordsPerDay = ceil(remaining / 残り日数)`。**マスター＝3回以上正解かつ正答率90%以上**（`getWordStatus(id) === "mastered"` と同じ。`getWordStatus` が無い環境では同じ条件を直接計算）。一度解いただけの単語は残り語数に含める。Part ごとの `done` もマスター数。
- **試験日の初期値**: 学年と入試区分から `LeapRoadmapPlan.defaultExamDate(grade, examType, today)` で求める（学年の基準は4月始まり。高3→翌年2月、高2→2年後、高1→3年後、既卒→直近の2月。3月以降の既卒は翌年）。日付入力は自由に上書きでき、上書きした値がそのまま保存される。
- **Part ごとの期限**: Part 順に残り語数を累積し、残り日数を按分して「Part n は YYYY-MM-DD まで」を出す（完了済み Part は「完了」）。最終 Part の期限は試験日。
- **予定線との差**: `expectedDone = 総語数 × 経過日数 / (経過日数 + 残り日数)` と比較し、`ahead` / `ontrack` / `behind` と遅れ日数を表示。試験日を過ぎていれば `overdue`。
- **ホーム常設カード**（`#home-roadmap-card`）: 志望校・試験日・今日のノルマ（新規＋復習）・マスター率バー・予定との差を表示。未設定なら「計画を作る」ボタン。今日の目標リングもこのノルマに連動する。
- **専用画面**: 学年・入試区分（選ぶと試験日を自動設定、個別編集可）・志望校・目標偏差値の入力、保存／解除、逆算プラン（残り日数・1日の新規語数・残り語数・Part 別マイルストーン）。志望校は入力に合わせて候補を絞り込む**タップ選択リスト**（`#roadmap-school-results`、最大40件・難易度ラベル付き、`filterRoadmapSchools()`）で選び、一覧に無い場合はそのまま入力して自由登録できる。模試成績表の「志望校判定（ロードマップ）」からも開ける。

### 4.15 アップデート情報（`updates-modal`）

- 変更点は `updates_data.js` の `LEAP_UPDATES`（新しい順）に `{ version, date, tag, title, items[] }` で持つ。アプリ内の「📣 アップデート情報」モーダルがこれを描画する（`renderUpdatesList`）。`SERVICE.md` の更新履歴とは別で、**利用者向けの言葉**で書く（開発メモは SERVICE.md 側）。
- 入口: ホーム下部の「📣 アップデート情報」と、設定シートの「アップデート情報」。
- 未読は `LEAP_UPDATES_SEEN_V1`（最後に開いた `version`）と先頭エントリを比べ、NEW バッジを出す（`renderUpdatesBadge`）。モーダルを開いた時点で既読化。
- 表示: タグ（新機能/改善/修正/データ）、version、日付、タイトル、箇条書き。先頭に「最新」バッジ。

---

## 5. 単語辞典

- ホーム「📖 単語辞典（番号順）」から。**現在のゾーンの単語だけ**を ID 順に表示。
- 検索: **英単語・日本語語義・単語番号**に対応（`normalizeSearchText`）。
- **頭文字ジャンプ**（`#dict-letter-jump`）: 英語は A–Z、古文は あ〜わ の行チップで先頭文字絞り込み（`setDictionaryLetter` / `kanaRow`、状態は `dictionaryFilter.letter` に保存）。古文は読み（`reading`）でも検索できる。
- フィルタ（複数選択可、AND 結合）:
  - Part（ゾーンの有効 Part から動的生成。古文は「1章/2章」）
  - ID 範囲（開始・終了）
  - 学習状況（未学習／苦手／学習中／マスター）
- フィルタパネルは**sticky＋折りたたみ**。状態は `LEAP_DICTIONARY_FILTER_V1` / `LEAP_DICT_FILTER_OPEN_V1` に保存。
- **100 件／ページ**（`DICT_PAGE_SIZE`）。前後＋先頭末尾＋省略記号のページャ。
- 行タップで**単語詳細シート**: 見出し語・IPA・品詞バッジ・語義（タグ付き）・コラム/頻出・例文（和訳ハイライト・読み上げ）・学習状況バッジ。
- 古文の行は `num`（冊内番号）を表示し、読みが異なる場合は「読み：〜」を添える。
- 古文の詳細シートは「古文情報」カードに **読み・見出し漢字・活用/品詞・重要度（★）・収録章・単語番号** を出し、語義（重要な語義は太字）・コアイメージ・解説/入試/関連・例文（原文＋訳＋出典＋補足、`【…】` をハイライト）を表示する。例文は 🔊 で `ja-JP` 読み上げ（LEAP の品詞・IPA・コラム欄は出さない）。

### 5.1 本誌ビュー（`js/dict-book.js`）

LEAP 本誌の見開きを再現して読み進めるビュー。

- **開き方**: 辞典ヘッダーの「📖 本誌」（`openDictBook()`）、または単語詳細シートの「📖 本誌ビュー」（`openDictBookFromDetail()`、`currentDetailWord` の単語から開く）。
- **紙面**: 見開き1組＝8語（左4語/右4語）。1語＝本誌の1エントリを3カラムで再現（左＝淡い青のパネルに番号・見出し語・IPA・品詞、中＝品詞の赤い小枠＋語義①〜（赤）・▸付きの頻出/派生メモ、右＝①②の例文と訳、`【…】` を赤太字）。各ページ上部に赤いリボンのセクション見出し、右ページ上部に `Active Vocabulary（基幹語）` の running head、左右ページの外側下にノンブル、右端に Part の縦タブ。データは `LEAP_WORD_DETAILS` の `ipa` / `senses` / `notes` / `examples` を使う。
- **ページめくり**: `dictBookStep(±1)` で前後の見開きへ。ボタン／左右スワイプ（45px以上）／←→キー、Esc で閉じる。`flip-next` / `flip-prev` の CSS アニメーションで紙をめくる。
- **レイアウト**: 768px 以上は2ページ見開き、未満は縦積み。本誌らしさを優先し、ダークモードでも紙面は明るいまま。古文単語は英語編の本誌対象外として除外する。

---

## 6. 語源ラッシュ／接辞神経衰弱

### 6.1 語源ラッシュ（`screen-affix-rush`）

- 接頭辞／接尾辞を切替（`LEAP_AFFIX_TYPE_V1`）。
- 60秒・4択。出題形式は「接辞＋語根 → 完成単語の意味」。
- 正解でスコア・コンボ。誤答でコンボリセット。終了後にベスト記録を表示。
- 記録は `userData.affixStats` に保存。

### 6.2 接辞神経衰弱（`screen-affix-memory`）

- カードをめくって「語根」と「意味」のペアを揃える。
- 手数・時間・ミスを HUD 表示。全ペア成立で完了。記録は `affixStats`。

---

## 7. ショップ・称号・実績

### 7.1 ショップ（`screen-shop`）

| タブ | 内容 | 点数（現在） |
|---|---|---|
| 🏷️ 前称号 | 「〜の」「〜な」で終わる修飾語 | 86 |
| 🎖️ 後称号 | 助詞なしの名詞（肩書き） | 84 |
| 🖼️ フレーム | アバター枠 | 27 |
| 🎭 アバター | 絵柄（絵文字） | 17 |

- 通貨は**コイン**。購入は即時反映（確認ダイアログあり）。
- 装着中の「前称号＋後称号」がプレイヤー名（例:「始まりのビギナー」）。`getFullTitle()` が連結ルールを処理。
- フレーム・アバターは `ownedFrames` / `ownedAvatars` と `equippedFrame` / `equippedAvatar` で管理。
- 称号は価格順ソート表示（`getPriceSortedPrefixList` など）。
- 初期所持: `pre_init`（始まりの）、`suf_beginner`（ビギナー）、`frame_normal`、`avatar_auto`（🦉）。
- 各タブの分母／分子バッジは `renderShop()` の冒頭で全タブ分をまとめて最新化する（タブを開くまで古い値が残らないように）。

### 7.2 実績（`ACHIEVEMENTS`）

- 総数 **115**（基本配列 ＋ `ACHIEVEMENTS.push()` による追加分）。ヘッダー／ホームのカウンタは動的計算。
- カテゴリ: `basic` / `correct` / `level` / `combo` / `accuracy` / `collection` / `words` / `review` / `daily` / `shop` / `exam`（到達度テスト） / `game`（語源ラッシュ・神経衰弱） / `kobun`。実績モーダルのタブもこの並び。
- **進捗表示**: 数値系の実績は `progress(userData) => [現在値, 目標値]` または `ACHIEVEMENT_PROGRESS`（ID→関数の対応表）を持ち、未達成の項目には進捗バーと「n / m」を表示する。モーダル上部の「🎯 **あと少しで解除**」には未達成のうち達成率が高い上位3件を出す（`achievementProgress()`）。
- 各実績は `condition(userData)` で判定し、達成時にコイン報酬（`price`）を付与。
- 2026-11-28 追加分の内訳: 到達度テスト 6（初受験・B/A/S判定・5回受験・満点）／語源ゲーム 5（ラッシュ 500/1500/3000点・神経衰弱クリア・両方クリア）／学習量 10（累計 500/2000/5000問、1日 100/300問、単語 1000/1500語、300語マスター、Part 4・5 制覇）／裏世界 2（150語踏破・30語マスター）／継続 3（60日連続・デイリー30回・復習50回）／累計正解 2000。
- 達成済み ID は `LEAP_ACHIEVEMENTS_V1` に保存。旧 ID は `sanitizeAchievements()` で掃除。
- 代表例: 初正解、初勝利、累計正解 10/30/…/1000、Lv 2/5/10/20/30、コンボ 3/5/10/15/20/30、正答率90%・100%、完走 5/10/25/50 回、苦手 1/10/30 語、ストリーク 3/7/14/30 日、デイリー 5/10 回、Part 1〜3 の8割カバー、称号・フレーム・アバター収集、古文 初回/10語/50語/10語マスター/表裏両方 など。

---

## 7.5 学習記録（`screen-stats`）

- ホームの「📊 学習記録（カレンダー）」から `navigate("screen-stats")` で開き、`renderStatsScreen()` が描画する。対象は**現在のゾーン**。
- **集計カード**: 連続学習（`userData.streak`）／累計解答（`dailyLog` の合計）／マスター語数（`getWordStatus() === "mastered"`）／苦手語数（`weakWords` のうち現在のゾーンに属するもの）。
- **学習カレンダー**: 直近12週（今日を含む・日曜始まり・最大84日）のヒートマップ。`userData.dailyLog` の日別解答数で色を段階分け（0 / 1–9 / 10–29 / 30–59 / 60+）。セルの `title` に日付と解答数を表示。スタイルは `assets/css/app.css` の `.cal-cell`（ダークモードは `html.dark` / `data-theme="dark"` で上書き）。
- **Part別マスター率**: 現在のゾーンの有効 Part ごとに、マスター語数・割合バー・学習済み語数を表示。
- **記録の仕組み**: `bumpDailyLog()` がクイズの1問解答ごと（正誤共通）に `dailyLog[today]` を +1 する。400日を超えた古い記録は削除。
- 端末間の統合では同じ日付の解答数を**大きい方（max）**で採用する（合算による二重計上を避けるため）。

---

## 8. 結果画面・共有・挑戦状

- 結果画面に表示: スコア、正答数、正答率、最大コンボ、獲得コイン、EXP、レベルアップ、称号、間違えた単語一覧、デイリーバッジ。
- クイズ画面の「タップして次へ」は解答直後に即表示する。誤タップ防止は `NEXT_TAP_GUARD_MS`（120ms）の短いガードのみ（旧 350ms 待ちを廃止）。
- **共有URL**（`generateResultUrl`）: 現在の URL に `?r=` を付け、以下の JSON を UTF-8 安全 Base64 にしたもの。

```json
{ "s": 正解数, "t": 出題数, "a": 正答率, "c": 最大コンボ,
  "t2": "称号", "rs": 開始ID, "re": 終了ID, "rl": "範囲ラベル", "z": "leap|kobun",
  "ex": 0|1, "ep": Part ID または null }
```

- `ex: 1` は到達度テストの共有。このとき `rl` は範囲名（全範囲／Part名）、`ep` は範囲の Part ID（全範囲は `null`）。受け取った側の「⚔️ この挑戦を受けて立つ！」は `acceptChallenge()` → `startExamChallenge()` で同じ範囲の到達度テストを開始する。

- 共有先: **サービス内のフレンド共有**（ログイン中のみ。フレンドを選んで送ると、相手の「📥 共有」タブに届き、同じ範囲で挑戦できる）、X（Twitter）投稿、LINE 共有、URL コピー。
- **到達度テストの共有**: 結果カード画像は `EXAM RESULT` と「到達度テストの記録」「判定X」を表示。サービス内共有の `sharedResults` エントリには `exam: { grade, partId }` が入り、受け取った側の一覧には「🎓 到達度テスト・範囲・判定X」と「🎓 同じ範囲でテストに挑戦」（`startExamChallenge`）が出る。
- **サービス内共有の仕組み**: 専用テーブルは追加せず、送信者の `user_progress.user_data.sharedResults` に最大 20 件を保存して `cloudPush("share")` する。承認済みフレンドは RLS で `user_progress` を読めるため、受信側はフレンドの `sharedResults` から自分宛て（`to` に自分の UID を含む）のものを集めて表示する（`collectFriendShares`）。宛先が空配列なら全フレンド宛て。
- **画像保存**: 画面外の専用カード `#result-share-card`（常時ダーク配色・440px 幅）に結果を流し込み、html2canvas で PNG 化してダウンロードする（`buildResultShareCard` / `captureResultBlob`）。画面の結果カードとは独立しているため、ライト/ダークどちらでも同じ見た目になる。正答率・前回比・正解数・最大コンボ・コイン・連続学習・間違えた単語（最大6件、残りは件数）・範囲・日付を表示。
- **挑戦状**: `?r=` 付き URL を開くと結果画面に「🔥 友達からの挑戦状！出題範囲: …」を表示し、同じ範囲で再挑戦できる（`checkIncomingChallenge`）。

---

## 9. レベル別リーダー（休眠機能）

- 対象範囲（Part または ID 範囲）から例文付き単語を最大 **10 語**選び、例文を並べて長文を自動生成。
- 3レベル: 導入（中学文法・和訳表示）/ 標準（高校基礎・3文チャンク）/ 実践（高校標準・通し読み）。
- 対象単語はハイライトされ、タップで単語ポップアップ。全文読み上げ・和訳トグルあり。
- **現在ホームに入口ボタンがなく、通常 UI からは到達できない**（`screen-reader` は残存）。復活させる場合はホームに `openReader()` のボタンを追加する。

---

## 10. ダークモード・PWA・音声

- **ダークモード**: ヘッダーの月/太陽ボタン。`LEAP_DARK_MODE_V1`。Tailwind クラスを CSS で上書きする方式（`html.dark [class~="bg-white"]` など）。コントラスト確保のため独自調整あり。古文ゾーンは紫系テーマ（`body.kobun-mode`）。
- **PWA**: `manifest.json`（standalone）。ホームにインストールバナー（iOS Safari は手順文言を変更、`LEAP_PWA_BANNER_DISMISSED_V1` で非表示）。
- **音声読み上げ**: `voiceEnabled`（初期 ON）。クイズの単語、例文、辞典の詳細、リーダー本文を読み上げ。ゾーンで言語を切替。
- **自動再生制限対策（iOS/iPadOS）**: 最初のユーザー操作（`pointerdown` / `touchstart` / `touchend` / `click` / `keydown`、capture）で `unlockSpeech()` を呼び、**空文字の発話を同期実行**して音声エンジンをアンロックする。iPadOS は `pointerdown` だけでは不十分なことがあるため `click` / `touchend` でも再試行し、アンロック用の発話は直後の `cancel()` で消さない。
- **発話の同期実行**: 操作から 1 秒以内の `speakEnglish()` はユーザー操作内とみなして `speak()` を**同期的に**呼ぶ（iOS/iPadOS は `setTimeout` 経由の初回発話を無視する）。それ以外は `cancel()` 後に短い遅延を置いて発話する。
- **声の選択**: `initSpeechSynthesis()` が `voiceschanged` を購読して声を再取得し、`pickTtsVoice()` が `en-US` / `ja-JP` に合う声を選ぶ。Safari は `utter.voice` が未設定だと発話せず止まることがある（WebKit bug 243055）ため、言語一致がなければ先頭の声を必ず割り当てる。一時エラー時は一度再試行する。
- **iPad で音が出ない場合の環境要因**: iPadOS のコントロールセンターのミュート（ソフトミュート）が ON だと、Safari の音声合成だけが無音になる（他の音は鳴ることがある）。音量・ミュート解除を確認する。iOS 26 系では特定の声・文字列で音声合成が停止する既知不具合もある（Safari 再起動で復帰）。
- **明示操作の再生**: 🔊 ボタン（`speakWord(true)`・詳細シート・例文）は `voiceEnabled` が OFF でも鳴る。自動読み上げだけが設定に従う。

### 10.1 学習リマインダー通知（Web Notification）

ブラウザ標準の Web Notification API および Service Worker（`sw.js`）の `showNotification` / `notificationclick` を利用したプッシュ・ローカル通知機能（`js/notification.js`）。

- **機能**:
  - 設定画面（`#settings-modal`）内の「🔔 学習リマインダー通知」から通知設定モーダル（`#notification-modal`）を開いて管理。
  - **通知権限の管理**: ブラウザの通知権限（`granted` / `default` / `denied`）を判定・リクエスト。ブロック時はブラウザ設定での解除案内を表示。
  - **毎日の学習リマインダー**: 指定時刻（デフォルト `20:00`）に学習を促す通知を発行。1分ごとのタイマー判定で、同日内重複は `LEAP_NOTIF_LAST_DATE` で防止。
  - **コンテキスト連動通知**: 忘却曲線の復習待ち単語がある場合は「🧠 忘却曲線の復習が X 語待っています！」、ストリーク継続中は「🔥 連続学習 X 日目！今日も続けよう」と文面を動的最適化。
  - **動作確認テスト**: 「📢 テスト通知を送信」ボタンでその場で即座に通知動作を確認可能。
  - **タップ時の挙動**: Service Worker の `notificationclick` リスナーで通知を閉じ、既存の LEAP タブをフォーカスまたは新規オープン。
- **対応環境**:
  - PC（Chrome / Edge / Firefox / Safari）、Android Chrome。
  - iOS / iPadOS（iOS 16.4 以降）：Safari の共有から「ホーム画面に追加」した PWA として起動することで Web Push / Notification が利用可能。

---

## 11. 保存データ（localStorage）

### 11.1 キー一覧

| キー | 内容 |
|---|---|
| `LEAP_QUIZ_USER_DATA_V3` | **メインの学習データ**（旧 V2 / V1 から自動移行） |
| `LEAP_ACHIEVEMENTS_V1` | 達成済み実績 ID 配列 |
| `LEAP_DARK_MODE_V1` | `"dark"` / `"light"` |
| `LEAP_SUBJECT_V1` | `"leap"` / `"kobun"` |
| `LEAP_SELECTED_PARTS_V1` | 英単語で選択中の Part ID 配列 |
| `LEAP_KOBUN_SELECTED_PARTS_V1` | 古文で選択中の Part ID 配列 |
| `LEAP_CUSTOM_RANGE_V1` / `LEAP_KOBUN_CUSTOM_RANGE_V1` | カスタム ID 範囲（開始・終了） |
| `LEAP_QUIZ_STYLE_V1` | `"normal"` / `"context"` / `"listening"` / `"spelling"` |
| `LEAP_QUIZ_RESUME_V1` | 中断したクイズの再開情報（`{ v, subject, ids[], index, style, label, correctCount, combo, maxCombo, earnedCoins, earnedExp, score, mistakeIds[], isDaily, isWeak, savedAt }`） |
| `LEAP_FEEDBACK_V1` | 正誤の効果音・バイブ（`"0"` でOFF。未設定はON） |
| `LEAP_DAILY_GOAL_SEEN_V1` | 今日の目標達成トーストを出した日（`YYYY-MM-DD`） |
| `LEAP_GAME_MODE_V1` | `"normal"` / `"sprint"` / `"sudden"` |
| `LEAP_QUIZ_STATUS_FILTER_V2` | 学習状況フィルタ（配列。V1 は旧形式） |
| `LEAP_DICTIONARY_FILTER_V1` | 辞典の Part / ID範囲 / 学習状況フィルタ |
| `LEAP_DICT_FILTER_OPEN_V1` | 辞典フィルタパネルの開閉 |
| `LEAP_AFFIX_TYPE_V1` | 語源ラッシュの接頭辞/接尾辞 |
| `LEAP_PWA_BANNER_DISMISSED_V1` | PWA バナーを閉じたか |
| `LEAP_APP_CACHE_VER` | アプリのキャッシュバージョン（`APP_VER` と比較） |
| `LEAP_CLOUD_META_V1` | 直近にクラウドへ保存した `client_updated_at`（初回ログイン時の競合判定用） |
| `LEAP_CLOUD_SHARE_DETAILS_V1` | 詳細ログ公開フラグ（`"1"` = 公開 / `"0"` = 集計とバッジのみ） |
| `LEAP_CLOUD_DISPLAY_NAME_V1` | フレンド一覧に表示する表示名（ローカル控え） |
| `LEAP_SHARED_RESULTS_SEEN_V1` | 既読にしたフレンド共有結果の ID 配列（「📥 共有」の未読バッジ用） |
| `LEAP_EXAM_RANGE_V1` | 到達度テストの範囲（Part ID。空文字 = 全範囲） |
| `LEAP_MOCK_CHOICES_V1` | 全国一斉模試の志望校下書き（`{ examId, choices: [...] }`）。サーバー保存前の控え |
| `LEAP_MOCK_REMINDERS_V1` | 模試のリマインド設定（`{ [examId]: { examId, title, start_at, end_at, created } }`）。開始24時間前〜終了まで通知対象 |
| `LEAP_MOCK_REMINDER_SEEN_V1` | リマインドを最後に通知した日（`{ [examId]: "YYYY-MM-DD" }`、同日の重複通知防止） |
| `LEAP_MOCK_NOTES_V1` | 模試の振り返りメモ（`{ [examId]: { text, updated } }`、1件500字まで） |
| `LEAP_MOCK_HISTORY_V1` | 模試の成績履歴（`[{ examId, title, subject, date, score, total, accuracy, deviation, elapsed_sec, is_late, offline }]`、最大20件・同じ模試は最新1件） |
| `LEAP_ANNOUNCEMENTS_SEEN_V1` | 既読にしたお知らせ ID の配列（最大100件。ホームの NEW バッジ用） |
| `LEAP_FEEDBACK_DRAFT_V1` | 意見箱の下書き（`{ category, body, rating, contact }`） |
| `LEAP_FEEDBACK_CLIENT_TOKEN_V1` | 意見箱のレート制限用クライアント UUID（端末ごとに生成） |
| `LEAP_NOTIF_ENABLED` | リマインダー通知の有効・無効（`"true"` / `"false"`） |
| `LEAP_NOTIF_TIME` | リマインダー通知の時刻（`"HH:MM"`、デフォルト `"20:00"`） |
| `LEAP_NOTIF_REVIEW` | 復習待ち単語の通知（`"true"` / `"false"`） |
| `LEAP_NOTIF_STREAK` | 連続記録（ストリーク維持）の通知（`"true"` / `"false"`） |
| `LEAP_NOTIF_LAST_DATE` | 最後にリマインダー通知を発行した日付（`"YYYY-MM-DD"`、同日重複防止） |

### 11.2 `userData` の主なフィールド

```js
{
  coins, exp, level,
  prefix, suffix, purchasedPrefixes[], purchasedSuffixes[],
  ownedFrames[], equippedFrame, ownedAvatars[], equippedAvatar,
  wordStats: { [wordId]: { correct, total } },      // 単語別の正解/出題回数
  weakWords: { [wordId]: { id, word, meaning, count, stage, nextReview, lastReviewed, source } }, // source: quiz / mock / exam / review / daily
  scoreHistory: [ { score, correct, total, accuracy, combo, coins, range, date, isDaily } ], // 最大5件
  sharedResults: [ { id, at, to[], subject, range{start,end,label}, correct, total, accuracy, combo, score, title } ], // フレンド共有 最大20件
  examHistory: [ { id, date, subject, range, correct, total, accuracy, grade, seconds } ], // 到達度テスト 最大20件
  dailyLog: { "YYYY-MM-DD": n }, // 学習カレンダー用の日別解答数（最大400日分）
  totalQuizzes, maxComboEver,
  streak, lastPlayDate, lastDailyDate, dailyClears, reviewClears,
  voiceEnabled, affixStats: {}, readerRuns, dictOpened
}
```

- `wordStats` / `weakWords` は **ID キー**。英単語 1〜2300、古文 10001〜 で衝突しない。
- 旧称号名は `SUFFIX_NAME_MIGRATION` / `PREFIX_NAME_MIGRATION` で新形式へ移行。

---

## 12. クラウド同期・フレンド（Supabase・任意）

`supabase_config.js` の `window.LEAP_SUPABASE_CONFIG`（`url` / `anonKey`）を設定したときだけ有効になる（`index.html` と `admin.html` で共有）。未設定・CDN 失敗時は `supabaseClient = null` のまま、すべてのクラウド UI が「ローカルのみ」表示になり従来動作を維持する（画面は落ちない）。

### 12.1 設定と初期化

```js
// supabase_config.js
window.LEAP_SUPABASE_CONFIG = { url: "https://xxxx.supabase.co", anonKey: "sb_publishable_..." };
```

- Supabase JS は `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` で読み込む（ビルド工程なし）。
- クライアントは `auth: { persistSession, autoRefreshToken, detectSessionInUrl, flowType: "pkce" }` で生成。
- **認証状態は公開サイトと管理画面で分離**している。`index.html` は Supabase 既定の保存キー（`sb-<ref>-auth-token`）、`admin.html` は `storageKey: "leap-admin-auth-v1"` を使う。同じブラウザで「一般ユーザー」と「管理者」を別アカウントで同時にログインできる。
- OAuth プロバイダは `OAUTH_PROVIDERS` 配列。追加するとログインボタンが自動で増える（現在は Google と LINE）。
- **LINE は Supabase の組み込みプロバイダではない**ため、`custom:line` という Custom OAuth Provider として登録する（Manual 構成）。手順は `docs/SUPABASE_SETUP.md` §5。
- OAuth 失敗時はコールバック URL の `error_description` をサイト内ダイアログで表示する（`checkAuthErrorParam`）。
- ログイン導線はホームの「⚙️ 設定・その他」→「☁️ アカウント・同期」→ `screen-social`。起動直後のログインは要求しない。

### 12.2 同期フロー

1. 起動時は localStorage を読んで即描画（`loadUserData`）。ログイン済みセッションがあれば裏で `bootstrapCloudUser()`。
2. プロフィール（`profiles`）を取得。無ければフレンドコード `LEAP-XXXX` を生成して作成（衝突時は再試行）。
3. クラウドの `user_progress` を取得し、端末とクラウドの両方に学習データがあり、かつ `LEAP_CLOUD_META_V1.lastPushedAt` がクラウドの `client_updated_at` と一致しない場合だけ競合ダイアログを表示。
   - **端末のデータで上書き** → そのまま `cloudPush`。
   - **クラウドのデータを復元** → `user_data` / `achievements` を localStorage に書き戻して `loadUserData()`。
   - **統合（おすすめ）** → `mergeProgressData()` で合算。
4. 解決後に `cloudPush()` で `profiles.quick_stats` と `user_progress` を保存。

自動同期のタイミング: クイズ完走（`cloudPushSoon("quiz")`）、ショップ購入（`"shop"`）、装備変更（`"equip"`）、表示名・公開範囲の変更、手動「今すぐ同期」。1問ごとの保存では同期しない。

**書き込み前マージ**: `cloudPush()` は保存の直前にクラウドの `client_updated_at` を確認し、他端末が後から更新していれば**先に取り込んで統合**してから書き込む（`mergeNewerCloudIntoLocal`）。これがないと、別端末で進めた復習を古いローカルデータで上書きしてしまう。

### 12.3 統合（マージ）ルール

| 項目 | 扱い |
|---|---|
| `coins` / `exp` / 各種回数・`streak` | 大きい方 |
| `wordStats` | 単語ごとに「出題回数が多い方」、同数なら正解数が多い方 |
| `weakWords` | 和集合。同じ単語は **`lastReviewed` が新しい方**を正とし、同日なら `stage` が高い方 → `nextReview` が遅い方。ミス回数（`count`）は多い方を残す（`LeapCloudMerge.mergeWeakWord`）。※以前は `nextReview` が早い方を採用していたため、復習を進めた端末の結果が他端末の古いデータで巻き戻っていた |
| `graduatedWords` | 単語ごとに克服日の**遅い方**（max）を採用。克服日 ≥ `lastReviewed` の単語は `weakWords` に復活させない（克服後に間違え直していれば苦手に戻す） |
| `scoreHistory` | 結合して重複除去し、先頭 5 件 |
| `examHistory` | 結合して（subject・範囲・日付・正解数・出題数）で重複除去し、先頭 20 件 |
| `dailyLog` | 日付ごとに大きい方（max）を採用 |
| 所持称号・フレーム・アバター・実績 | 和集合 |
| `affixStats` | ラッシュは最大スコア、神経衰弱は手数が少ない方 |
| `prefix` / `suffix` / 装着中アイテム | 端末側を優先 |

### 12.4 フレンド機能

- 自分のフレンドコード（`LEAP-XXXX`）をコピー／招待リンク（`?friend=LEAP-XXXX`）で共有。招待リンクを開くとコード入力欄へ自動入力。
- コード検索 → 申請（`pending`）→ 相手が承認（`accepted`）で相互フレンド。拒否・申請取消・解除あり。重複申請は DB のユニーク制約で防止。
- フレンド一覧カード: アバター／フレーム／前称号＋後称号／Lv／連続学習日数／マスター率／通算正答率／実績解放状況。
- フレンドをタップ → `friend-detail-modal` に以下を表示（`accepted` のみ。RLS でも保証）。
  - 総合・LEAP 全体・古文全体・Part 1〜5 別・古文 1〜2 章別の「未学習／学習中／苦手／マスター」内訳とマスター率、累計解答・正解、最大コンボ。
  - 前称号（86）・後称号（84）・フレーム（27）・アバター（17）・実績（115）の解放率と獲得バッジ一覧。
  - 直近のプレイ履歴（`scoreHistory` 最大5件）、苦手単語 TOP10（`weakWords` ＋ 正答率60%未満の単語）、語源ラッシュ／接辞神経衰弱のベスト。
  - 苦手単語セットで自分がクイズに挑戦する導線（`startFriendWeakQuiz`）。
- **公開範囲**: `user_progress.share_detailed_logs`。`false` のときフレンドには集計率・バッジのみ表示し、履歴・苦手単語はロック表示。設定は「設定」タブから切替。
- **自分の詳細**: ホームの「⚙️ 設定・その他」→「📊 自分の詳細」、および「☁️ アカウント・同期」画面右上の「📊 自分の詳細」から、フレンド詳細と同じシート（`friend-detail-modal` + `renderFriendDetail`）を自分のローカルデータで表示する（`openSelfDetail`。ログイン不要）。このとき「解除」ボタンは隠す。
- **サービス内の結果共有**: 結果画面の「👥 フレンドに共有」→ フレンド選択シート（`share-result-modal`）→ `sendResultShare` で `userData.sharedResults` に追加し `cloudPush("share")`。受信側は「📥 共有」タブに一覧表示し、未読バッジ（`LEAP_SHARED_RESULTS_SEEN_V1`）と「⚔️ 同じ範囲で挑戦する」（`startSharedResultChallenge`）を提供。未ログイン時はログイン導線を表示。

### 12.5 DB / RLS（`supabase/schema.sql`）

| テーブル | 主な列 | RLS |
|---|---|---|
| `profiles` | `id`(auth.users FK), `friend_code` unique, `display_name`, `equipped_avatar/frame`, `prefix/suffix`, `quick_stats` jsonb, `updated_at` | 認証済みは SELECT 可。INSERT/UPDATE/DELETE は本人のみ |
| `friendships` | `id`, `requester_id`, `addressee_id`, `status` (pending/accepted), 日時 | 当事者のみ SELECT/DELETE。INSERT は requester 本人。UPDATE（承認）は addressee のみ |
| `user_progress` | `user_id` PK, `user_data` jsonb, `achievements` jsonb, `share_detailed_logs`, `client_updated_at`, `updated_at` | 書き込みは本人のみ。SELECT は本人または `accepted` フレンド |
| `mock_exams` | `id`, `title`, `subject` (leap/kobun), `range_label`, `question_ids` int[], `expected_rates` float8[], `start_at`, `end_at`, `duration_sec` (既定1500), `created_at` | 認証済みは SELECT 可（開催回マスタ）。未ログインへは公開 RPC `get_mock_exam_schedule()` 経由で開催日時・問題数のみ公開 |
| `mock_exam_entries` | `id`, `exam_id`, `user_id`, `choices` jsonb（第1〜第5志望）, `updated_at`。`(exam_id,user_id)` unique | 本人のみ SELECT / INSERT / UPDATE / DELETE |
| `mock_exam_results` | `id`, `exam_id`, `user_id`, `score`, `total`, `elapsed_sec`, `answers` jsonb, `is_late`, `submitted_at`。`(exam_id,user_id)` unique | 本人のみ INSERT / SELECT（UPDATE/DELETE 不可） |
| `admin_users` | `user_id`（auth.users FK・PK）, `note`, `created_at` | RLS 有効・ポリシーなし。`security definer` の `is_admin()` からのみ参照でき、anon / authenticated は直接読めない |

管理者の運用は `supabase/admin_roles.sql` の RPC で行う（`schema.sql` 適用後に実行）。

| RPC | 権限 | 内容 |
|---|---|---|
| `admin_list_members(p_search)` | 管理者のみ | `auth.users` を UID・メール・表示名で検索し、`providers`（`custom:line` / `google` / `email`）と `is_admin` を返す。メールが NULL の LINE ユーザーも扱える |
| `admin_grant(p_user_id, p_note)` | 管理者のみ | UID を指定して `admin_users` に追加。存在しない UID は `23503` |
| `admin_revoke(p_user_id)` | 管理者のみ | 解除。最後の1人は `23514` で拒否 |
| `admin_claim_first()` | ログイン済み本人 | `admin_users` が空のときだけ自分を最初の管理者にする（メールの insert が使えない LINE ユーザー向けのブートストラップ）。既に管理者がいれば `false` |
| `announcements` | `id`, `title`(120), `body`(4000), `level`(info/warning/success), `pinned`, `published_at`, `expires_at`, `created_by`, 日時 | anon / authenticated は**公開期間内のみ** SELECT。管理者は全件の SELECT/INSERT/UPDATE/DELETE |
| `feedback` | `id`, `category`(opinion/request/bug/praise/other), `body`(2000), `rating`(1〜5), `page`, `subject`, `user_id`, `contact`, `client_token`, `status`(new/reading/done/archived), `admin_note`, 日時 | 管理者のみ SELECT/UPDATE/DELETE。**直接 INSERT は不可**で、投稿は `submit_feedback()` RPC 経由 |

#### 模試の公開スケジュール RPC `get_mock_exam_schedule()`

`security definer`（`mock_exams` の RLS を変えずに未ログインへスケジュールを公開）。`grant execute ... to anon, authenticated`。

- 返す列: `id`, `title`, `subject`, `range_label`, `question_ids`, `expected_rates`, `question_count`, `start_at`, `end_at`, `duration_sec`（新しい順に最大 30 件）。
- `question_ids` / `expected_rates` は **受験時間枠内（`start_at <= now() <= end_at`）だけ**返し、開始前のネタバレを防ぐ。問題数は常に `question_count` で返す。
- 未適用のプロジェクトでは RPC が `PGRST202` を返し、フロントはログイン時の `mock_exams` 直接 SELECT → オフライン練習模試の順にフォールバックする。

#### 模試の集計 RPC `get_mock_exam_report(p_exam_id uuid)`

`security definer`（他ユーザーの生データは返さない）。`is_late = false` の提出だけを正規受験として集計する。

- `stats`: `n`（正規受験者数）, `n_all`, `n_late`, `mean`, `trimmed_mean`, `theory_mean`, `hybrid_mean`, `sd_sample`, `sd_effective`, `provisional`。
- `me`: 自分の `result` / `rank` / `percentile` / `deviation`。
- `groups`: 自分の各志望 `groupId` ごとの `applicants`, `avgScore`, `myRank`, `percentileWithin`, `unit`, `unitLabel`, `provisional`。母数 < 5 なら「同tier」→「同category」→「全体」へフォールバックし、`unitLabel` に集計単位を明示。
- `allGroups`: エントリー済みの全大学×文理群の志望者数・平均・最高点（終了後の目安一覧）。

**ハイブリッド偏差値の計算**（少人数のブレ対策）:

1. 理論平均 = Σ `expected_rates`（SQL では未設定・不正値を 0.55 で補完。RPC が使えないときのフロント参考値では `wordStats` の正答率を使い、なければ 0.55）。
2. 標本平均は N ≥ 8 のとき上下10%を除いたトリム平均。
3. ハイブリッド平均 μ = w·標本平均 + (1−w)·理論平均（w = N / (N + 8)）。
4. 標準偏差は 標本SD と 理論SD = √(n·p̄·(1−p̄)) を同じ重みで混合し、下限 `max(total×0.06, 2.0)`・上限 `max(total×0.35, 下限)` でクリップ。
5. 偏差値 = clamp(50 + 10·(得点−μ)/SD_eff, 25, 75)。
6. N < 5 は `provisional = true`（暫定・参考値）。

`supabase/schema.sql` には動作確認用にサンプル開催回（`00000000-0000-4000-8000-000000000001`、ID 1〜50・50問・25分）を `on conflict do nothing` で入れてある。日時はインストール時からの相対（開始 +1日 / 終了 +14日）なので、本番では適宜差し替える。

- `(least(requester_id, addressee_id), greatest(...))` のユニークインデックスで双方向の重複を防止。
- `auth.users` の INSERT トリガー `leap_handle_new_user()` がプロフィールとフレンドコードを自動作成。
- フレンドコード生成は `leap_new_friend_code()`（`LEAP-` + 英数字4桁、衝突回避ループ）。
- クライアント側でもプロフィールが無い場合に作成するフォールバックあり。
- 詳細ログの非公開はアプリ側の表示制御（RLS はフレンドに `user_progress` 全体を許可するため、機密度が高い拡張をする場合はビュー／RPC 化を検討）。

### 12.6 意見箱・お知らせ・管理ダッシュボード（Phase 1）

#### 公開側（`index.html`）

- **お知らせ**: ホーム上部に公開期間内の最新2件を表示（`pinned` → `published_at` の順）。「すべて見る」で `announcements-modal` に全件表示。未読は `LEAP_ANNOUNCEMENTS_SEEN_V1` で管理し、NEW バッジを出す。**Supabase 未設定時・取得失敗時は何も表示しない**（静的フォールバックなし）。
- **意見箱**: ホーム下部・設定シート・模試成績表の3か所から `feedback-modal` を開く。種別（感想/要望/不具合/称賛/その他）、本文（最大2,000字）、★1〜5（任意）、連絡先（任意）、自動添付（表示中の画面名・教科・UA）。下書きは `LEAP_FEEDBACK_DRAFT_V1` に保存。
- **未ログインでも投稿可**。未設定・オフライン時は送信ボタンを案内に切り替え、「文面をコピー」で定型文をクリップボードへ。
- 投稿は `rpc("submit_feedback", ...)` を呼ぶだけ。テーブルへの直接 INSERT 権限は anon に与えない。
- **管理者向けの未対応通知**: ホームの `#home-admin-feedback` に、`feedback` の `status in ('new', 'reading')` 件数を表示する（`renderAdminFeedbackNotice`）。`feedback` の SELECT は `is_admin()` の RLS しか通らないため、**管理者以外は 0 件＝バナー非表示**（専用 RPC なし・件数のみ）。ログイン／同期時（`renderCloudAccount`）とホーム表示時（`navigate`）に更新し、「開く」で `./admin.html#feedback`（管理画面の意見箱タブ）へ遷移する（`applyHashTab`）。

#### 投稿 RPC `submit_feedback(p_category, p_body, p_rating, p_page, p_subject, p_contact, p_client_token, p_honeypot)`

`security definer`。戻り値は `{ ok: true }` または `{ ok: false, error }`。

| 検証 | 内容 |
|---|---|
| 本文 | 1〜2,000文字（trim 後）。空は `empty`、超過は `too_long` |
| 種別 | 5種以外は `other` に丸める |
| 評価 | `null` または 1〜5（範囲外は `bad_rating`） |
| ハニーポット | `p_honeypot` に値があれば**保存せず** `{ ok: true }` を返す（ボットに検知させない） |
| レート制限 | 同一 `client_token` で 5件/時、ログイン済みは `user_id` で 10件/時。超過は `rate_limited` |
| 列の上限 | `page` 120字 / `subject` 20字 / `contact` 200字に切り詰め |

#### 管理画面（`admin.html` ＋ `js/admin.js`）

- `noindex, nofollow`。`sw.js` は `admin.html` と `js/admin.js` を Network-First（オンライン時は常に最新、オフライン時のみキャッシュ）にし、古い JS が新しい HTML と組み合わさってタブが無反応になるのを防ぐ。`admin.html` 側でも `js/admin.js?v=<APP_VER>` としてブラウザキャッシュを回避する。
- Supabase Auth（**メール＋パスワード**または**LINE**）でログイン → `rpc("is_admin")` が `true` のときだけ画面を表示。権限がない場合はサインアウトせず、「初回セットアップ: このアカウントを最初の管理者にする」（`admin_claim_first`）を表示する。フロント側のパスワード判定は行わない。
- **👤 管理者タブ**: `admin_list_members` でユーザーを検索（UID・メール・表示名）し、その場で付与／解除できる。LINE ユーザーは「LINE」バッジと「メールなし」表示になり、UID をコピーして共有できる。UID を直接入力して付与する欄もある（Supabase Dashboard で確認した UUID 用）。
- **模試管理**:
  - **新規模試作成**: タイトル、科目（LEAP/古文）、出題範囲プリセット（全範囲/Part 1〜2/Part 3〜4/Part別）、問題数（25/50/100問）、単語の自動抽出（シャッフル＋ソート、理論正答率 `expected_rates` 自動生成）、開催開始・終了日時、制限時間（15〜40分）を設定して公開。既存模試の編集・削除も可能。
  - **模試一覧＆過去成績アーカイブ**: 開催前・開催中・終了済みの模試一覧。エントリー数、受験者数（提出総数・正規受験・遅延受験）、平均点（正答率）、最高点/最低点、平均所要時間を集約表示。
  - **受験者一覧・成績詳細**: 模試ごとの受験者詳細アコーディオン。表示名・フレンドコード・得点・正答率・所要時間・提出日時・区分（正規/遅延）を一覧表示。
- **お知らせ**: 作成・編集・削除、種別、ピン留め、公開日時（未来＝公開予約）、掲載終了日時。公開中／公開予定／掲載終了を一覧に表示。
- **意見箱**: 全件（最大300件）を新しい順に表示。種別・状態・キーワードで絞り込み、状態（新規/確認中/対応済み/アーカイブ）と管理メモを保存。管理メモはユーザーには公開されない。
- 破壊的操作（削除）は画面内の確認ダイアログを挟む。

#### 管理者アカウントの作成

`admin.html` は**メール＋パスワード**と**LINE**の両方でログインできる。管理者にする人は、事前にアプリ（または管理画面）へ一度ログインして `auth.users` に行がある状態にしておく。

- 最初の1人: `supabase/admin_roles.sql` を実行したうえで `admin.html` にログインし、「初回セットアップ: このアカウントを最初の管理者にする」を押す（`admin_users` が空のときだけ成功する）。
- 2人目以降: 既存の管理者が「👤 管理者」タブで UID・メール・表示名を検索して付与する。LINE ユーザーはメールアドレスを持たないため、**UID か表示名で付与する**（メールでの `insert ... where email = ...` は 0 行になる）。

1. Supabase Dashboard 左メニューの **Authentication** を開く。
2. 上部タブの **Users** を開く。
3. 右上の **Add user**（または **Create user**）→ **Create new user** を選ぶ。
4. 次を入力して作成する。
   - **Email** … 管理者のメールアドレス（例: `admin@example.com`）
   - **Password** … 管理者パスワード（6文字以上。ここで決めた値を `admin.html` のログインで使う）
   - **Auto Confirm User**（または **Auto Confirm User?**）… **ON**
     - OFF のままだと「Email not confirmed」でログインできない。ON を忘れた場合は Users 一覧のユーザー詳細から確認（Confirm）する。
5. 作成後、**Users 一覧に表示されるそのユーザーの UID（UUID）をコピー**する。
   - 一覧のユーザーをクリックすると詳細に `User UID` が表示される。
6. SQL Editor で、その UID を許可リスト `admin_users` に追加する。

   ```sql
   -- UID を直接指定（LINE ユーザーなどメールが無い場合もこれを使う）
   insert into public.admin_users (user_id)
   values ('ここにUID')
   on conflict (user_id) do nothing;

   -- メールアドレスから追加（メールを持つアカウントのみ）
   -- insert into public.admin_users (user_id)
   -- select id from auth.users where email = 'admin@example.com';
   ```

   `supabase/admin_roles.sql` を実行済みなら、SQL を書かずに管理画面の「👤 管理者」タブから付与するのが簡単。

7. 登録できたか確認する。

   ```sql
   select u.email, a.user_id, a.created_at
     from public.admin_users a
     join auth.users u on u.id = a.user_id;
   ```

8. `admin.html` を開き、手順4のメールアドレスとパスワードでログインする。

**つまずきやすい点**

- `insert` したのに 0 行 → メールアドレスの綴り・大文字小文字が違う。`select id, email from auth.users;` で実際の値を確認する。
- `violates foreign key constraint` → `admin_users` は `auth.users` にしか追加できない。先に手順3でユーザーを作る（`profiles` ではない）。
- 「メールアドレスまたはパスワードが違います」→ パスワード誤り、またはメール未確認。Users で確認状態を見る。
- 「このアカウントには管理者権限がありません」→ 手順6の `insert` が未実行、または UID が別ユーザーのもの。手順7で確認する。
- 既存の Google / LINE アカウントを管理者にしたい場合は、その UID を `admin_users` に入れれば権限は付く。`admin.html` にも LINE ログインボタンがあるため、同じ LINE アカウントで管理画面に入れる（初回は Supabase の Redirect URLs に `admin.html` の URL を含めること）。
- LINE ユーザーをメールで追加しようとして 0 行になる → LINE は `auth.users.email` が NULL。UID 指定か「👤 管理者」タブを使う。

> パスワードはリポジトリ・`supabase_config.js`・チャットに書かない。`admin_users` から行を消せば即座に権限を失う。

> **デッドロック（40P01）が出たとき**: 稼働中のアプリが `profiles` などを読み、`schema.sql` 全体の `alter table` / ポリシー再作成とロックを奪い合うと発生する。デッドロックしたトランザクションは全ロールバックされるので、アプリのタブを閉じて書き込みを止め、`migration_community.sql`（Phase 1 追加分のみ）を実行し直せばよい。

> **`column "pinned" does not exist` が出たとき**: 以前の実行が途中で止まって `announcements` / `feedback` が古い定義のまま残っている。移行SQLは `create table if not exists` の後に `add column if not exists` で不足列を補修してから索引・ポリシーを作るため、テーブルを削除せずにそのまま再実行してよい。

### 12.7 セットアップ手順（要約）

詳細・画面ごとの操作・トラブルシューティングは **`docs/SUPABASE_SETUP.md`** に集約している。

1. Supabase でプロジェクト作成 → **SQL Editor** で `supabase/schema.sql` を実行。
   **既存プロジェクトに Phase 1 だけを追加する場合は、`schema.sql` 全体ではなく `supabase/migration_community.sql` を実行する**（既存テーブルのロックを取らず、デッドロックを避けられる）。
2. **Project Settings → API** の Project URL と anon / publishable key を **`supabase_config.js`** に設定（`index.html` と `admin.html` が共有。`service_role` は使わない）。
3. **Authentication → URL Configuration** に Site URL（本番）と Redirect URLs（`https://本番/**`, `https://*.vercel.app/**`, `http://localhost:8000/**`）を登録。
4. **Authentication → Sign In / Providers → Google** を有効化。Google Cloud の OAuth クライアント（Web）で Authorized redirect URI に `https://<project-ref>.supabase.co/auth/v1/callback` を登録し、Client ID / Secret を貼る。
5. **LINE ログイン**: LINE Developers で「LINE ログイン」チャネル（ウェブアプリ）を作成し、コールバック URL に Supabase の Callback URL を登録。Supabase の **Custom OAuth Providers → New Provider → Manual** で以下を作成する。

   | 項目 | 値 |
   |---|---|
   | Identifier | `custom:line` |
   | Authorization URL | `https://access.line.me/oauth2/v2.1/authorize` |
   | Token URL | `https://api.line.me/oauth2/v2.1/token` |
   | UserInfo URL | `https://api.line.me/oauth2/v2.1/userinfo` |
   | Scopes | `openid profile`（メール取得承認済みなら `email` も） |
   | Allow users without email | ON |

   ※ LINE の Web ログインは ID Token が HS256 のため OIDC 自動 discovery では検証に失敗する。必ず Manual 構成にする。
6. 管理者を使う場合は `supabase/admin_roles.sql` を実行し、§12.6 の手順で `admin_users` に UID を追加する（LINE ユーザーはメールではなく UID で追加）。
7. `APP_VER` / `sw.js` の `CACHE` を更新してデプロイ。

---

## 13. ファイル構成

```
/
├── index.html                 アプリ本体（HTML + マークアップ + アプリ本体のインライン JS）
├── admin.html                 管理者ダッシュボード（noindex・ログイン／お知らせ／御意見）
├── supabase_config.js        Supabase の公開設定（index.html と admin.html で共有）
├── js/
│   ├── core.js               アプリ基盤（称号・アイテムのマスタ、ゾーン、画面遷移、確認ダイアログ、escapeHtml）
│   ├── mock-exam.js          全国一斉模試（スケジュール・エントリー・受験・成績表・共有リンク・端末内保存）
│   ├── cloud-merge.js        苦手単語・克服記録のマージ規則（DOM 非依存）
│   ├── cloud-sync.js         Supabase 認証・クラウド同期・フレンド・共有・お知らせ／意見箱（クライアント側）
│   ├── quiz-resume.js        「つづきから」の保存データ（形式・検証・上書き可否）を扱う DOM 非依存モジュール
│   ├── quiz-engine.js        出題エンジン（範囲・Part選択、クイズ本体、採点、タイマー、到達度テスト、デイリーチャレンジ、忘却曲線、学習記録の集計）
│   ├── ui-stats-dict.js      単語辞典・単語詳細・参考資料・実績・ショップの描画と操作
│   ├── dict-book.js          単語辞典の本誌ビュー（見開き・ページめくり）
│   ├── notification.js       学習リマインダー通知（Web Notification・定期チェック・権限管理）
│   └── admin.js              管理画面のロジック（Auth・announcements・feedback）
├── assets/
│   └── css/app.css            アプリ固有 CSS（旧 index.html 内の <style> ほか）
├── manifest.json              PWA マニフェスト
├── sw.js                      Service Worker（キャッシュ leap-v76 / Network-First）
├── words_data.js              LEAP_WORDS_DATA（2,300語）
├── examples_data.js           LEAP_WORD_DETAILS（2,300語）+ LEAP_EXAMPLE_DATA（2,000語）
├── reference_data.js          LEAP_REFERENCE_DATA（5章）
├── affix_data.js              AFFIX_DATA（接頭辞16 + 接尾辞16、132語根）
├── mock_schools_data.js       MOCK_UNIV_GROUPS / MOCK_FACULTIES（全国一斉模試の志望校マスタ）
├── difficulty_data.js         LEAP_DIFFICULTY（Part 別の難易度 b・個別上書き）
├── updates_data.js            LEAP_UPDATES（アプリ内「アップデート情報」の履歴）
├── kobun/
│   ├── kobun_words_data.js    KOBUN_WORDS_DATA（150語）+ KOBUN_PARTS
│   ├── kobun_details_data.js  KOBUN_WORD_DETAILS（150語・例文354件。build_kobun_details.js の生成物）
│   ├── kobun_config.js        未使用の設定足場（enabled=false）
│   └── kobun_loader.js        未使用の統合ヘルパー（window.KOBUN）
├── tests/
│   ├── resume.test.js        「つづきから」の保存・検証・上書き可否の単体テスト
│   └── cloud-merge.test.js   苦手単語・克服記録のクラウド統合の単体テスト
├── docs/
│   ├── 古文単語330_追加構想.md  古文5章330語の設計・実装手順メモ
│   ├── SUPABASE_SETUP.md      Supabase / Google / LINE ログインの詳細設定手順
│   └── ファイル分割計画.md    index.html を段階分割する手順（模試・クラウドの分離まで完了）
├── LEAP単語データ/
│   ├── 001_101.txt … 2001_2300.txt   元テキスト（語義・IPA・コラム）
├── 古文単語データ/
│   ├── 001_015.txt … 126_150.txt     元テキスト（見出し・訳語・解説・入試・関連・例文）
│   ├── code_artifact.txt             参考資料の元テキスト
│   └── words.json                    英単語 JSON
├── supabase/
│   ├── schema.sql             Supabase のテーブル・RLS・トリガー（新規プロジェクトはこれを実行）
│   ├── migration_community.sql  既存プロジェクト向け Phase 1 追加分のみの移行SQL
│   └── migration_mock_public.sql  模試の公開スケジュールRPC（未ログイン受験用）
├── patches/                   データ生成・一括改修スクリプト（開発用、実行は任意）
├── favicon.png / icon.svg / icon-192.png / icon-512.png / apple-touch-icon.png
└── SERVICE.md                 このファイル（サービス全体仕様・更新履歴）
```

### `patches/` の役割

| ファイル | 役割 |
|---|---|
| `build_leap_data.js` | `LEAP単語データ/*.txt` → `words_data.js` / `examples_data.js` を生成するビルドスクリプト（`node patches/build_leap_data.js`） |
| `analyze_ja_highlight.js` | 例文和訳のハイライト崩れ（和訳全体が強調される例）を検出 |
| `ja_highlight_overrides.json` | 上記の手動補正データ |
| `alert_to_dialog.py` | `alert()` をサイト内ダイアログへ置換 |
| `site_confirm_dialog.py` / `shop_confirm.py` | 確認ダイアログ導入・ショップ購入確認 |
| `dark_contrast_fix.py` | ダークモードのコントラスト一括調整 |
| `learning_status_filter.py` | 学習状況フィルタ（未学習/苦手/学習中/マスター）導入 |
| `multifilter_zone_achievements.py` | 辞典の複数選択フィルタ・ゾーン対応・実績追加 |
| `kobun_zone.py` | 古文ゾーン導入 |
| `zone_tts_weak_fix.py` | ゾーン別読み上げ・苦手リスト調整 |

> これらは過去の一括改修を再現するための記録。**現在の `index.html` に再度流すと二重適用になる**ため、通常は実行しない。

---

## 14. 開発・確認手順

```bash
# 依存パッケージなし。静的配信のみ。
python3 -m http.server 8000        # または任意の静的サーバー
# → http://localhost:8000/

# データ再生成（元テキストを変えた場合）
node patches/build_leap_data.js

# ロジックの単体テスト（依存パッケージなし）
node tests/resume.test.js       # つづきからの保存・上書き可否
node tests/cloud-merge.test.js  # 苦手単語・克服記録のクラウド統合
```

- 動作確認の観点: ホーム表示 → 範囲選択 → クイズ → 結果 → 辞典 → ショップ → 実績 → ダークモード → リロード後も進捗保持 → オフライン再訪。
- `localStorage` を消せば初期状態に戻る（実機ではサイトデータ削除）。
- Service Worker の更新が絡むため、変更確認時はハードリロードまたは `CACHE`/`APP_VER` の更新を行う。

### データを追加するとき

1. 英単語: `LEAP単語データ/` の元テキストを更新 → `node patches/build_leap_data.js` → `words_data.js` / `examples_data.js` を差し替え。Part 範囲を超える場合は `LEAP_PARTS` とカスタム範囲の `max` も更新。
2. 古文: `古文単語データ/*.txt` を更新 → `node patches/build_kobun_details.js` → `kobun/kobun_details_data.js` を差し替え。語を増やす場合は `kobun/kobun_words_data.js` に追記（`id = 10000 + 冊内番号`、`part` は章）し、`KOBUN_PARTS` も更新。
3. 接辞: `affix_data.js` にグループ追加（`affix`, `meaning`, `note`, `roots[]`）。
4. 参考資料: `reference_data.js` に章追加（`title`, `subtitle`, `words`, `blocks`）。
5. いずれも `sw.js` の `ASSETS` と `CACHE` 名、`index.html` の `APP_VER` を更新し、**この SERVICE.md を更新**する。

---

## 15. 既知の制約・注意点

- **クラウドは任意**。`supabase_config.js` 未設定なら端末間同期・フレンド・お知らせ・意見箱の送信は使えない（localStorage のみ）。設定してもログインしなければ従来どおり。
- **localStorage を消すと未同期の進捗は消える**（手動エクスポート機能はなし）。ログイン済みならクラウドから復元できる。
- **Supabase の通信は Service Worker でキャッシュしない**（Network-Only）。オフライン中の同期は失敗し、次回オンライン時の操作で再送される。
- **LINE ログインは追加設定が必要**。Supabase に `custom:line` の Custom OAuth Provider を作らないとボタンからログインできない（未設定時はエラーダイアログで案内）。
- 詳細ログの非公開（`share_detailed_logs`）はアプリ側の表示制御。RLS は承認済みフレンドに `user_progress` 全体を許可する。
- `index.html` のインライン JS は `js/core.js` → `js/mock-exam.js` → `js/cloud-sync.js` → `js/quiz-engine.js` → `js/ui-stats-dict.js` の後に実行される。**トップレベルの宣言名をファイル間で重複させない**（クラシックスクリプトのため `const` 重複は全画面停止につながる）。分割時は `^ {4}(function|const|let|var)` の宣言名を全ファイルで突き合わせて確認する。
- 設定シート（`settings-modal`）の「データ」欄に **JSON エクスポート／インポート**を追加。`LEAP_` で始まる保存キーだけを `{ app: "LEAP_QUIZ_BACKUP", appVer, exportedAt, keys }` 形式で書き出し、復元は `showConfirm` の確認後に同じキーだけを上書きして再読み込みする（Supabase の認証トークンは対象外）。
- 設定シートの「🔧 詳細・診断情報」（`details#system-diag`）は、アプリ版、localStorage のキー数と使用量、クラウド接続・同期状態、対象ゾーンの収録語数、Part 別語数、SW キャッシュ名を表示する（`renderSystemDiagnostics`、開いたときに再計算）。
- **例文クイズは ID 1〜2000 のみ**（2001〜2300 は語義4択のみ）。
- **古文は 150 語（2章）まで**。330 語構想の 3〜5 章はデータ未投入で、出題範囲に「COMING SOON／今後追加予定」の枠のみ表示（選択不可）。
- **古文の例文は元テキスト由来**で、OCR 崩れに由来する欠損・表記ゆれが一部残る（各ファイル冒頭の「OCR判読不能・要確認ログ」に一覧あり）。例文の空所は原文の `【…】` に依存するため、`【】` が無い例文は `answer` が空になりクイズ対象外になる（該当語は語義→古語の出題にフォールバック）。
- `kobun/kobun_config.js` / `kobun_loader.js` は未使用。設定を変えても現行 `index.html` には影響しない。
- **リーダー（`screen-reader`）は UI 入口なし**。コードは残存。
- 参考資料の第5部クイズは採点・保存なし（学習補助の読み物）。
- 外部 CDN（Tailwind / html2canvas / Google Fonts）に依存。オフライン時はキャッシュ済みの範囲で動作するが、初回はオンラインが必要。
- 共有 URL は Base64 化した結果情報のみ（個人情報・進捗は含まない）。
- **全国一斉模試の受験はログイン不要**。未ログインの結果は端末（`LEAP_MOCK_LOCAL_RESULTS_V1`）に保存し、ログイン後に全国集計へ提出できる。全国**順位**だけが Supabase ＋ ログインを必要とする（偏差値・志望校判定は難易度モデルで端末内でも算出）。Supabase 未設定時は「いつでも実力診断模試」を表示する。
- 模試の偏差値は難易度（Part）つきの 3PL/EAP で推定する。**受験者0人でも偏差値は出る**が、1回の結果は信頼区間が広い（30問で ±10 程度）。判定は区間の下限を使うため、1回の高得点で A 判定にはなりにくい。
- `mock_exams.question_levels`（Part 1..5）が未設定の回は従来の素点式（25〜75）で集計する。管理画面（`admin.html`）で模試を保存すると `question_ids` の単語から自動で入る。`mock_exam_results` は 1 人 1 回（`(exam_id, user_id)` unique）で、再受験分は保存されない（画面では参考表示）。
- 模試の開催回は `mock_exams` に手動で追加する（`question_ids` と `expected_rates` を同じ並びで指定）。`schema.sql` のサンプルはインストール時の相対日時。
- 模試の志望校マスタを変更したら `mock_schools_data.js` と `sw.js` の `ASSETS`／`CACHE`、`APP_VER` を更新する。
- **お知らせは Supabase 未設定時に表示されない**（静的フォールバックを置かない方針）。`announcements` を取得できない場合もホームは静かに非表示になる。
- **意見箱は匿名投稿できる**ため、スパム対策は `submit_feedback()` のハニーポットとレート制限（同一端末 5件/時・ログイン済み 10件/時）のみ。IP 制限は行っていない。
- 旧サービスと `announcements` テーブルを共用している。旧サービスは `content` 列を使い `body` が空になるため、公開側・管理画面の取得とも `body is not null` で絞り込み、旧サービスのお知らせを表示・編集対象にしない。
- **管理画面は別ページ（`admin.html`）で、SW キャッシュ対象外**。`admin_users` に UID がないアカウントはログイン直後にサインアウトされる。
- `supabase_config.js` の anon / publishable key は公開前提。**service_role キーを書かない**（全 RLS を迂回できてしまう）。
- 古文の `meaning` は「、」区切りの現代語訳で、複数語義の整形はデータ側の表記に依存。

---

## 16. 更新履歴

> ここに**日付・変更内容**を追記していく。新しいものが上。

| 日付 | 変更内容 |
|---|---|
| 2026-11-28 | 🔔 **学習リマインダー通知**（ブラウザ経由の Web Notification API / Service Worker `showNotification`）を追加（`js/notification.js`）。①設定モーダル（`#settings-modal`）に「🔔 学習リマインダー通知」を追加し、専用設定モーダル（`#notification-modal`）で通知権限の許可リクエスト、毎日の通知時刻（`<input type="time">`、初期値 `20:00`）、忘却曲線の復習対象通知・連続記録（ストリーク維持）通知の ON/OFF、即時テスト通知を操作可能にした。②アプリ起動中およびバックグラウンド時に定期チェックを行い、設定時刻に未学習かつ同日未通知（`LEAP_NOTIF_LAST_DATE`）であれば通知を発行。③Service Worker（`sw.js`）に `notificationclick` を追加し、通知タップ時にアプリへフォーカスまたは起動。④単体テスト `tests/notification.test.js`（6件）を追加。`APP_VER=leap-v53-notification-reminder` / `CACHE=leap-v76`。|
| 2026-11-28 | 📖 単語辞典の**本誌ビューを見開きレイアウトに刷新**（`js/dict-book.js` 再設計）。LEAP本誌の見開きを忠実に再現：見開き1組＝左4語/右4語、1語＝本誌1エントリを3カラム（左＝淡い青のパネルに番号・見出し語・IPA・品詞、中＝品詞の赤い小枠＋語義①〜（赤）・▸付きメモ、右＝①②の例文と訳、`【…】` を赤太字）で表示。赤いリボンのセクション見出し・右ページの running head（`Active Vocabulary（基幹語）`）・外側下のノンブル・右端の Part 縦タブを追加。前後の見開きへ「ページをめくる」（ボタン／スワイプ／←→キー、`flip-next`/`flip-prev`）。768px未満は縦積み、ダークモードでも紙面は明るいまま。古文単語は対象外。`APP_VER=leap-v52-dict-book-spread` / `CACHE=leap-v75`。|
| 2026-11-28 | 📖 単語辞典に**本誌ビュー**を追加（`js/dict-book.js`）。LEAP本誌の見開き風に、左ページへ見出し語・発音記号・語義・頻出/派生メモ、右ページへ例文と訳を表示し、前後の単語へ「ページをめくる」ように移動できる（ボタン／スワイプ／←→キー、`flip-next`/`flip-prev` の CSS アニメーション）。辞典ヘッダーの「📖 本誌」と単語詳細の「📖 本誌ビュー」から開く。768px未満は縦積み、ダークモードでも紙面は明るいまま。`APP_VER=leap-v50-dict-book` / `CACHE=leap-v73`。|
| 2026-11-28 | 🎯 志望校ロードマップの設定を作り直し。①**志望校選択**: datalist をやめ、入力に合わせて絞り込むタップ選択リスト（最大40件・難易度ラベル付き）に変更。一覧に無い場合はそのまま入力で自由登録。②**試験日**: 学年（高1/高2/高3/既卒）と入試区分（私大一般 2/1・国公立2次 2/25）を選ぶと一般的な試験日を自動設定（`LeapRoadmapPlan.defaultExamDate`）。日付は個別に上書きでき、`grade` / `examType` も `userData.roadmap` に保存。③**逆算プラン**: 差し引く対象を「学習済み」から**マスター済み**（3回以上正解かつ正答率90%以上＝`getWordStatus`）に変更し、1日の新規語数・Part期限・進捗バー・ホームカードの表示もマスター基準に統一。④単体テストに試験日算出のケースを追加（`tests/roadmap.test.js` 11件）。`APP_VER=leap-v49-roadmap-ux` / `CACHE=leap-v72`。|
| 2026-11-28 | 📐 ホームの準メニューを3列のコンパクトタイルに集約。前回追加したショップ・実績を含む6項目（到達度テスト・全国模試・学習記録・語源ラッシュ・ショップ・実績）を `grid-cols-3` の低いタイル（アイコン＋ラベル＋9pxの補足）に変更し、2列カード3段→3列2段にしてホームの縦の長さを削減した（補足の文言は維持しつつ、320px 幅で溢れる文言は短縮）。見出しも実態に合わせて「もっと学ぶ」→「メニュー」に変更。タイルの見た目は `assets/css/app.css` の `.menu-tile`（`--icon` / `--label` / `--sub` / `--shop` / `--row`、ダークモード対応）に集約し、HTML 側はクラス 1 つで書けるようにした。`APP_VER=leap-v48-home-compact` / `CACHE=leap-v71`。|
| 2026-11-28 | 🏠 準メニュー（ショップ等）を上層に移動。①「📚 ほかのメニュー」の折りたたみを廃止し、`#home-more-menu` として常時表示に変更。到達度テスト・全国一斉模試・学習記録・語源ラッシュに加えて、**ショップ**と**実績**を2列カードで追加した。②ヘッダーのコイン表示をボタン化（`#header-coins-btn`）し、タップで `screen-shop` を開けるようにした（PC幅では「ショップ」ラベル付き）。③設定シート内のショップ導線は残す。`APP_VER=leap-v47-home-menu` / `CACHE=leap-v69`。|
| 2026-11-28 | 📣 アップデート情報の閲覧と、管理者向けの未対応意見通知を追加。①`updates_data.js`（`LEAP_UPDATES`）に**利用者向け**の更新履歴を持たせ、ホーム下部・設定から開ける `updates-modal` で表示（タグ・version・日付・箇条書き。先頭に「最新」）。未読は `LEAP_UPDATES_SEEN_V1` と比較して NEW バッジを出す。②ホームに `#home-admin-feedback` を追加し、ログイン中の管理者に限り `feedback` の未対応（`new`/`reading`）件数を表示。`feedback` の SELECT は `is_admin()` の RLS しか通らないため、**非管理者は 0 件で非表示**（専用RPC・スキーマ変更なし）。ログイン/同期時とホーム表示時に更新し、「開く」で `admin.html#feedback` の意見箱タブを直接開く（`applyHashTab`）。`APP_VER=leap-v46-updates-admin-notice` / `CACHE=leap-v68`。|
| 2026-11-28 | 🔤 忘却曲線クイズで発音記号が出ない問題を修正。①原因は復習プールが `weakWords` の保存レコード（`id/word/meaning` のみ）で、`detail.ipa` を持たないまま出題していたこと。`startWeakWordsQuiz` で出題時に `ALL_WORDS` の単語オブジェクトへ置き換えるようにした（発音記号・品詞・例文も通常クイズと同じになる）。②`wordIpa(w)` を追加し、`detail.ipa` → `w.ipa` → `LEAP_WORD_DETAILS[id].ipa` の順にフォールバック（詳細未展開の単語でも表示）。`applyWordIpa` もこれを使う。③苦手単語一覧（モーダル）と結果画面の誤答一覧にも発音記号を表示。`APP_VER=leap-v45-weak-ipa` / `CACHE=leap-v67`。|
| 2026-11-28 | 🏫 模試の採点を難易度ベースに作り直し、志望校ロードマップとログイン導線を追加。①**難易度タグ**: `difficulty_data.js` に Part ごとの困難度（Part 1–5 を個別に設定）を持たせ、単語は Part から難易度を引く（`LEAP_DIFFICULTY.words` で語ごとの上書き可）。②**偏差値**: 素点＋理論平均のブレンドをやめ、4択の当て推量 c=0.25 を考慮した **3PL + EAP**（`js/mock-score.js`、事前分布 N(0,1)・θ を0.1刻み）で能力推定し `50+10θ`。Part 1 だけ全問正解しても 75 に張り付かず（30問全正解 → 62.8、目安 51–74）、発展語を取ると上がる。受験者0人でも算出できるので母数不足でも偏差値が出る。③**判定**: 事後 SD の90%区間を出し、**下限**で tier 別 A〜D を判定（`LeapMockScore.judgeTier`）。N<5 でもモデル推定があれば暫定扱いにしない。④**DB**: `mock_exams.question_levels` と `mock_ability_deviation()` を追加し、RPC の偏差値を差し替え（未設定回は従来式へフォールバック）。`supabase/migration_mock_difficulty.sql` を同梱。⑤**ロードマップ**: 志望校＋試験日から1日の語数と Part ごとの期限を逆算（`js/roadmap.js` / `LeapRoadmapPlan`）。ホーム常設カード＋`screen-roadmap` を追加し、今日の目標リングをノルマに連動。⑥**ログイン導線**: ホームのプレイヤーカード・設定の先頭・初回ガイド3・模試の成績表／案内にログインボタンを追加。⑦「いつでも実力診断模試」を Part 均等の30問にし、偏差値・志望校判定の目安を端末内で表示。⑧単体テスト `tests/mock-score.test.js`（12件）・`tests/roadmap.test.js`（10件）を追加。`APP_VER=leap-v44-mock-difficulty-roadmap` / `CACHE=leap-v66`。|
| 2026-11-28 | ☁️ 忘却曲線（苦手単語）のクラウド同期を修正。①統合ルールが `nextReview` の**早い方**を採用していたため、スマホで復習を進めても PC 側の古いデータとのマージで期日が巻き戻り、「本日復習」が消えなかった。**`lastReviewed` が新しい方を正**とするルールに変更（同日なら stage → nextReview の遅い方、`count` は多い方）。②ステージ4クリアで苦手から削除すると他端末の古いデータから復活していたため、`graduatedWords`（克服日の記録）を追加。③`cloudPush()` が書き込み前にクラウドの更新を確認し、**他端末が新しければ先に取り込んで統合**するようにした（古いローカルで上書きしない）。マージ規則は `js/cloud-merge.js` に切り出し、`tests/cloud-merge.test.js`（10ケース）を追加。`APP_VER=leap-v43-cloud-weak-merge` / `CACHE=leap-v65`。|
| 2026-11-28 | ⏯ 「つづきから」の保存の取り扱いを修正。①以前は**新しいクイズを開始した瞬間に保存を削除**しており、別の範囲を試しただけで前回の続きが黙って消えていた。これをやめ、**上書きは2問目以降に進んだときだけ**（`LeapQuizResume.canOverwrite`）にした。②完走／中断時も**そのクイズの保存だけ**を消すようにし（`clearResumeStateIfCurrent` / `matchesQuiz`）、1問だけの別クイズをやっても別の「つづき」が消えないようにした。③保存形式・検証を `js/quiz-resume.js` に切り出し、**依存なしで回せる単体テスト `tests/resume.test.js`（10ケース）**を追加。`APP_VER=leap-v42-resume-guard` / `CACHE=leap-v64`。|
| 2026-11-28 | 🎧 発音記号（IPA）の抜き取り校閲。①元テキスト `604_702.txt` は 615=obey / 616=resist なのに `words.json` と `words_data.js` が逆順だったため、resist の下に **obey の発音記号 `[oubéi]`** が表示されていた。番号を書籍どおり 615=obey（`[oubéi]`）/ 616=resist（`[rizíst]`）に修正（`words_data.js` / `LEAP単語データ/words.json`、`examples_data.js` の詳細は変更なしで整合）。②例文データに混入していた数学記号 **`∫`（積分記号）を `ʃ` に**（31箇所）、ギリシャ文字の混入 3 件（`conservation` / `veterinarian` / `scenario` の `έ`・`ὰ`）を修正。長音記号のゆれ（半角 `:`）を本来の **`ː`** に統一（111箇所。元テキストは 118 箇所）。③全 2,300 語の発音記号を綴り・辞書発音（CMUdict）と機械照合し、子音骨格の食い違い・重複・欠損が上記以外に無いことを確認。`APP_VER=leap-v41-ipa-proofread` / `CACHE=leap-v63`。|
| 2026-11-28 | 🧩 小粒な改善をまとめて導入。①スペル・リスニングに出題語の**文字数ヒント**（`quiz-spelling-length` / `quiz-listening-length`）。②**中断したクイズの再開**（`LEAP_QUIZ_RESUME_V1`、ホームのつづきからバナー、`resumeQuiz` / `discardResumeQuiz`）。③ホームに**今日の目標リング**（20問／日、`dailyLog` 連動、達成トースト）。④正誤の**効果音・バイブ**（`LEAP_FEEDBACK_V1`、設定でON/OFF）。⑤結果画面に**「🔥 間違えた単語だけ復習」**ボタン（`reviewResultMistakes`、誤答が無いときは非表示）。⑥**PWA更新バナー**（勝手にリロードせず「更新する」で再読み込み）。⑦ホームに**前回の到達度テストカード**（判定・正答率・もう一度）。⑧辞典に**頭文字ジャンプ**（A–Z／あ〜わ）。⑨`examples_data.js`（2MB超）を **defer 読み込み**にして初回描画をブロックしないようにし、参照側は `builtinExamples()` / `LEAP_EXAMPLES_READY` で追従。`APP_VER=leap-v40-polish-batch` / `CACHE=leap-v62`。|
| 2026-11-28 | 🔤 スペル入力のテンポ改善。出題時に `#quiz-spelling-input` を自動フォーカスし、毎問の「入力欄タップ」を省くようにした（スペルボックスの余白タップでもフォーカス）。入力欄に `lang="en"` / `autocapitalize="off"` / `enterkeyhint="go"` を付け、スマホではキーボードを英字（ABC）に切り替える旨を明記。※当初はアプリ内 QWERTY キーボードも実装したが、端末標準キーボードの方が扱いやすいため同日に廃止（`quiz-spelling-pad` / `LEAP_SPELLING_KB_V1` は現存しない）。`APP_VER=leap-v39-spelling-autofocus` / `CACHE=leap-v61`。|
| 2026-11-28 | 🏆 実績を 93 → **115** に増強し、進捗が見えるようにした。①到達度テスト・語源ラッシュ／神経衰弱・累計解答数・1日の解答数・Part 4/5 制覇・古文150語踏破などを追加（カテゴリ `exam` / `game` を新設）。②数値系の実績に `progress` / `ACHIEVEMENT_PROGRESS` を追加し、未達成の行に進捗バーと「n / m」を表示。モーダル上部に「🎯 あと少しで解除」（達成率上位3件）を追加。③初見向け UI 改善として、ホームの副次メニュー（テスト・模試・記録・語源・辞典・ご意見・設定）を「📚 ほかのメニュー」の折りたたみに移動し、ヘッダー「?」／設定／初回ガイドから開ける**使い方ガイド（`guide-modal`）**を追加。④範囲選択画面の先頭に「迷ったらそのままスタートでOK」の案内を追加。`APP_VER=leap-v38-achievements-guide` / `CACHE=leap-v60`。|
| 2026-11-27 | 📜 古文単語に例文・解説データを投入。Drive の「古文単語データ」9ファイルを `古文単語データ/` に追加し、`patches/build_kobun_details.js` で `kobun/kobun_details_data.js`（`KOBUN_WORD_DETAILS`、150語・例文354件）を生成。①辞典の詳細シートに古文情報（見出し漢字・活用/品詞・重要度）・コアイメージ・解説/入試/関連・例文（原文＋訳＋出典＋補足、`【…】` ハイライト、読み上げ）を表示。②古文の「📜 古語当て」を、実際の古典例文の空所補充クイズ「📝 例文」に置き換え（訳は出題時、原文の該当語と出典は解答後に表示。例文の無い語のみ語義→古語にフォールバック）。③古文の品詞をデータから付与し、4択のダミーを同品詞優先に。`APP_VER=leap-v37-kobun-examples` / `CACHE=leap-v59`。|
| 2026-11-27 | 📜 古文単語の学習ツールを拡充。①出題範囲に5章分の枠を作り、未収録の3〜5章（最重要敬語・入試重要語・入試攻略語）を「🔒 COMING SOON／今後追加予定」として表示（`KOBUN_PARTS` に `numStart`/`numEnd` 付きで5章定義、範囲は「単語番号」表記、章パネルに330語構想の注記）。②古文版の文脈テスト「📜 古語当て」を追加（`context` スタイルを古文では現代語訳→古語の4択として使用。出題文・マスクトの文言を古文向けに切替、ダミーは同じ意味を除外）。③辞典の古文向け表示を強化（一覧と詳細に読み・収録章・単語番号、詳細は古文情報カード＋「例文・出典は準備中」表示、例文・出典は今後追加予定）。`APP_VER=leap-v36-kobun-tools` / `CACHE=leap-v58`。|
| 2026-11-27 | 📱 スマホの最上部ヘッダーでコイン・実績・ダークモード切替が右にはみ出して見切れる問題を修正。ヘッダーを `flex-wrap` + 余白／ボタン内側のパディング縮小に変更し、狭い画面では称号チップ（`#header-title`）を `hidden sm:block` で省略。320〜390px で横スクロールなしに収まることを確認。`APP_VER=leap-v33-mobile-header` / `CACHE=leap-v54`。|
| 2026-11-27 | 📱 スマホ表示の不具合修正: 画面上部の「戻る」「中断」ボタンに `shrink-0 whitespace-nowrap` を付与し、「模試管理」リンクも折り返さないようにした。狭い画面でヘッダーの右側に押しつぶされて「戻る」が縦2文字（縦書き風）になる問題を解消。🛒 ショップの所持数バッジ（前称号／後称号／フレーム／アバター）を `renderShop()` の冒頭で全て更新するようにし、タブをタップするまで「1/◯◯」の古い分子が残る不具合を修正。あわせて HTML 初期値の分母を実際の点数（86／84／27／15）に修正。`APP_VER=leap-v32-mobile-shop-fix` / `CACHE=leap-v53`。|
| 2026-11-26 | 🏫 Phase 3（模試の振り返り）⑧: ホームに **次回模試バナー** を追加（`#home-mock-banner` / `mockRenderHomeBanner`）。開催中は「受験受付中・終了まで」、開催前は「次回の模試・開始まで」を表示し、タップで模試画面へ遷移する。候補は取得済みスケジュール→起動時の公開 RPC（`mockRefreshHomeBanner`）→リマインド設定の順で探し、60秒ごとに残り時間を更新する（練習模試は対象外）。`APP_VER=leap-v31-mock-home` / `CACHE=leap-v52`。|
| 2026-11-26 | 🎯 Phase 3（模試の振り返り）⑦: 志望校判定に **合格圏ギャップ** を追加。各志望校カードで tier 別の A 基準偏差値と現在の偏差値の差を「合格圏（A）まで あと偏差値 X」と表示する（`mockJudgeGap`、到達済みは「到達しています」）。`APP_VER=leap-v30-mock-gap` / `CACHE=leap-v51`。|
| 2026-11-26 | 📈 Phase 3（模試の振り返り）⑥: 模試の **成績履歴と推移** を追加。提出・端末保存のたびに `LEAP_MOCK_HISTORY_V1` へ `{ examId, title, subject, date, score, total, accuracy, deviation, elapsed_sec, is_late, offline }` を記録し（`mockRecordHistory`、同じ模試は最新1件・最大20件）、成績表に直近8件の正答率バー・自己ベスト・直近6件の一覧を表示する（`mockRenderHistoryCard`）。既存の成績表を開いたときは履歴が無ければ遡って記録する（`mockBackfillHistory`）。`APP_VER=leap-v29-mock-history` / `CACHE=leap-v50`。|
| 2026-11-26 | 🔁 Phase 3（模試の振り返り）⑤: 模試の **誤答復習を永続化**。再読み込み後やクラウドから復元した成績でも、保存済み `answers` から誤答単語を引き直して「🔥 間違いを復習」が動くようにした（`mockSavedMistakes` / `mockMistakePool`、結果カード画像の要復習一覧も同じ復元を使う）。あわせて「🧠 間違えた単語を苦手に登録」（`registerMockMistakesToWeak`）を追加し、模試の誤答を `weakWords` へ一括登録（`source="mock"`・翌日復習、既存はミス回数を加算）。`APP_VER=leap-v28-mock-review` / `CACHE=leap-v49`。|
| 2026-11-26 | 🏷 Phase 2（模試の振り返り）④: 苦手単語 `weakWords` に **`source` タグ**（`quiz` / `mock` / `exam` / `review` / `daily`）を追加。`registerWrongAnswer` が直近の誤答元を記録し、苦手単語データ帳に「クイズ」「模試」「到達度テスト」「苦手復習」「デイリー」のバッジを表示する（`weakSourceLabel`）。既存データは読み込み時に `quiz` で補完。クラウド同期のマージはミス回数が多い方の `source` を採用する。`APP_VER=leap-v27-weak-source` / `CACHE=leap-v48`。|
| 2026-11-26 | ⏱ Phase 2（模試の振り返り）③: 模試に **時間配分ログ** を追加。`renderQuestion` で問題表示時刻を `quizState.questionShownAt` に記録し、`handleAnswer` で解答までの秒数を `quizState.answerTimes[index]` に保存、提出時に `answers[i].sec` として送る（`mock_exam_results.answers` は jsonb のためスキーマ変更不要）。成績表に解答合計・1問平均・最速/最遅・序盤/中盤/終盤の正答率・時間がかかった問題 TOP3 を表示（`mockBuildTimeAnalysis` / `mockRenderTimeCard`）。`sec` を持たない旧記録ではカードを出さない。`APP_VER=leap-v26-mock-timing` / `CACHE=leap-v47`。|
| 2026-11-26 | ⏰ Phase 2（模試の振り返り）②: 模試の **リマインド** と **振り返りメモ** を追加。開催回ごとに「⏰ リマインド設定／解除」を切り替え（`toggleMockReminder`、`LEAP_MOCK_REMINDERS_V1`）、開始24時間前〜終了までの間は起動時に1日1回トーストで知らせる（`mockCheckReminders`／同日重複防止は `LEAP_MOCK_REMINDER_SEEN_V1`、終了1日後は自動削除）。成績表の下に500字までの振り返りメモ欄（`saveMockNote` / `deleteMockNote`、`LEAP_MOCK_NOTES_V1`、更新日時表示）を追加。`APP_VER=leap-v25-mock-reminder` / `CACHE=leap-v46`。|
| 2026-11-26 | 🔍 Phase 2（模試の振り返り）①: 模試の成績表に **弱点分析レポート** を追加。`mock_exam_results.answers`（`[{ id, correct }]`）を単語データへ引き直して Part（古文は章）別の正答率バー、最も弱い分野のコメント、間違えた単語の一覧（最大12件・語義つき）を表示する（`mockBuildWeaknessAnalysis` / `mockRenderWeaknessCard`）。全国集計・端末内採点のどちらでも動作。`APP_VER=leap-v24-mock-analysis` / `CACHE=leap-v45`。|
| 2026-11-26 | 🧩 Phase 1 完了（ファイル分割）: 実績（約 500 行）・単語辞典／単語詳細／参考資料（約 750 行）・ショップ（約 280 行）の 3 ブロックを `js/ui-stats-dict.js` へ無改変で分離し、`sw.js` の `ASSETS` に追加。`index.html` は 10,859 行（Phase 1 開始時）→ 4,664 行、JS は `js/` の 5 ファイル（`core.js` / `mock-exam.js` / `cloud-sync.js` / `quiz-engine.js` / `ui-stats-dict.js`）に分かれた。読み込み順のスモークテスト（Node + DOM スタブ）とトップレベル宣言の重複なしを機械チェック済み。`APP_VER=leap-v23-split-ui` / `CACHE=leap-v44`。|
| 2026-11-26 | 🧩 Phase 1 続き: `index.html` のインライン JS から出題エンジンのブロック（`// 範囲選択 ＆ 出題数` 〜 `startDailyChallenge` 末尾、2,423 行）を `js/quiz-engine.js` へ無改変で分離し、`sw.js` の `ASSETS` に追加。範囲・Part 選択、クイズ本体（`startQuizWithPool` / `renderQuestion` / `handleAnswer` / `finishQuiz`）、到達度テストとタイマー、忘却曲線・学習状況フィルター・品詞推定・例文データ・ダミー選択肢、デイリーチャレンジを含む。`index.html` は 8,614 → 6,190 行。`APP_VER=leap-v22-split-quiz` / `CACHE=leap-v43`。|
| 2026-11-26 | 🧩 Phase 1 続き: `index.html` のインライン JS から Supabase のブロック（`const SUPABASE_CONFIG` 〜 `initCloud`、1,232 行）を `js/cloud-sync.js` へ無改変で分離し、`sw.js` の `ASSETS` に追加。あわせて 2 か所に重複していた `escapeHtml` を `js/core.js` に集約（文字列は `js/core.js` の 1 定義のみ）。`index.html` は 9,707 → 8,614 行。トップレベル宣言の重複なしを機械チェック済み。`APP_VER=leap-v21-split-cloud` / `CACHE=leap-v42`。|
| 2026-11-26 | 🧩 Phase 1（保守性・診断）: `index.html` のインライン JS から全国一斉模試のブロック（旧 L4,348〜5,493、約 1,150 行）を `js/mock-exam.js` へ無改変で分離し、`sw.js` の `ASSETS` に追加。トップレベル宣言の重複なしを機械チェック済み。設定シートの「データ」欄に **進捗の JSON 書き出し／復元**（`exportUserDataJSON` / `importUserDataJSON`、`LEAP_` キーのみ・トークン除外・確認ダイアログ付き）と **🔧 詳細・診断情報**（`renderSystemDiagnostics`＝アプリ版 / localStorage 使用量 / クラウド状態 / 収録語数 / Part 別語数 / SW キャッシュ名）を追加。`APP_VER=leap-v20-split-mock` / `CACHE=leap-v41`。|
| 2026-11-26 | 🏫 全国一斉模試を**ログインなしで受験できる**ように変更。開催スケジュールは新規の公開 RPC `get_mock_exam_schedule()`（未ログイン可・`question_ids` は受験時間内のみ返す）で取得し、未適用ならログイン時のみ `mock_exams` を直接 SELECT するフォールバックを用意。未ログインでも志望校エントリー（端末下書き）・受験・採点・間違い復習ができ、結果は `LEAP_MOCK_LOCAL_RESULTS_V1` に保存して「端末内の採点結果」カード（得点・正答率・所要時間）を表示。ログイン後に「☁️ 全国集計に提出する」（`resubmitLocalMockResult`）から `mock_exam_results` へ提出できる。Supabase 未設定／通信不可／公開中の回がないときは、端末内の単語から作る「オフライン練習模試」（30問・20分・何度でも受験可）を一覧先頭に表示。共有リンク `?mock=` もログインを待たずに開く。新規 `supabase/migration_mock_public.sql`（`schema.sql` にも同 RPC を追記）。`APP_VER=leap-v19-mock-open` / `CACHE=leap-v40`。|
| 2026-11-24 | 🐞 管理ダッシュボードの「👤 管理者」タブが押せない不具合を修正。`sw.js` が `admin.html` だけを Network-Only にし、`js/admin.js` は Cache-First で配信していたため、新しい HTML（4タブ）と古い JS（3タブ分のリスナーしかない）が組み合わさり、追加したタブにクリックリスナーが無かった。`sw.js` の Network-First 対象に `js/admin.js` を追加し、`admin.html` の読み込みを `js/admin.js?v=leap-v18-admin-tab-fix` に変更。`APP_VER=leap-v18-admin-tab-fix` / `CACHE=leap-v39`。|
| 2026-11-24 | 👤 管理者権限の運用を UID ベースに変更し、LINE ログインユーザーにも付与できるようにした。新規 `supabase/admin_roles.sql`（`admin_list_members` / `admin_grant` / `admin_revoke` / `admin_claim_first`）と、`admin.html` の「👤 管理者」タブ（UID・メール・表示名で検索、付与・解除、UID コピー、UID 直接入力）を追加。`admin.html` は LINE ログインにも対応し、権限が無い場合もサインアウトせず「最初の管理者として登録」できるようにした。管理画面の認証保存キーを `leap-admin-auth-v1` に分離し、公開サイトと管理画面で別アカウントを同時にログイン可能にした。🎨 ホームを再構成（主導線を上部へ、学習ツールを2列・ツールを3列に集約、新規ユーザー向け3ステップの「はじめてガイド」と「10問でためす」）。お知らせに「模試」を含む場合の模試ページ直リンク、模試の共有リンク `?mock=<examId>` と共有ボタンを追加。ダークモードの半透明面・淡い枠線・濃色チップ文字のコントラストを補修。`APP_VER=leap-v17-admin-ui` / `CACHE=leap-v38`。|
| 2026-11-23 | 🐞 管理ダッシュボード（`admin.html`）の「📮 意見箱」タブが空になる不具合を修正。`js/admin.js` 側にだけ存在した描画先（`#panel-feedback` / `#fb-list` / `#fb-count` / `#fb-category` / `#fb-status` / `#fb-q` / `#fb-refresh`）の HTML が `admin.html` に無く、タブを切り替えても何も表示されなかった。他タブと同じカード構成で、種別・状態・キーワードの絞り込み、件数表示、更新ボタン、一覧カードを追加。`admin.html` は Service Worker の `ASSETS` 対象外なので `APP_VER` / `CACHE` は据え置き。 |
| 2026-11-23 | 🏫 全国一斉模試の志望校マスタを拡充し、選択 UI に絞り込みを追加。`mock_schools_data.js` に京都工芸繊維大学（工芸科学部5課程）をはじめ、京都教育・大阪教育・奈良教育・滋賀県立・兵庫県立・神戸市外国語・千葉・横浜国立・金沢・熊本・大阪工業・関西医科・大阪医科薬科・武庫川女子・神戸学院・立命館アジア太平洋・芝浦工業の大学×文理グループと学部を追加。エントリー画面に大学名/学部名の検索、カテゴリ・難易度（tier）の絞り込み、該当件数表示、条件クリアを追加（`mockSchoolFilter` / `renderMockSchoolSelectors`）。成績表の全大学×文理群の目安一覧はカテゴリ見出し付きに変更。`APP_VER=leap-v16-mock-schools` / `CACHE=leap-v37`。 |
| 2026-11-23 | お知らせ投稿時の `null value in column "publish_start" violates not-null constraint` エラーを修正。旧サービスと共用している `announcements` テーブルの旧列（`publish_start`, `publish_end`, `content`）に対応した互換ペイロードと自動フォールバックを `js/admin.js` に実装。`supabase/schema.sql` および `supabase/migration_community.sql` に旧テーブル存在時の NOT NULL 制約緩和 DDL を追加。`APP_VER=leap-v15-announcement-fix` / `CACHE=leap-v36`。 |
| 2026-11-23 | 🏫 LEAP 管理ダッシュボード（`admin.html`）に「模試管理」タブを追加。新規模試の作成（タイトル・科目・出題範囲プリセット・単語自動抽出・開催期間・制限時間設定）、模試一覧、過去の模試結果集約（エントリー数・受験者数・平均点/正答率・最高点/最低点・平均所要時間）、受験者一覧テーブル（得点・正答率・所要時間・提出日時・遅延判定）の閲覧・編集・削除を実装。`supabase/schema.sql` および `supabase/migration_community.sql` に管理者の `mock_exams` (ALL)、`mock_exam_results` (SELECT)、`mock_exam_entries` (SELECT) RLS ポリシーを追加。公開側（`screen-mock-exam` および設定シート）に管理ダッシュボードへの導線を追加。`APP_VER=leap-v14-mock-dashboard` / `CACHE=leap-v35`。 |
| 2026-11-23 | 旧サービスと共用している `announcements` テーブルの混在対策。旧サービスは `content` 列を使い `body` が空のため、公開側（`loadCommunityAnnouncements`）と管理画面（`loadAnnouncements`）の取得を `body is not null` で絞り込み、旧サービスのお知らせが LEAP に表示されないようにした。`APP_VER=leap-v13-community` / `CACHE=leap-v34`。 |
| 2026-11-23 | 📮 意見箱・📢 お知らせ・管理ダッシュボード（Phase 1）を追加。ホームに公開期間内のお知らせ（最大2件・NEW バッジ・一覧モーダル）と意見箱（種別／本文2,000字／★1〜5／連絡先／自動添付、匿名可、下書き保存、未設定時は文面コピー）を実装。新規 `admin.html` ＋ `js/admin.js`（Supabase Auth ＋ `admin_users` 許可リスト、お知らせ CRUD、意見の状態・管理メモ、noindex・SW 対象外）。新規 `supabase_config.js` に設定を集約（`index.html` と `admin.html` で共有）。`supabase/schema.sql` に `admin_users` / `announcements` / `feedback`（RLS）と `is_admin()`、匿名投稿用 RPC `submit_feedback()`（本文長・種別・評価の検証、ハニーポット、5件/時・10件/時のレート制限）を追加。模試の成績表に感想導線を追加。`APP_VER=leap-v12-community` / `CACHE=leap-v33`。既存プロジェクト向けに Phase 1 追加分だけの `supabase/migration_community.sql` を分離（全体再適用によるデッドロック回避）。同SQLは古い定義の `announcements` / `feedback` が残っていても不足列を `add column if not exists` で補修してから索引を作る。 |
| 2026-11-23 | 🏫 全国一斉模試（全国模試モード）を追加: `screen-mock-exam`（開催スケジュール／開始前カウントダウン／第1〜第5志望のエントリー／制限時間つき受験／成績表）。新規 `mock_schools_data.js`（大学×文理の `MOCK_UNIV_GROUPS` と学部 `MOCK_FACULTIES`、関西＋有名国公立＋早慶MARCH）。`supabase/schema.sql` に `mock_exams` / `mock_exam_entries` / `mock_exam_results`（RLS・unique 制約）と集計 RPC `get_mock_exam_report` を追加。少人数向けにトリム平均・理論平均（`expected_rates`）・SD クリップを組み合わせたハイブリッド偏差値、N<5 の暫定表示、同tier／同category へのフォールバック付き志望校判定を実装。クイズ基盤は `exam` モードを開催回の `duration_sec` に対応させ、終了時刻超過は `is_late`。`APP_VER=leap-v11-mock-exam` / `CACHE=leap-v32`。 |
| 2026-11-23 | 到達度テストの結果を画像・共有・挑戦状に反映（共有カードは `EXAM RESULT`／判定表示、共有URLに `ex`/`ep`、フレンド共有に `exam: {grade, partId}`、受信側は同じ範囲の到達度テストに挑戦）。📊 学習記録画面（`screen-stats`）を追加: 直近12週の日別ヒートマップ（`userData.dailyLog`）、連続学習・累計解答・マスター/苦手語数、Part別マスター率。🔤 スペル入力モード（`LEAP_QUIZ_STYLE_V1=spelling`）を追加し、採点は `handleAnswer` に委譲。`APP_VER=leap-v10-stats-spell` / `CACHE=leap-v31`。 |
| 2026-11-23 | 🎓 到達度テストを追加: `screen-exam`（範囲＝全範囲またはPart単体、50問・25分・S〜D判定、最高判定と直近5件の履歴表示）。クイズ基盤にゲームモード `exam` を追加し、25分の全体カウントダウン・専用結果バナー（判定・範囲・前回比）・`userData.examHistory`（最大20件、クラウド統合対応）を実装。`APP_VER=leap-v9-exam` / `CACHE=leap-v30`。 |
| 2026-11-23 | 出題スタイルに「🎧 リスニング4択」を追加（`LEAP_QUIZ_STYLE_V1` = `listening`）。見出し語を隠して音声だけで出題し、解答後に単語・IPAを開示。音声は読み上げ設定に関係なく出題時に再生し、🔊で再再生できる。古文ゾーンでは通常4択に固定。`APP_VER=leap-v8-listening` / `CACHE=leap-v29`。 |
| 2026-11-22 | 結果カードのスクショを刷新: 画面外の専用カード `#result-share-card`（常時ダーク・440px）を新設し、文字の重なりを解消（正答率ヒーロー、正解数/正答率/最大コンボ、コイン/連続学習、要復習リスト最大6件、範囲・日付）。結果画面の間違い一覧も折り返し対応。例文・文脈テストでも学習状況を共通記録し、出題設定の学習状況チップに該当語数と例文モードの絞り込み結果を表示。クイズの「タップして次へ」を解答直後に即表示（誤タップガードを 350ms → 120ms）。ファイル分割 Stage 2 として `js/core.js`（称号・アイテム・ゾーン・画面遷移・確認ダイアログ）を分離。`APP_VER=leap-v7-split2` / `CACHE=leap-v28`（`assets/css/app.css` と `js/core.js` を ASSETS に追加）。 |
| 2026-11-22 | `index.html` のインライン CSS（旧 L59–296・236 行）を `assets/css/app.css` へ分離（ファイル分割 第 1 段階）。CSS の内容は元と同一。`sw.js` の `ASSETS` に追加し `CACHE=leap-v27`、`APP_VER=leap-v6-split1` へ更新。§0・§2・§13 を追随。Stage 2 以降の分割手順と確認項目を `docs/ファイル分割計画.md` に文書化。 |
| 2026-11-21 | ホーム画面の副次的ボタンを「⚙️ 設定・その他」シートに集約（実績・ショップ・アカウント／同期・自分の詳細・音声ON/OFF・追加JSON読込）。音声トグル時にラベルを即時更新。 |
| 2026-11-21 | iPadOS で読み上げが無音になる問題を調査・修正: ユーザー操作内での `speak()` 同期実行、空文字発話によるアンロックの再試行（`pointerdown`/`touchstart`/`touchend`/`click`/`keydown`）、アンロック発話のキャンセル回避、`voice` 未設定時のフォールバックを追加。iPad のソフトミュート／iOS 26 の既知不具合も SERVICE.md に明記。 |
| 2026-11-21 | 結果共有をサービス内で完結するように変更（フレンド選択シート→「📥 共有」タブ・未読バッジ・同じ範囲で挑戦、`userData.sharedResults` を使用し DB 変更なし）。「📊 自分の詳細」でフレンド詳細と同じ画面を自分でも確認可能に。`APP_VER=leap-v5-cloud5` / `CACHE=leap-v26`。 |
| 2026-11-21 | 音声読み上げの修正: 初回タップでの音声アンロック、声の読み込み待ち・Safari の `cancel()` 直後対策・一時エラー再試行を追加し、🔊 ボタンは設定 OFF でも再生するようにした。結果画面に「フレンドに共有」を追加（OS 共有シート＋ログイン中はクラウド即同期、非対応端末はコピー）。`APP_VER=leap-v5-cloud4` / `CACHE=leap-v25`。 |
| 2026-11-21 | クラウド同期の不具合修正: 同期済み判定を文字列比較から時刻比較（`sameCloudInstant`、2秒許容）に変更し、再読込ごとに競合ダイアログが出る問題を解消。プロフィール保存を upsert 化、初期化失敗時に再試行可能に、OAuth リダイレクト後も招待コードを復元。`APP_VER=leap-v5-cloud3` / `CACHE=leap-v24`。 |
| 2026-11-21 | LINE ログインを追加（Supabase の Custom OAuth Provider `custom:line`）。ログインボタンをプロバイダ別スタイルに対応させ、OAuth 失敗時のエラー表示を追加。`docs/SUPABASE_SETUP.md` に Google / LINE / RLS / トラブルシューティングを含む詳細手順を新規作成。`APP_VER=leap-v4-cloud2` / `CACHE=leap-v22`。 |
| 2026-11-21 | Supabase（Auth / Postgres / RLS）を任意バックエンドとして導入。Google ログイン、localStorage 併用のクラウド同期（初回競合の3択解決・統合マージ・自動同期）、相互フレンド（フレンドコード・申請/承認・詳細ステータス・公開範囲設定）を追加。`supabase/schema.sql` 追加、`screen-social` とフレンド詳細シート追加、SW は Supabase を Network-Only に。`APP_VER=leap-v4-cloud1` / `CACHE=leap-v21`。 |
| 2026-11-21 | `SERVICE.md`（このファイル）を新規作成。サービス全体の仕様・データ・保存形式・運用手順を文書化。`AGENTS.md` に更新ルールを追加。 |
| 2026-11-21 | LEAP 単語詳細を 1579〜2300 に追加（Part 5 を開放、例文は 1579〜2000）。 |
| 2026-11-20 | 古文辞典で単語番号検索・ID 範囲フィルタに対応。 |
| 2026-11-18 | 自動次送りの誤爆修正（イベント伝播停止＋クールダウン）。クイズ復習フロー・ショップタブ・接辞問題 UI を改善。 |
| 2026-11-17 | ホームからレベル別リーダーの入口を非表示化。接辞データ追加。 |
| 2026-11-15 | ハイスコア表示を進捗統計に置換し報酬を拡張。忘却曲線復習を通常4択に固定。通常/例文モードの解答フィードバックを統一。 |
| 2026-11-14 | 例文の和訳ハイライトを全 807 語で調整。703〜807 の詳細追加、Part 5 をクイズ化。例文音声・和訳ハイライト位置修正。単語詳細・辞典ページ・例文クイズ追加。 |
| 2026-11-13 | 辞典フィルタを sticky＋折りたたみに。例文モード中のカスタム範囲をロック。例文穴埋めモード・賢いダミー選択肢・時間制限モード追加。 |
| 2026-11-12 | Part 4（1401〜2000）投入。`alert` をサイト内ダイアログへ移行。ショップ購入・クイズ中断の確認ダイアログ。ブラウザ戻るで画面遷移。 |
| 2026-11-11 | Part 3 投入。古文 2 章追加、ゾーン別の読み上げ・辞典 Part・苦手リスト。複数選択フィルタ・ゾーン対応リンク・実績追加。古文ゾーン実装。古文 5 章構成の文書化、古文データ枠の足場作成。PWA インストールバナー。学習状況フィルタ。ダークモードのコントラスト改善。 |
| 2026-11-09 | `wordStats` 記録・忘却曲線復習・ショップ価格ソート・共有ボタン修正・Part 完了率 UI。 |
| 2026-11-08 | Service Worker を Network-First 化し自動キャッシュ破棄を追加。ホームに実績ボタン（39 実績）。実績を 39 種に拡張しカテゴリタブ追加。 |
| 2026-11-07 | 初版（4択クイズ・コイン・称号・ショップ・共有など） |
