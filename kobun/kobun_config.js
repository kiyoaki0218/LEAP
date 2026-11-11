/* ============================================================
   古文単語330 設定ファイル（未使用・UI非表示）
   ------------------------------------------------------------
   このファイルは index.html からまだ読み込まれていません。
   KOBUN_CONFIG.enabled が false の間は、読み込んでも
   画面には一切影響しません（表示・出題・辞典のどこにも出ません）。

   有効化の手順・設計の詳細は docs/古文単語330_追加構想.md を参照。
   ============================================================ */

const KOBUN_CONFIG = {
  // false の間は完全に無効。true にしたときだけ統合処理が走る。
  enabled: false,

  // 画面に出すときの呼び名（タブ名・見出しに使う想定）
  label: "古文単語330",
  subject: "kobun",

  // LEAP英単語（1〜2300）と衝突しないよう、IDは 10001 から採番する
  idBase: 10001,
  idMax: 10330,

  // 出題範囲の区切り。330語を5分割（各66語）
  parts: [
    { id: 101, name: "古文 Part 1", desc: "動詞・形容詞（基本）", start: 10001, end: 10066 },
    { id: 102, name: "古文 Part 2", desc: "動詞・形容詞（頻出）", start: 10067, end: 10132 },
    { id: 103, name: "古文 Part 3", desc: "名詞・副詞", start: 10133, end: 10198 },
    { id: 104, name: "古文 Part 4", desc: "敬語・慣用表現", start: 10199, end: 10264 },
    { id: 105, name: "古文 Part 5", desc: "和歌・随筆の語", start: 10265, end: 10330 }
  ],

  // 進捗の保存キー。英単語側（LEAP_QUIZ_USER_DATA_V3）とは混ぜない。
  storageKeys: {
    progress: "LEAP_KOBUN_PROGRESS_V1",
    filter: "LEAP_KOBUN_FILTER_V1",
    selection: "LEAP_KOBUN_SELECTED_PARTS_V1"
  },

  // 出題形式：意味を当てる（LEAPと同じ4択）
  quiz: {
    choiceCount: 4,
    // ダミー選択肢は同じ subject の単語から作る（英単語と混ざらない）
    distractorScope: "same-subject"
  }
};
