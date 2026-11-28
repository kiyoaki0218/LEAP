/* ============================================================
   模試の採点（3PL + EAP）— DOM 非依存
   ------------------------------------------------------------
   素点ではなく「難易度つきの項目への正誤」から能力θを推定する。
   p(θ) = c + (1-c) / (1 + exp(-a(θ-b)))
     a = 1.0（識別力は固定）
     c = 0.25（4択の当て推量）
   θ の事前分布は N(0,1)。θ を格子状に評価して EAP（事後平均）を取る。
   偏差値 = 50 + 10θ（表示は 20〜80 に丸めるが、θ と信頼区間は保持）
   ============================================================ */
(function (root) {
  const SLOPE = 1.0;
  const GUESS = 0.25;
  const PRIOR_SD = 1.0;
  const GRID_MIN = -4;
  const GRID_MAX = 4;
  const GRID_STEP = 0.1;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function p3pl(theta, b) {
    return GUESS + (1 - GUESS) / (1 + Math.exp(-SLOPE * (theta - b)));
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map((it) => ({ b: Number(it && it.b), correct: !!(it && it.correct) }))
      .filter((it) => Number.isFinite(it.b));
  }

  // items: [{ b, correct }] → { theta, se, deviation, lo, hi, correct, total, logLik }
  function estimateAbility(items, options) {
    const list = normalizeItems(items);
    const total = list.length;
    const correct = list.filter((it) => it.correct).length;
    if (!total) {
      return { theta: 0, se: PRIOR_SD, deviation: 50, lo: 30, hi: 70, correct: 0, total: 0 };
    }
    const priorSd = Number(options && options.priorSd) > 0 ? Number(options.priorSd) : PRIOR_SD;
    const grid = [];
    for (let t = GRID_MIN; t <= GRID_MAX + 1e-9; t += GRID_STEP) {
      let logL = 0;
      for (let i = 0; i < total; i++) {
        const p = clamp(p3pl(t, list[i].b), 1e-6, 1 - 1e-6);
        logL += list[i].correct ? Math.log(p) : Math.log(1 - p);
      }
      const logPrior = -0.5 * (t / priorSd) * (t / priorSd);
      grid.push({ t, w: Math.exp(logL + logPrior) });
    }
    const sumW = grid.reduce((s, g) => s + g.w, 0) || 1e-12;
    let mean = 0;
    grid.forEach((g) => { mean += g.t * g.w; });
    mean /= sumW;
    let variance = 0;
    grid.forEach((g) => { variance += g.w * (g.t - mean) * (g.t - mean); });
    variance /= sumW;
    const se = Math.sqrt(Math.max(variance, 1e-6));
    return {
      theta: mean,
      se,
      deviation: deviationFromTheta(mean),
      lo: deviationFromTheta(mean - 1.645 * se),
      hi: deviationFromTheta(mean + 1.645 * se),
      correct,
      total
    };
  }

  function deviationFromTheta(theta) {
    return clamp(Math.round((50 + 10 * theta) * 10) / 10, 20, 80);
  }

  // 志望校 tier 別のしきい値（偏差値スケール）
  const JUDGE_THRESHOLDS = {
    1: [65, 58, 50],
    2: [62, 55, 47],
    3: [58, 50, 43],
    4: [53, 45, 38]
  };

  // 信頼区間の下限で判定する（1回の模試で過大評価しない）
  function judgeTier(tier, deviationLo, options) {
    const th = JUDGE_THRESHOLDS[Number(tier)] || JUDGE_THRESHOLDS[3];
    const dev = Number(deviationLo);
    if (!Number.isFinite(dev)) {
      return { grade: null, label: "判定保留", note: "偏差値を算出できませんでした" };
    }
    let idx = dev >= th[0] ? 0 : dev >= th[1] ? 1 : dev >= th[2] ? 2 : 3;
    const within = Number(options && options.percentileWithin);
    if (options && options.percentileWithin !== undefined && options.percentileWithin !== null && Number.isFinite(within)) {
      if (within <= 25 && idx > 0) idx -= 1;
      else if (within >= 80 && idx < 3) idx += 1;
    }
    const grades = ["A", "B", "C", "D"];
    const labels = ["A（合格圏）", "B（挑戦圏）", "C（要強化）", "D（基礎固め）"];
    return {
      grade: grades[idx],
      label: labels[idx],
      threshold: th[idx],
      note: `tier ${Number(tier) || 3}基準 ／ 偏差値（下限）${Math.round(dev * 10) / 10}`
    };
  }

  // Part → 難易度 b（個別上書きがあれば優先）
  function bForWord(word, difficulty) {
    const table = difficulty || (typeof LEAP_DIFFICULTY !== "undefined" ? LEAP_DIFFICULTY : null);
    if (!table) return 0;
    const id = word && word.id;
    const override = id !== undefined && table.words ? table.words[id] : null;
    if (override && Number.isFinite(Number(override.b))) return Number(override.b);
    const part = Number(word && word.part);
    const def = table.parts ? table.parts[part] : null;
    return def && Number.isFinite(Number(def.b)) ? Number(def.b) : 0;
  }

  // 受験の answers([{ id, correct }]) と単語データから項目列を作る
  function itemsFromAnswers(answers, wordById, difficulty) {
    if (!Array.isArray(answers)) return [];
    return answers
      .map((a) => {
        const word = wordById && a ? wordById[a.id] : null;
        if (!word) return null;
        return { b: bForWord(word, difficulty), correct: !!a.correct };
      })
      .filter(Boolean);
  }

  function partBreakdown(items, wordByAnswerId, answers) {
    const out = {};
    if (!Array.isArray(items) || !Array.isArray(answers)) return out;
    items.forEach((it, i) => {
      const word = wordByAnswerId && answers[i] ? wordByAnswerId[answers[i].id] : null;
      const part = word ? Number(word.part) : 0;
      if (!part) return;
      if (!out[part]) out[part] = { correct: 0, total: 0 };
      out[part].total += 1;
      if (it.correct) out[part].correct += 1;
    });
    return out;
  }

  root.LeapMockScore = {
    p3pl,
    estimateAbility,
    deviationFromTheta,
    judgeTier,
    bForWord,
    itemsFromAnswers,
    partBreakdown,
    JUDGE_THRESHOLDS
  };
})(typeof window !== "undefined" ? window : globalThis);
