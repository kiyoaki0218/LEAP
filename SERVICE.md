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

最終更新: 2026-11-23

---

## 0. 30秒サマリ（AI向け）

- **何か**: 大学受験英単語帳「LEAP」の 4択クイズ × ゲーム要素の学習 PWA。加えて「裏世界」ゾーンで古文単語クイズも遊べる。
- **構成**: ビルド不要の**静的サイト**。`index.html` に HTML（マークアップ）とアプリ本体のインライン JS を持ち、基盤 JS は `js/core.js`、全国一斉模試は `js/mock-exam.js`、アプリ固有 CSS は `assets/css/app.css`（いずれも外部ファイル）、データは `*_data.js` の JS 定数。
- **バックエンドは任意**: 基本は **localStorage** のみでオフライン動作。`supabase_config.js` に URL / anon key を設定すると **Supabase**（Auth / Postgres / RLS）によるクラウド同期・相互フレンド・お知らせ・意見箱が有効になる。未設定なら従来どおりローカルのみで正常動作する（お知らせは非表示、意見箱は文面コピーのみ）。
- **収録**: 英単語 2,300 語（Part 1〜5）／例文・単語詳細 2,300 語分・例文クイズ 2,000 語分／参考資料 5 章／接辞 32 グループ・132 語根／古文単語 150 語（2 章）。
- **主な遊び**: 通常4択・例文穴埋め・リスニング4択・スペル入力・60秒スプリント・サドンデス、到達度テスト（50問・25分・S〜D判定）、**全国一斉模試（日時指定の時間割制・ハイブリッド偏差値・志望校判定）**、デイリーチャレンジ、忘却曲線の苦手復習、学習カレンダー/Part別マスター率の振り返り、コイン/EXP/レベル、称号・フレーム・アバター、実績 93 種、共有URL（挑戦状）、任意ログインによるクラウド同期・相互フレンドの詳細ステータス閲覧。運営向けに **お知らせ**（ホーム表示）と **意見箱**（匿名可）、管理者用の `admin.html`（模試管理・新規模試作成・過去成績集約・お知らせ CRUD・意見トリアージ）を持つ。
- **ホスティング**: 静的ホスティング（Vercel 想定。`vercel.json` なし、`.vercel/` は gitignore）。
- **主要ファイル**: `index.html`（アプリ本体）、`js/core.js`（称号・ゾーン・画面遷移の基盤）、`js/mock-exam.js`（全国一斉模試）、`assets/css/app.css`（アプリ固有 CSS）、`admin.html` ＋ `js/admin.js`（管理者ダッシュボード）、`supabase_config.js`（Supabase 公開設定の共有）、`words_data.js`、`examples_data.js`、`reference_data.js`、`affix_data.js`、`mock_schools_data.js`（模試の志望校マスタ）、`kobun/kobun_words_data.js`、`sw.js`、`manifest.json`、`supabase/schema.sql`（DB/RLS・模試集計RPC・意見箱RPC）、`supabase/admin_roles.sql`（管理者の一覧・付与・解除RPC）、`supabase/migration_mock_public.sql`（模試の公開スケジュールRPC）、`LEAP単語データ/`（元データ）、`patches/`（データ生成・一括改修スクリプト）。

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
| `kobun` | 🌌 裏世界（古文単語） | 古文単語 150 語（1章・2章） | Part 101〜102（ID 10001〜10150） |

- ゾーンはホーム画面上部のトグルで切替。選択は `LEAP_SUBJECT_V1` に保存。
- **進捗データは共通の `userData` に入るが、単語 ID 空間を分けている**（英単語 1〜2300 / 古文 10001〜）ため、学習履歴・苦手・辞典・実績が混ざらない。
- 古文ゾーンでは出題スタイルは常に「通常4択」、読み上げは日本語（`ja-JP`）。
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
| オフライン | `sw.js`（Cache API） | キャッシュ名 `leap-v41`、Network-First。Supabase・認証コールバック・`admin.html`・`js/admin.js` は Network-Only |
| PWA | `manifest.json`、アイコン各種 | standalone 表示、theme `#059669` |
| ビルド | なし | `.js` データは `<script>` で直接読む |

### キャッシュ更新の仕組み

- `index.html` 冒頭の `APP_VER`（現在 `leap-v18-admin-tab-fix`）が `localStorage.LEAP_APP_CACHE_VER` と違えば、全 Cache を削除。
- `sw.js` は `install` で `skipWaiting()`、`activate` で旧キャッシュ削除＋`clients.claim()`。
- 取得は Network-First（HTML は常に最新、オフライン時のみキャッシュ）。
- **フロントを更新したら `sw.js` の `CACHE` 名と `index.html` の `APP_VER` を上げる**のが運用ルール。

### 画面（section）一覧

`SCREENS` 配列で管理し、`navigate(id)` で切替（ブラウザ戻る/進むにも対応）。

| id | 画面 | 役割 |
|---|---|---|
| `screen-home` | ホーム | ゾーン切替、お知らせ（模試のお知らせは模試ページへの直リンク付き）、はじめてガイド（学習履歴ゼロの人だけ）、クイズ／デイリーの主導線、プレイヤーカード、連続学習、苦手バナー、2列の学習ツール（到達度テスト・模試・学習記録・語源）、3列のツール（辞典・ご意見・設定） |
| `screen-select` | 出題範囲＆設定 | スタイル／ゲームモード／Part・カスタム範囲／出題数／学習状況フィルタ |
| `screen-quiz` | クイズ | 問題カード、4択、タイマー、コンボ、次へ |
| `screen-result` | 結果 | スコア、正答率、間違い一覧、共有・画像保存・再挑戦 |
| `screen-shop` | ショップ | 前称号／後称号／フレーム／アバターの購入・装着 |
| `screen-social` | ☁️ アカウント・同期 | Google ログイン、フレンドコード、申請一覧、公開範囲設定、手動同期 |
| `screen-dictionary` | 単語辞典 | 検索・Part/ID範囲/学習状況フィルタ・ページ送り・単語詳細 |
| `screen-reference` | 参考資料 | 語源・接頭辞・接尾辞・発音・英作文の解説と確認クイズ |
| `screen-affix` | 語源ラッシュ ハブ | ラッシュ／神経衰弱への入口、ベスト記録 |
| `screen-affix-rush` | 語源ラッシュ | 60秒・接辞の4択ラッシュ |
| `screen-affix-memory` | 接辞神経衰弱 | カードめくりで語根と意味を一致させる |
| `screen-reader` | レベル別リーダー | 例文から長文を自動生成して読む（**現在 UI 入口なし＝休眠機能**） |
| `screen-exam` | 🎓 到達度テスト | 範囲（全範囲／Part単位）を選んで 50問・25分のテスト。S〜D判定と過去の記録を表示 |
| `screen-stats` | 📊 学習記録 | 直近12週の日別ヒートマップ（学習カレンダー）、連続学習・累計解答・マスター/苦手語数、Part別マスター率 |
| `screen-mock-exam` | 🏫 全国一斉模試 | 開催スケジュール一覧、カウントダウン、志望校（第1〜第5）エントリー、制限時間つき受験、偏差値・順位・志望校判定・全大学×文理群の目安一覧、模試ごとの共有リンク（`?mock=<examId>`）。**受験はログイン不要**（結果は端末保存）、ログイン時に全国集計へ提出。Supabase 未設定でもオフライン練習模試（30問・20分）を表示 |

モーダル／ダイアログ: **設定・その他シート（`settings-modal`）**、**お知らせ一覧（`announcements-modal`）**、**意見箱（`feedback-modal`）**、実績、苦手単語一覧、単語詳細シート、フレンド詳細ステータスシート、結果のフレンド共有シート、初回ログイン時の競合解決ダイアログ、リーダー単語ポップ、確認ダイアログ（`showConfirm`/`showAlert`）、トースト。

画面外のページ: `admin.html`（管理者ダッシュボード。`SCREENS` には含めない独立ページ）。

ホームの副次的な入口（実績・ショップ・アカウント／同期・自分の詳細・音声ON/OFF・追加JSON読込）は「⚙️ 設定」シートに集約している（`openSettingsModal` / `closeSettingsModal`）。各ボタンは既存IDを保つため、バッジやラベルの自動更新はそのまま動作する。

ホームの導線は「主導線を上・副次機能を下」の順に並べる。`home-onboarding` は `totalQuizzes === 0` かつ `scoreHistory` と `wordStats` が空のときだけ表示し、閉じると `LEAP_ONBOARDING_DISMISSED_V1` に記録して以後は出さない。ガイドの「10問でためす」は先頭100語から10問を学習状況フィルタなしで開始する（`startBeginnerQuiz`）。

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
  { id: 101, name: "1章 読解必修語", desc: "読解必修語（50語）", start: 10001, end: 10050 },
  { id: 102, name: "2章 入試必修語", desc: "入試必修語（100語）", start: 10051, end: 10150 }
];
```

- 収録: **150 語**（ID 10001〜10150）。`num` は冊子の通し番号。
- ID ルール: `id = 10000 + 冊内番号`。Part は章に対応（現状 101=50語、102=100語）。
- 目標構成（未投入分を含む）は `docs/古文単語330_追加構想.md` の 5章330語（103=敬語30語、104=入試重要100語、105=入試攻略50語）。
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
| `context`（例文・文脈テスト） | 例文の空所に入る語を4択で選ぶ。和訳表示・例文読み上げあり | 英単語ゾーンのみ。古文は強制 `normal` |
| `listening`（リスニング4択） | 見出し語を隠し、音声だけを聞いて日本語の語義を4択で選ぶ。解答後に見出し語・IPAを開示 | 英単語ゾーンのみ。古文は強制 `normal`。音声は `voiceEnabled` に関係なく出題時に自動再生（🔊で再再生） |
| `spelling`（スペル入力） | 日本語の語義（＋品詞バッジ）を見て英単語を入力する。大文字・小文字は区別しない | 英単語ゾーンのみ。古文は強制 `normal`。選択肢は表示しない |

- 出題スタイルは `LEAP_QUIZ_STYLE_V1` に保存（`normal` / `context` / `listening`。未知の値は `normal` にフォールバック）。
- スペル入力では `quiz-spelling-box`（語義＋入力欄＋決定）を表示し、見出し語と選択肢を隠す。採点は `submitSpellingAnswer()` が入力値を突き合わせ、**コイン・EXP・苦手登録・実績・学習状況は4択と同じ `handleAnswer()` に委譲**する（学習記録の整合性を保つため）。解答後は見出し語・IPAを開示し、誤答時は「あなたの解答 / 正解」を表示する。
- リスニングでは `quiz-listening-box` を表示し、`quiz-word-row`（見出し語・IPA）を隠す。出題直後に `speakListeningWord()` で再生し、選択肢の自力想起マスクは他スタイルと同じく `brainFirstDelayMs()` だけ待つ。解答後は `revealListeningAnswer()` が見出し語を開示する。
- 例文クイズは `LEAP_WORD_DETAILS` の `examples[].prompt`（空所化済み）を優先。無ければ `LEAP_EXAMPLE_DATA` から `buildCloze()` で空所化。
- 例文があるのは ID 1〜2000。範囲に例文付き単語が無い場合は UI が「例文あり 0 語」と警告。
- 例文モードで正解・不正解した単語も `userData.wordStats[id]` に加算され、辞典・出題絞り込みの学習状況（未学習/苦手/学習中/マスター）に反映される。

### 4.3 ダミー選択肢（`pickDistractorWords`）

- 同じ品詞を優先。
- 苦手単語・つづりが似た語（共通接頭辞長 `sharedPrefixLength`）を混ぜる。
- クイズセット内の他の正解を `blocked` にして「メタ読み」を防止。
- 古文は同じ subject（古文）からダミーを作り、英語が混ざらない。

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

### 4.6 デイリーチャレンジ

- ホームの「🌟 デイリーチャレンジ」。1日1回、20問、データ全体からランダム範囲。
- その日の初回クリア時のみ**獲得コインが2倍**（`lastDailyDate` で判定、`dailyClears` 加算）。
- クリア済みでも再プレイ可能（ボーナスなし）。

### 4.7 苦手・忘却曲線復習

- 不正解時（`registerWrongAnswer`）: `weakWords[id]` に登録 or リセット。`stage=1`、`nextReview=翌日`。
- 正解して復習を進めると（`stage` アップ）次回間隔: **1日 → 3日 → 7日 → 14日**（`FORGETTING_STAGES`、最大ステージ4）。
- 「本日復習」対象 = `nextReview <= 今日` の苦手単語。
- ホームの苦手バナーから「特訓する」（`startWeakWordsQuiz`）または「一覧」（モーダルで個別削除・ゾーン単位リセット）。
- 復習は**通常モード・通常4択固定**。完了で `reviewClears` 加算。

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

日時を揃えた「時間割制」の模試。**受験はログイン不要**で、未ログインでも受験・採点・復習・端末保存ができる。全国集計（偏差値・順位・志望校判定）への提出と `get_mock_exam_report` は Supabase ＋ ログイン時のみ。Supabase 未設定／通信不可のときは、端末内の単語から作る「オフライン練習模試」（30問・20分・何度でも受験可）を一覧の先頭に表示する。

- **スケジュール**: `mock_exams` を新しい順に取得し、開催中／開催前を先、終了済みを後に並べる。`start_at` / `end_at` で次の3状態を判定（`mockPhase`）。
  - 開催前（`now < start_at`）: 開始までのカウントダウンと志望校登録。
  - 受験時間枠内（`start_at <= now <= end_at`）: 「模試を開始する」。制限時間は開催回の `duration_sec`（既定 1500 秒 = 25 分）。
  - 終了後（`now > end_at`）: 成績表（確定 or 暫定）と志望校判定を表示。
- **出題**: `mock_exams.question_ids` の単語をそのまま出題（`subject` = `leap` / `kobun`）。通常4択固定。
- **開始時刻の保持**: 開始時に `mockExamStartedAt` を記録し、`elapsed_sec` を提出。終了時刻を過ぎた提出は `is_late = true`（参考記録）として保存し、正規受験の集計から除外する。
- **エントリー**: 第1〜第5志望を `mock_exam_entries.choices`（jsonb 配列）に保存。各要素は `{ facultyId, univ, faculty, groupId, groupName, tier, category }` の自己記述形式で、これだけで大学×文理／tier／category の集計ができる。ローカル下書きは `LEAP_MOCK_CHOICES_V1`。
  - 選択 UI は「大学名・学部名の検索」＋「カテゴリ」「難易度（tier）」の絞り込みを備え、該当する大学・学部だけをセレクトに出す（件数表示・条件クリア付き）。
- **成績表**: `get_mock_exam_report` の返却値を表示。偏差値・順位・上位パーセンタイル・受験者数 N・平均・トリム平均・理論平均・実効SD・志望校判定（A/B/C/D または判定保留）・全大学×文理群の目安一覧（カテゴリ見出し付き・スクロール）。
- **判定**（`mockJudgeFor`）: 偏差値と `tier` 別しきい値（tier1: 63/57/50、tier2: 60/54/47、tier3: 56/50/44、tier4: 52/46/40）で A〜D を決め、志望者内パーセンタイルが上位25%なら1段上げ、下位20%なら1段下げる。**N < 5 または暫定フラグ時は「判定保留（暫定）」**。
- **ログイン不要の受験**: 開催スケジュールは未ログインでも読める公開 RPC `get_mock_exam_schedule()` で取得する（`question_ids` は受験時間枠内だけ返る。RPC 未適用ならログイン時のみ `mock_exams` を直接 SELECT）。志望校エントリーはローカル下書き（`LEAP_MOCK_CHOICES_V1`）に保存し、ログイン時のみ `mock_exam_entries` へ upsert。受験結果は未ログイン／通信エラー時 `LEAP_MOCK_LOCAL_RESULTS_V1`（`{ [examId]: { score, total, elapsed_sec, answers, is_late, submitted_at } }`）に保存し、結果画面は「端末内の採点結果」カード（得点・正答率・所要時間）を表示する。ログイン後に同じ回を開くと「☁️ 全国集計に提出する」（`resubmitLocalMockResult`）から `mock_exam_results` へ提出でき、成功したら端末側の記録は削除する。
- **復習導線**: 結果画面と同じく間違えた単語を `startQuizWithPool` で復習できる（`reviewMockMistakes`）。`html2canvas` の `#result-share-card` に偏差値・得点・要復習を流し込んで画像保存できる（`downloadMockResultImage`）。
- **中断**: 模試中に中断した場合は提出せず、成績表画面へ戻る（コイン・EXP の獲得分は残る）。

---

## 5. 単語辞典

- ホーム「📖 単語辞典（番号順）」から。**現在のゾーンの単語だけ**を ID 順に表示。
- 検索: **英単語・日本語語義・単語番号**に対応（`normalizeSearchText`）。
- フィルタ（複数選択可、AND 結合）:
  - Part（ゾーンの有効 Part から動的生成。古文は「1章/2章」）
  - ID 範囲（開始・終了）
  - 学習状況（未学習／苦手／学習中／マスター）
- フィルタパネルは**sticky＋折りたたみ**。状態は `LEAP_DICTIONARY_FILTER_V1` / `LEAP_DICT_FILTER_OPEN_V1` に保存。
- **100 件／ページ**（`DICT_PAGE_SIZE`）。前後＋先頭末尾＋省略記号のページャ。
- 行タップで**単語詳細シート**: 見出し語・IPA・品詞バッジ・語義（タグ付き）・コラム/頻出・例文（和訳ハイライト・読み上げ）・学習状況バッジ。
- 古文の行は `num`（冊内番号）を表示。

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

### 7.2 実績（`ACHIEVEMENTS`）

- 総数 **93**（基本配列 81 ＋ `ACHIEVEMENTS.push()` で追加 12）。ヘッダー／ホームのカウンタは動的計算。
- カテゴリ: `basic` / `correct` / `level` / `combo` / `accuracy` / `collection` / `words` / `review` / `daily` / `shop` / `kobun`。
- 各実績は `condition(userData)` で判定し、達成時にコイン報酬（`price`）を付与。
- 追加分 12 の内訳: 古文ゾーン 5（初回・10語・50語・10語マスター・表裏両方）＋ 追加チャレンジ 7（10/20コンボ、30回完走、正答率95%、100% 3回、Lv.50、コイン10,000）。
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
| `LEAP_ANNOUNCEMENTS_SEEN_V1` | 既読にしたお知らせ ID の配列（最大100件。ホームの NEW バッジ用） |
| `LEAP_FEEDBACK_DRAFT_V1` | 意見箱の下書き（`{ category, body, rating, contact }`） |
| `LEAP_FEEDBACK_CLIENT_TOKEN_V1` | 意見箱のレート制限用クライアント UUID（端末ごとに生成） |

### 11.2 `userData` の主なフィールド

```js
{
  coins, exp, level,
  prefix, suffix, purchasedPrefixes[], purchasedSuffixes[],
  ownedFrames[], equippedFrame, ownedAvatars[], equippedAvatar,
  wordStats: { [wordId]: { correct, total } },      // 単語別の正解/出題回数
  weakWords: { [wordId]: { id, word, meaning, count, stage, nextReview, lastReviewed } },
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

### 12.3 統合（マージ）ルール

| 項目 | 扱い |
|---|---|
| `coins` / `exp` / 各種回数・`streak` | 大きい方 |
| `wordStats` | 単語ごとに「出題回数が多い方」、同数なら正解数が多い方 |
| `weakWords` | 和集合。同じ単語はミス回数が多い方、`nextReview` は早い方 |
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
  - 前称号（86）・後称号（84）・フレーム（27）・アバター（17）・実績（93）の解放率と獲得バッジ一覧。
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
│   ├── core.js               アプリ基盤（称号・アイテムのマスタ、ゾーン、画面遷移、確認ダイアログ）
│   ├── mock-exam.js          全国一斉模試（スケジュール・エントリー・受験・成績表・共有リンク・端末内保存）
│   └── admin.js              管理画面のロジック（Auth・announcements・feedback）
├── assets/
│   └── css/app.css            アプリ固有 CSS（旧 index.html 内の <style> ほか）
├── manifest.json              PWA マニフェスト
├── sw.js                      Service Worker（キャッシュ leap-v41 / Network-First）
├── words_data.js              LEAP_WORDS_DATA（2,300語）
├── examples_data.js           LEAP_WORD_DETAILS（2,300語）+ LEAP_EXAMPLE_DATA（2,000語）
├── reference_data.js          LEAP_REFERENCE_DATA（5章）
├── affix_data.js              AFFIX_DATA（接頭辞16 + 接尾辞16、132語根）
├── mock_schools_data.js       MOCK_UNIV_GROUPS / MOCK_FACULTIES（全国一斉模試の志望校マスタ）
├── kobun/
│   ├── kobun_words_data.js    KOBUN_WORDS_DATA（150語）+ KOBUN_PARTS
│   ├── kobun_config.js        未使用の設定足場（enabled=false）
│   └── kobun_loader.js        未使用の統合ヘルパー（window.KOBUN）
├── docs/
│   ├── 古文単語330_追加構想.md  古文5章330語の設計・実装手順メモ
│   ├── SUPABASE_SETUP.md      Supabase / Google / LINE ログインの詳細設定手順
│   └── ファイル分割計画.md    index.html を段階分割する手順（Stage 1=模試分離 完了）
├── LEAP単語データ/
│   ├── 001_101.txt … 2001_2300.txt   元テキスト（語義・IPA・コラム）
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
```

- 動作確認の観点: ホーム表示 → 範囲選択 → クイズ → 結果 → 辞典 → ショップ → 実績 → ダークモード → リロード後も進捗保持 → オフライン再訪。
- `localStorage` を消せば初期状態に戻る（実機ではサイトデータ削除）。
- Service Worker の更新が絡むため、変更確認時はハードリロードまたは `CACHE`/`APP_VER` の更新を行う。

### データを追加するとき

1. 英単語: `LEAP単語データ/` の元テキストを更新 → `node patches/build_leap_data.js` → `words_data.js` / `examples_data.js` を差し替え。Part 範囲を超える場合は `LEAP_PARTS` とカスタム範囲の `max` も更新。
2. 古文: `kobun/kobun_words_data.js` に追記（`id = 10000 + 冊内番号`、`part` は章）。`KOBUN_PARTS` も更新。
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
- `index.html` のインライン JS は `js/core.js` → `js/mock-exam.js` の後に実行される。**トップレベルの宣言名をファイル間で重複させない**（クラシックスクリプトのため `const` 重複は全画面停止につながる）。分割時は `^ {4}(function|const|let|var)` の宣言名を全ファイルで突き合わせて確認する。
- 設定シート（`settings-modal`）の「データ」欄に **JSON エクスポート／インポート**を追加。`LEAP_` で始まる保存キーだけを `{ app: "LEAP_QUIZ_BACKUP", appVer, exportedAt, keys }` 形式で書き出し、復元は `showConfirm` の確認後に同じキーだけを上書きして再読み込みする（Supabase の認証トークンは対象外）。
- 設定シートの「🔧 詳細・診断情報」（`details#system-diag`）は、アプリ版、localStorage のキー数と使用量、クラウド接続・同期状態、対象ゾーンの収録語数、Part 別語数、SW キャッシュ名を表示する（`renderSystemDiagnostics`、開いたときに再計算）。
- **例文クイズは ID 1〜2000 のみ**（2001〜2300 は語義4択のみ）。
- **古文は 150 語（2章）まで**。330 語構想の 3〜5 章は未投入。
- `kobun/kobun_config.js` / `kobun_loader.js` は未使用。設定を変えても現行 `index.html` には影響しない。
- **リーダー（`screen-reader`）は UI 入口なし**。コードは残存。
- 参考資料の第5部クイズは採点・保存なし（学習補助の読み物）。
- 外部 CDN（Tailwind / html2canvas / Google Fonts）に依存。オフライン時はキャッシュ済みの範囲で動作するが、初回はオンラインが必要。
- 共有 URL は Base64 化した結果情報のみ（個人情報・進捗は含まない）。
- **全国一斉模試の受験はログイン不要**。未ログインの結果は端末（`LEAP_MOCK_LOCAL_RESULTS_V1`）に保存し、ログイン後に全国集計へ提出できる。全国偏差値・順位・志望校判定の集計だけが Supabase ＋ ログインを必要とする。Supabase 未設定時はオフライン練習模試のみ表示する。
- 模試の偏差値・志望校判定は受験者数が少ないうちは暫定（N < 5 で「判定保留」）。`mock_exam_results` は 1 人 1 回（`(exam_id, user_id)` unique）で、再受験分は保存されない（画面では参考表示）。
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
