/* ============================================================
   古文単語330 統合ローダ（未使用・UI非表示）
   ------------------------------------------------------------
   役割: 古文データを LEAP の ALL_WORDS に「混ぜずに」追加できる
         ようにするための関数だけを用意しておく。
   現在 index.html からは読み込まれていないため、動作には影響しない。

   使い方（将来 index.html 側で有効化するとき）:
     1. <script src="./kobun/kobun_config.js"></script>
        <script src="./kobun/kobun_words_data.js"></script>
        <script src="./kobun/kobun_loader.js"></script>
        を words_data.js の直後に追加
     2. KOBUN_CONFIG.enabled = true にする
     3. const merged = kobunMergeWords(ALL_WORDS);
        ALL_WORDS = merged; のようにして統合

   詳細は docs/古文単語330_追加構想.md を参照。
   ============================================================ */

(function (global) {
  "use strict";

  function getConfig() {
    return typeof KOBUN_CONFIG !== "undefined" ? KOBUN_CONFIG : null;
  }

  function isEnabled() {
    const cfg = getConfig();
    return !!(cfg && cfg.enabled === true);
  }

  // 古文データを正規化（欠損フィールドの補完・型の統一）
  function normalizeKobunWords(list) {
    const cfg = getConfig();
    const base = cfg ? cfg.idBase : 10001;
    const out = [];
    (Array.isArray(list) ? list : []).forEach((w, i) => {
      if (!w || typeof w.word !== "string") return;
      out.push({
        id: typeof w.id === "number" ? w.id : base + i,
        word: w.word,
        reading: typeof w.reading === "string" ? w.reading : "",
        meaning: typeof w.meaning === "string" ? w.meaning : "",
        part: typeof w.part === "number" ? w.part : 101,
        subject: "kobun",
        pos: typeof w.pos === "string" ? w.pos : "",
        conjugation: typeof w.conjugation === "string" ? w.conjugation : "",
        frequency: typeof w.frequency === "number" ? w.frequency : 1,
        note: typeof w.note === "string" ? w.note : ""
      });
    });
    return out;
  }

  // ID重複と範囲外を検査（データ投入時のミス検出用。UIには出さない）
  function validateKobunWords(list) {
    const cfg = getConfig();
    const errors = [];
    const seen = new Set();
    const idMin = cfg ? cfg.idBase : 10001;
    const idMax = cfg ? cfg.idMax : 10330;
    (Array.isArray(list) ? list : []).forEach((w, i) => {
      if (!w || !w.word) { errors.push("index " + i + ": word が空です"); return; }
      if (typeof w.id !== "number") { errors.push(w.word + ": id が数値ではありません"); return; }
      if (seen.has(w.id)) errors.push(w.word + ": id " + w.id + " が重複しています");
      seen.add(w.id);
      if (w.id < idMin || w.id > idMax) errors.push(w.word + ": id " + w.id + " が範囲外です");
      if (!w.meaning) errors.push(w.word + ": meaning が空です");
      const part = cfg && cfg.parts.find(p => p.id === w.part);
      if (!part) errors.push(w.word + ": part " + w.part + " が定義にありません");
      else if (w.id < part.start || w.id > part.end) errors.push(w.word + ": id と part の範囲が食い違っています");
    });
    return errors;
  }

  // 英単語配列に古文を連結（ID衝突時は古文を採用しない）
  function kobunMergeWords(leapWords) {
    const cfg = getConfig();
    const base = Array.isArray(leapWords) ? leapWords.slice() : [];
    if (!isEnabled()) return base;

    const kobun = normalizeKobunWords(global.KOBUN_WORDS_DATA);
    const stats = kobunStats(kobun);
    if (stats.length < 330) {
      // 330語そろうまでは統合しない（部分投入で出題バランスが崩れるのを防ぐ）
      console.warn("[kobun] 語数が不足しています:", stats.length + "/330");
      return base;
    }

    const used = new Set(base.map(w => w.id));
    kobun.forEach(w => { if (!used.has(w.id)) base.push(w); });
    base.sort((a, b) => a.id - b.id);
    return base;
  }

  // 進捗計算用の集計（subject ごとに分離して扱う）
  function kobunStats(words) {
    return (Array.isArray(words) ? words : []).filter(w => w && w.subject === "kobun");
  }

  global.KOBUN = {
    isEnabled: isEnabled,
    config: getConfig,
    normalize: normalizeKobunWords,
    validate: validateKobunWords,
    merge: kobunMergeWords,
    stats: kobunStats
  };
})(typeof window !== "undefined" ? window : globalThis);
