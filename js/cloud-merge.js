/* ============================================================
   クラウド同期のマージ（苦手単語・忘却曲線）を DOM 非依存で実装
   ------------------------------------------------------------
   端末 A で復習を進めた結果が、端末 B の古いローカルデータとの
   マージで巻き戻らないようにする。
   - 進行度は「最後に学習した日(lastReviewed)が新しい方」を正とする
   - 同じ日なら stage が高い方 → nextReview が遅い方
   - 間違い回数(count)は多い方を残す（履歴として加算的）
   - 克服（卒業）した単語は graduatedWords の tombstone で復活させない
   ============================================================ */
(function (root) {
  function toInt(value, min) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min || 0;
    return n < (min || 0) ? (min || 0) : n;
  }

  function normalizeWeak(id, raw) {
    const w = raw || {};
    return {
      id: toInt(w.id || id, 0),
      word: String(w.word || ""),
      meaning: String(w.meaning || ""),
      count: toInt(w.count, 1) || 1,
      stage: Math.min(4, Math.max(1, toInt(w.stage, 1))),
      nextReview: String(w.nextReview || ""),
      lastReviewed: String(w.lastReviewed || ""),
      source: String(w.source || "quiz")
    };
  }

  function normalizeWeakMap(map) {
    const out = {};
    if (!map || typeof map !== "object") return out;
    Object.keys(map).forEach((id) => {
      const w = map[id];
      if (!w || typeof w !== "object") return;
      out[String(id)] = normalizeWeak(id, w);
    });
    return out;
  }

  function normalizeGraduatedMap(map) {
    const out = {};
    if (!map || typeof map !== "object") return out;
    Object.keys(map).forEach((id) => {
      const date = String(map[id] || "");
      if (date) out[String(id)] = date;
    });
    return out;
  }

  // 同じ単語の2レコードから、学習の進行を失わない方を選ぶ
  function mergeWeakWord(x, y) {
    const a = normalizeWeak(x && x.id, x);
    const b = normalizeWeak(y && y.id, y);
    let winner = a;
    let loser = b;
    if (a.lastReviewed !== b.lastReviewed) {
      winner = a.lastReviewed > b.lastReviewed ? a : b;
      loser = winner === a ? b : a;
    } else if (a.stage !== b.stage) {
      winner = a.stage > b.stage ? a : b;
      loser = winner === a ? b : a;
    } else if (a.nextReview !== b.nextReview) {
      winner = a.nextReview > b.nextReview ? a : b;
      loser = winner === a ? b : a;
    }
    return {
      id: winner.id || loser.id,
      word: winner.word || loser.word,
      meaning: winner.meaning || loser.meaning,
      count: Math.max(a.count, b.count),
      stage: winner.stage,
      nextReview: winner.nextReview || loser.nextReview,
      lastReviewed: winner.lastReviewed || loser.lastReviewed,
      source: winner.source || loser.source || "quiz"
    };
  }

  // { weakWords, graduatedWords } を双方向マージする
  function mergeWeak(local, cloud) {
    const lw = normalizeWeakMap(local && local.weakWords);
    const cw = normalizeWeakMap(cloud && cloud.weakWords);
    const lg = normalizeGraduatedMap(local && local.graduatedWords);
    const cg = normalizeGraduatedMap(cloud && cloud.graduatedWords);

    // 克服日は新しい方（後から克服した記録）を残す
    const graduatedWords = {};
    new Set([...Object.keys(lg), ...Object.keys(cg)]).forEach((id) => {
      graduatedWords[id] = lg[id] && cg[id] ? (lg[id] >= cg[id] ? lg[id] : cg[id]) : (lg[id] || cg[id]);
    });

    const weakWords = {};
    new Set([...Object.keys(lw), ...Object.keys(cw)]).forEach((id) => {
      if (!lw[id]) { weakWords[id] = cw[id]; return; }
      if (!cw[id]) { weakWords[id] = lw[id]; return; }
      weakWords[id] = mergeWeakWord(lw[id], cw[id]);
    });

    // 克服済みの単語は、克服日以降に学習していなければ復活させない
    Object.keys(weakWords).forEach((id) => {
      const grad = graduatedWords[id];
      if (!grad) return;
      const entry = weakWords[id];
      const last = entry.lastReviewed || "";
      if (grad >= last) {
        delete weakWords[id];
      } else {
        // 克服後にまた間違えた記録がある → 苦手に戻っている
        delete graduatedWords[id];
      }
    });

    return { weakWords, graduatedWords };
  }

  root.LeapCloudMerge = { mergeWeakWord, mergeWeak };
})(typeof window !== "undefined" ? window : globalThis);
