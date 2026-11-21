# プロジェクト指示（AGENTS）

このリポジトリは「LEAP 4択英単語クイズ」の静的Webアプリです。サービス全体の仕様は `SERVICE.md` に集約しています。

## 必須ルール

1. **機能追加・仕様変更・データ追加・不具合修正をしたら、必ず `SERVICE.md` も同じ変更の中で更新する。**
   - 該当セクションの記述（語数・機能・保存キー・計算式など）を最新にする。
   - `SERVICE.md` 末尾の「更新履歴」に日付と変更内容を追記する（新しいものが上）。
2. コードを変更したら、`sw.js` の `CACHE` バージョンと `index.html` 冒頭の `APP_VER` を必要に応じて上げる。
3. `patches/` 内のスクリプトは過去の一括改修の記録であり、現在の `index.html` に再実行しない（二重適用になる）。

## 構成の要点

- アプリ本体: `index.html`（HTML/CSS/JS を内包、ビルド不要）
- データ: `words_data.js`, `examples_data.js`, `reference_data.js`, `affix_data.js`, `kobun/kobun_words_data.js`
- 永続化: localStorage（常時）＋ 任意の Supabase（Auth / クラウド同期 / フレンド。未設定でもローカルのみで動作）
- 元データ: `LEAP単語データ/`、生成: `patches/build_leap_data.js`

詳細は `SERVICE.md` を参照。
