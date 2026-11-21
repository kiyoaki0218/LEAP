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

最終更新: 2026-11-21

---

## 0. 30秒サマリ（AI向け）

- **何か**: 大学受験英単語帳「LEAP」の 4択クイズ × ゲーム要素の学習 PWA。加えて「裏世界」ゾーンで古文単語クイズも遊べる。
- **構成**: ビルド不要の**静的サイト**。`index.html` 1ファイルに HTML/CSS/JS をほぼ全部持ち、データは `*_data.js` の JS 定数。
- **バックエンドなし**: アカウント・サーバー・DB なし。進捗はすべてブラウザの **localStorage**。
- **収録**: 英単語 2,300 語（Part 1〜5）／例文・単語詳細 2,300 語分・例文クイズ 2,000 語分／参考資料 5 章／接辞 32 グループ・132 語根／古文単語 150 語（2 章）。
- **主な遊び**: 通常4択・例文穴埋め・60秒スプリント・サドンデス、デイリーチャレンジ、忘却曲線の苦手復習、コイン/EXP/レベル、称号・フレーム・アバター、実績 93 種、共有URL（挑戦状）。
- **ホスティング**: 静的ホスティング（Vercel 想定。`vercel.json` なし、`.vercel/` は gitignore）。
- **主要ファイル**: `index.html`（アプリ本体）、`words_data.js`、`examples_data.js`、`reference_data.js`、`affix_data.js`、`kobun/kobun_words_data.js`、`sw.js`、`manifest.json`、`LEAP単語データ/`（元データ）、`patches/`（データ生成・一括改修スクリプト）。

---

## 1. サービス概要

| 項目 | 内容 |
|---|---|
| 名称 | LEAP 4択英単語クイズ（PWA 名: LEAP Quiz） |
| 目的 | 大学受験用英単語帳「LEAP」の語義を、4択クイズで素早く・反復して覚える |
| 対象 | 高校生・受験生（スマホ利用が主。ホーム画面に追加してアプリ風に使う） |
| 言語 | UI は日本語。学習対象は英単語（＋古文単語） |
| 課金 | なし。コインは学習で貯まるゲーム内通貨のみ |
| アカウント | なし。端末ローカル保存のみ（端末間同期なし） |
| オフライン | Service Worker により、初回読み込み後はオフライン起動可 |
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
| マークアップ | 単一 `index.html` | 画面（section）＋モーダル＋インライン JS/CSS |
| スタイル | Tailwind CSS（CDN: `cdn.tailwindcss.com`）＋ インライン CSS | ダークモードは `html.dark` / `data-theme="dark"` の CSS 上書き |
| フォント | Google Fonts（Inter / Noto Sans JP） | |
| 画像生成 | html2canvas 1.4.1（CDN） | 結果カードのスクリーンショット保存 |
| 音声 | Web Speech API（`speechSynthesis`） | 英単語は `en-US`、古文は `ja-JP` |
| 永続化 | localStorage | キー一覧は §11 |
| オフライン | `sw.js`（Cache API） | キャッシュ名 `leap-v20`、Network-First |
| PWA | `manifest.json`、アイコン各種 | standalone 表示、theme `#059669` |
| ビルド | なし | `.js` データは `<script>` で直接読む |

### キャッシュ更新の仕組み

- `index.html` 冒頭の `APP_VER`（現在 `leap-v3-51fixautotap`）が `localStorage.LEAP_APP_CACHE_VER` と違えば、全 Cache を削除。
- `sw.js` は `install` で `skipWaiting()`、`activate` で旧キャッシュ削除＋`clients.claim()`。
- 取得は Network-First（HTML は常に最新、オフライン時のみキャッシュ）。
- **フロントを更新したら `sw.js` の `CACHE` 名と `index.html` の `APP_VER` を上げる**のが運用ルール。

### 画面（section）一覧

`SCREENS` 配列で管理し、`navigate(id)` で切替（ブラウザ戻る/進むにも対応）。

| id | 画面 | 役割 |
|---|---|---|
| `screen-home` | ホーム | ゾーン切替、プレイヤーカード、連続学習、苦手バナー、各機能への入口 |
| `screen-select` | 出題範囲＆設定 | スタイル／ゲームモード／Part・カスタム範囲／出題数／学習状況フィルタ |
| `screen-quiz` | クイズ | 問題カード、4択、タイマー、コンボ、次へ |
| `screen-result` | 結果 | スコア、正答率、間違い一覧、共有・画像保存・再挑戦 |
| `screen-shop` | ショップ | 前称号／後称号／フレーム／アバターの購入・装着 |
| `screen-dictionary` | 単語辞典 | 検索・Part/ID範囲/学習状況フィルタ・ページ送り・単語詳細 |
| `screen-reference` | 参考資料 | 語源・接頭辞・接尾辞・発音・英作文の解説と確認クイズ |
| `screen-affix` | 語源ラッシュ ハブ | ラッシュ／神経衰弱への入口、ベスト記録 |
| `screen-affix-rush` | 語源ラッシュ | 60秒・接辞の4択ラッシュ |
| `screen-affix-memory` | 接辞神経衰弱 | カードめくりで語根と意味を一致させる |
| `screen-reader` | レベル別リーダー | 例文から長文を自動生成して読む（**現在 UI 入口なし＝休眠機能**） |

モーダル／ダイアログ: 実績、苦手単語一覧、単語詳細シート、リーダー単語ポップ、確認ダイアログ（`showConfirm`/`showAlert`）、トースト。

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

## 4. 出題（クイズ）ロジック

### 4.1 範囲の決め方

- **Part から選択**: Part を複数選択（`selectedRange.partIds`）。全選択／全解除あり。
- **カスタム範囲**: 開始 ID・終了 ID を直接入力（`getCustomRangeSelection()`）。ゾーンごとに保存キーが別。
- 出題数: 10 / 20 / 50 / 100 / 全問 / 自由入力（1〜1000）。
- 学習状況フィルタ（複数選択・OR）: `すべて` / `未学習` / `苦手` / `学習中` / `マスター`。

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

- 出題スタイルは `LEAP_QUIZ_STYLE_V1` に保存。
- 例文クイズは `LEAP_WORD_DETAILS` の `examples[].prompt`（空所化済み）を優先。無ければ `LEAP_EXAMPLE_DATA` から `buildCloze()` で空所化。
- 例文があるのは ID 1〜2000。範囲に例文付き単語が無い場合は UI が「例文あり 0 語」と警告。

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

## 8. 結果画面・共有・挑戦状

- 結果画面に表示: スコア、正答数、正答率、最大コンボ、獲得コイン、EXP、レベルアップ、称号、間違えた単語一覧、デイリーバッジ。
- **共有URL**（`generateResultUrl`）: 現在の URL に `?r=` を付け、以下の JSON を UTF-8 安全 Base64 にしたもの。

```json
{ "s": 正解数, "t": 出題数, "a": 正答率, "c": 最大コンボ,
  "t2": "称号", "rs": 開始ID, "re": 終了ID, "rl": "範囲ラベル", "z": "leap|kobun" }
```

- 共有先: X（Twitter）投稿、LINE 共有、URL コピー。
- **画像保存**: html2canvas で結果カードを PNG 化してダウンロード（共有ボックスは撮影時に非表示）。
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
| `LEAP_QUIZ_STYLE_V1` | `"normal"` / `"context"` |
| `LEAP_GAME_MODE_V1` | `"normal"` / `"sprint"` / `"sudden"` |
| `LEAP_QUIZ_STATUS_FILTER_V2` | 学習状況フィルタ（配列。V1 は旧形式） |
| `LEAP_DICTIONARY_FILTER_V1` | 辞典の Part / ID範囲 / 学習状況フィルタ |
| `LEAP_DICT_FILTER_OPEN_V1` | 辞典フィルタパネルの開閉 |
| `LEAP_AFFIX_TYPE_V1` | 語源ラッシュの接頭辞/接尾辞 |
| `LEAP_PWA_BANNER_DISMISSED_V1` | PWA バナーを閉じたか |
| `LEAP_APP_CACHE_VER` | アプリのキャッシュバージョン（`APP_VER` と比較） |

### 11.2 `userData` の主なフィールド

```js
{
  coins, exp, level,
  prefix, suffix, purchasedPrefixes[], purchasedSuffixes[],
  ownedFrames[], equippedFrame, ownedAvatars[], equippedAvatar,
  wordStats: { [wordId]: { correct, total } },      // 単語別の正解/出題回数
  weakWords: { [wordId]: { id, word, meaning, count, stage, nextReview, lastReviewed } },
  scoreHistory: [ { score, correct, total, accuracy, combo, coins, range, date, isDaily } ], // 最大5件
  totalQuizzes, maxComboEver,
  streak, lastPlayDate, lastDailyDate, dailyClears, reviewClears,
  voiceEnabled, affixStats: {}, readerRuns, dictOpened
}
```

- `wordStats` / `weakWords` は **ID キー**。英単語 1〜2300、古文 10001〜 で衝突しない。
- 旧称号名は `SUFFIX_NAME_MIGRATION` / `PREFIX_NAME_MIGRATION` で新形式へ移行。

---

## 12. ファイル構成

```
/
├── index.html                 アプリ本体（HTML + CSS + JS、約38万文字）
├── manifest.json              PWA マニフェスト
├── sw.js                      Service Worker（キャッシュ leap-v20 / Network-First）
├── words_data.js              LEAP_WORDS_DATA（2,300語）
├── examples_data.js           LEAP_WORD_DETAILS（2,300語）+ LEAP_EXAMPLE_DATA（2,000語）
├── reference_data.js          LEAP_REFERENCE_DATA（5章）
├── affix_data.js              AFFIX_DATA（接頭辞16 + 接尾辞16、132語根）
├── kobun/
│   ├── kobun_words_data.js    KOBUN_WORDS_DATA（150語）+ KOBUN_PARTS
│   ├── kobun_config.js        未使用の設定足場（enabled=false）
│   └── kobun_loader.js        未使用の統合ヘルパー（window.KOBUN）
├── docs/
│   └── 古文単語330_追加構想.md  古文5章330語の設計・実装手順メモ
├── LEAP単語データ/
│   ├── 001_101.txt … 2001_2300.txt   元テキスト（語義・IPA・コラム）
│   ├── code_artifact.txt             参考資料の元テキスト
│   └── words.json                    英単語 JSON
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

## 13. 開発・確認手順

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

## 14. 既知の制約・注意点

- **端末間同期なし**。localStorage を消すと全進捗が消える（エクスポート機能なし）。
- **例文クイズは ID 1〜2000 のみ**（2001〜2300 は語義4択のみ）。
- **古文は 150 語（2章）まで**。330 語構想の 3〜5 章は未投入。
- `kobun/kobun_config.js` / `kobun_loader.js` は未使用。設定を変えても現行 `index.html` には影響しない。
- **リーダー（`screen-reader`）は UI 入口なし**。コードは残存。
- 参考資料の第5部クイズは採点・保存なし（学習補助の読み物）。
- 外部 CDN（Tailwind / html2canvas / Google Fonts）に依存。オフライン時はキャッシュ済みの範囲で動作するが、初回はオンラインが必要。
- 共有 URL は Base64 化した結果情報のみ（個人情報・進捗は含まない）。
- 古文の `meaning` は「、」区切りの現代語訳で、複数語義の整形はデータ側の表記に依存。

---

## 15. 更新履歴

> ここに**日付・変更内容**を追記していく。新しいものが上。

| 日付 | 変更内容 |
|---|---|
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
