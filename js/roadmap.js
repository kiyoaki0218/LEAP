/* ============================================================
   志望校ロードマップ
   ------------------------------------------------------------
   志望校と試験日から「1日あたりの語数」と「Part ごとの期限」を逆算し、
   いまの習得状況と比べて先行/遅れを出す。
   計算部分（LeapRoadmapPlan）は DOM 非依存でテスト可能。
   ============================================================ */
(function (root) {
  const STORAGE_KEY = "LEAP_ROADMAP_V1";

  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  function daysBetween(from, to) {
    const a = parseDate(from), b = parseDate(to);
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function addDays(dateStr, days) {
    const d = parseDate(dateStr);
    if (!d) return dateStr;
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  // 学年（高1/高2/高3/既卒）と入試区分から、一般的な試験日を求める
  function academicYearStart(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return null;
    return d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  }

  // grade: k1 | k2 | k3 | ronin / examType: private（私大一般 2/1）| national（国公立2次 2/25）
  function defaultExamDate(grade, examType, today) {
    const d = parseDate(today);
    if (!d) return "";
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    let examYear;
    if (grade === "ronin") {
      examYear = m >= 3 ? y + 1 : y;
    } else {
      const g = { k1: 1, k2: 2, k3: 3 }[grade];
      const base = academicYearStart(today);
      if (!g || base === null) return "";
      examYear = base + (4 - g);
    }
    return `${examYear}-${examType === "national" ? "02-25" : "02-01"}`;
  }

  // parts: [{ part, label, total, done }]
  function computePlan(input) {
    const src = input || {};
    const today = src.today;
    const examDate = src.examDate;
    const parts = (Array.isArray(src.parts) ? src.parts : [])
      .map((p) => ({
        part: Number(p.part) || 0,
        label: String(p.label || (p.part ? `Part ${p.part}` : "")),
        total: Math.max(0, Number(p.total) || 0),
        done: Math.max(0, Number(p.done) || 0)
      }))
      .sort((a, b) => a.part - b.part);

    const totalWords = parts.reduce((s, p) => s + p.total, 0);
    const totalDone = parts.reduce((s, p) => s + Math.min(p.total, p.done), 0);
    const remaining = Math.max(0, totalWords - totalDone);
    const daysLeft = Math.max(0, daysBetween(today, examDate));
    const wordsPerDay = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, daysLeft));

    const milestones = [];
    let cumulative = 0;
    parts.forEach((p) => {
      const rem = Math.max(0, p.total - Math.min(p.total, p.done));
      if (rem === 0) {
        milestones.push({ part: p.part, label: p.label, total: p.total, done: p.done, remaining: 0, dueDate: today, complete: true });
        return;
      }
      cumulative += rem;
      const ratio = remaining ? cumulative / remaining : 1;
      const offset = Math.max(1, Math.ceil(daysLeft * ratio));
      milestones.push({
        part: p.part,
        label: p.label,
        total: p.total,
        done: p.done,
        remaining: rem,
        cumulative,
        dueDate: addDays(today, Math.min(Math.max(daysLeft, 1), offset)),
        complete: false
      });
    });

    const startDate = src.startDate || today;
    const elapsed = Math.max(0, daysBetween(startDate, today));
    const totalSpan = Math.max(1, elapsed + daysLeft);
    const expectedDone = Math.round(totalWords * elapsed / totalSpan);
    const diff = totalDone - expectedDone;
    const slack = Math.max(5, wordsPerDay);
    const status = diff > slack ? "ahead" : diff < -slack ? "behind" : "ontrack";
    const daysBehind = wordsPerDay > 0 ? Math.ceil(Math.max(0, -diff) / wordsPerDay) : 0;

    return {
      today,
      examDate,
      totalWords,
      totalDone,
      remaining,
      daysLeft,
      wordsPerDay,
      progress: totalWords ? totalDone / totalWords : 0,
      expectedDone,
      diff,
      status,
      daysBehind,
      overdue: daysBetween(today, examDate) < 0 && remaining > 0,
      milestones
    };
  }

  root.LeapRoadmapPlan = { computePlan, daysBetween, addDays, academicYearStart, defaultExamDate, STORAGE_KEY };
})(typeof window !== "undefined" ? window : globalThis);

/* ============================================================
   画面（DOM）— ブラウザでのみ動く
   ============================================================ */
(function (root) {
  if (typeof document === "undefined") return;
  const PLAN = root.LeapRoadmapPlan;

  function todayStr() {
    if (typeof getTodayString === "function") return getTodayString();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function userDataRef() {
    return typeof userData !== "undefined" && userData ? userData : null;
  }

  function roadmap() {
    const db = userDataRef();
    return (db && db.roadmap) || null;
  }

  function saveRoadmap(data) {
    const db = userDataRef();
    if (!db) return;
    db.roadmap = data;
    if (typeof saveUserData === "function") saveUserData();
    if (typeof renderHomeRoadmapCard === "function") renderHomeRoadmapCard();
    if (typeof renderHomeDailyGoal === "function") renderHomeDailyGoal();
  }

  function zoneParts() {
    const parts = (typeof PARTS !== "undefined" && Array.isArray(PARTS)) ? PARTS : [];
    const words = (typeof ALL_WORDS !== "undefined" && Array.isArray(ALL_WORDS)) ? ALL_WORDS : [];
    const db = userDataRef();
    const stats = (db && db.wordStats) || {};
    return parts.map((p) => {
      const inPart = words.filter((w) => w.part === p.id);
      // 「マスター」= 3回以上正解かつ正答率90%以上（getWordStatus と同じ判定）。
      // 一度解いただけの単語は残り語数に数える。
      const done = inPart.filter((w) => {
        if (typeof getWordStatus === "function") return getWordStatus(w.id) === "mastered";
        const s = stats[w.id];
        if (!s || !Number(s.total)) return false;
        return Number(s.correct) >= 3 && Math.round((s.correct / s.total) * 100) >= 90;
      }).length;
      return { part: p.id, label: p.name || `Part ${p.id}`, total: inPart.length, done };
    }).filter((p) => p.total > 0);
  }

  function currentPlan() {
    const rm = roadmap();
    if (!rm || !rm.examDate) return null;
    return PLAN.computePlan({
      today: todayStr(),
      startDate: rm.startDate || rm.createdAt || todayStr(),
      examDate: rm.examDate,
      parts: zoneParts()
    });
  }

  function dueReviewCount() {
    if (typeof getDueWeakWords === "function") {
      try { return getDueWeakWords().length; } catch (e) {}
    }
    const db = userDataRef();
    const words = (typeof ALL_WORDS !== "undefined" && Array.isArray(ALL_WORDS)) ? ALL_WORDS : [];
    const ids = new Set(words.map((w) => w.id));
    const today = todayStr();
    return Object.values((db && db.weakWords) || {}).filter((w) => w && ids.has(w.id) && (!w.nextReview || w.nextReview <= today)).length;
  }

  function roadmapDailyTarget() {
    const plan = currentPlan();
    if (!plan) return 0;
    return Math.max(0, plan.wordsPerDay + dueReviewCount());
  }

  function statusText(plan) {
    if (!plan) return "";
    if (plan.overdue) return "⚠️ 試験日を過ぎています。試験日を更新してください";
    if (plan.remaining === 0) return "✅ 範囲をすべてマスター済みです";
    if (plan.status === "ahead") return `🚀 予定より ${plan.diff} 語すすんでいます`;
    if (plan.status === "behind") return `🐢 予定より ${Math.abs(plan.diff)} 語おくれ（約${plan.daysBehind}日）`;
    return "🟢 予定どおり進んでいます";
  }

  function renderHomeRoadmapCard() {
    const card = document.getElementById("home-roadmap-card");
    if (!card) return;
    const rm = roadmap();
    const plan = currentPlan();
    if (!rm || !plan) {
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-xl">🎯</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-extrabold text-slate-900">志望校ロードマップ</p>
            <p class="text-[11px] text-slate-500 mt-0.5">志望校と試験日から、1日のノルマとPart期限を自動で作ります</p>
          </div>
          <button type="button" onclick="openRoadmap()" class="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">計画を作る</button>
        </div>`;
      return;
    }
    const pct = Math.round(plan.progress * 100);
    const target = roadmapDailyTarget();
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold text-indigo-600">志望校ロードマップ</p>
          <p class="text-sm font-extrabold text-slate-900 truncate">${typeof escapeHtml === "function" ? escapeHtml(rm.label || "志望校") : (rm.label || "志望校")}</p>
          <p class="text-[11px] text-slate-500 mt-0.5">試験日 ${plan.examDate}（あと ${plan.daysLeft} 日）</p>
        </div>
        <button type="button" onclick="openRoadmap()" class="shrink-0 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer">見直す</button>
      </div>
      <div class="mt-3 flex items-end gap-4">
        <div class="shrink-0">
          <p class="text-[10px] text-slate-400 font-bold">今日のノルマ</p>
          <p class="text-lg font-extrabold text-indigo-700 leading-tight">${target} <span class="text-[11px] text-slate-500">問</span></p>
          <p class="text-[10px] text-slate-400">新規 ${plan.wordsPerDay} ＋ 復習 ${dueReviewCount()}</p>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>マスター ${plan.totalDone} / ${plan.totalWords} 語</span><span>${pct}%</span>
          </div>
          <div class="h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width:${pct}%"></div></div>
          <p class="text-[10px] mt-1.5 font-bold ${plan.status === "behind" ? "text-rose-600" : plan.status === "ahead" ? "text-emerald-600" : "text-slate-500"}">${statusText(plan)}</p>
        </div>
      </div>`;
  }

  // ---- 画面 ----
  function facultyOptions() {
    const list = (typeof MOCK_FACULTIES !== "undefined" && Array.isArray(MOCK_FACULTIES)) ? MOCK_FACULTIES : [];
    const groups = (typeof MOCK_UNIV_GROUPS !== "undefined" && MOCK_UNIV_GROUPS) ? MOCK_UNIV_GROUPS : {};
    return list.map((f) => {
      const g = groups[f.groupId] || {};
      return { id: f.id, label: `${f.univ} ${f.faculty}`, tier: Number(g.tier) || 3, category: g.category || "" };
    });
  }

  function esc(s) {
    return typeof escapeHtml === "function"
      ? escapeHtml(String(s))
      : String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function guessExamType(examDate) {
    return /^\d{4}-02-2\d$/.test(String(examDate || "")) ? "national" : "private";
  }

  function tierOf(label) {
    const hit = facultyOptions().find((o) => o.label === String(label || "").trim());
    return hit ? hit.tier : null;
  }

  function updateSchoolTier(label) {
    const el = document.getElementById("roadmap-school-tier");
    if (!el) return;
    const tier = tierOf(label);
    const labels = (typeof MOCK_TIER_LABELS !== "undefined") ? MOCK_TIER_LABELS : {};
    el.textContent = tier ? `難易度: ${labels[tier] || tier}` : (String(label || "").trim() ? "自由入力" : "");
  }

  root.selectRoadmapSchool = function (btn) {
    const label = String((btn && btn.dataset && btn.dataset.label) || "").trim();
    if (!label) return;
    const input = document.getElementById("roadmap-school");
    if (input) input.value = label;
    root.filterRoadmapSchools();
  };

  root.filterRoadmapSchools = function () {
    const input = document.getElementById("roadmap-school");
    const box = document.getElementById("roadmap-school-results");
    if (!input || !box) return;
    const raw = String(input.value || "").trim();
    // スペース区切りはAND検索。「早稲田 政経」のような略称も拾う。
    const ALIAS = { 政経: "政治経済" };
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean).map((t) => ALIAS[t] || t);
    const opts = facultyOptions();
    const tierLabels = (typeof MOCK_TIER_LABELS !== "undefined") ? MOCK_TIER_LABELS : {};
    const norm = (o) => `${o.label} ${o.category}`.toLowerCase().replace(/\s+/g, "");
    const matches = (tokens.length ? opts.filter((o) => tokens.every((t) => norm(o).includes(t))) : opts).slice(0, 40);
    const rows = matches.map((o) => `
        <button type="button" data-label="${esc(o.label)}" onclick="selectRoadmapSchool(this)" class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-indigo-50 transition cursor-pointer">
          <span class="text-xs font-bold text-slate-700 truncate">${esc(o.label)}</span>
          <span class="text-[9px] font-bold text-slate-400 shrink-0">${esc(tierLabels[o.tier] || "")}</span>
        </button>`).join("");
    box.innerHTML = rows || `<p class="px-3 py-2 text-[11px] text-slate-400 leading-relaxed">候補が見つかりません。そのまま入力すると自由入力として保存できます。</p>`;
    updateSchoolTier(raw);
  };

  root.applyRoadmapExamDefaults = function () {
    const g = document.getElementById("roadmap-grade");
    const t = document.getElementById("roadmap-exam-type");
    const d = document.getElementById("roadmap-date");
    if (!g || !t || !d) return;
    const next = PLAN.defaultExamDate(g.value, t.value, todayStr());
    if (next) d.value = next;
  };

  function renderRoadmapScreen() {
    const body = document.getElementById("roadmap-body");
    if (!body) return;
    const rm = roadmap();
    const currentLabel = rm ? (rm.label || "") : "";
    const grade = (rm && rm.grade) || "k3";
    const examType = (rm && rm.examType) || guessExamType(rm && rm.examDate);
    const examDate = (rm && rm.examDate) || PLAN.defaultExamDate(grade, examType, todayStr());
    const plan = currentPlan();
    const gradeOptions = [["k1", "高1"], ["k2", "高2"], ["k3", "高3"], ["ronin", "既卒"]]
      .map(([v, t]) => `<option value="${v}"${v === grade ? " selected" : ""}>${t}</option>`).join("");
    const examTypeOptions = [["private", "私大一般（2/1）"], ["national", "国公立2次（2/25）"]]
      .map(([v, t]) => `<option value="${v}"${v === examType ? " selected" : ""}>${t}</option>`).join("");

    const milestones = plan ? plan.milestones.map((m) => `
      <li class="flex items-center gap-2 text-[11px] ${m.complete ? "text-slate-400" : "text-slate-700"}">
        <span class="w-14 shrink-0 font-bold">${m.label}</span>
        <span class="shrink-0 tabular-nums">${m.complete ? "完了" : `${m.done}/${m.total}`}</span>
        <span class="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden"><span class="block h-full ${m.complete ? "bg-emerald-400" : "bg-indigo-400"}" style="width:${m.total ? Math.round(m.done / m.total * 100) : 0}%"></span></span>
        <span class="shrink-0 ${m.complete ? "" : "font-bold text-indigo-700"}">${m.complete ? "" : `${m.dueDate}まで`}</span>
      </li>`).join("") : "";

    body.innerHTML = `
      <div class="space-y-3">
        <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-[11px] font-bold text-slate-600">学年</span>
              <select id="roadmap-grade" onchange="applyRoadmapExamDefaults()" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white cursor-pointer">${gradeOptions}</select>
            </label>
            <label class="block">
              <span class="text-[11px] font-bold text-slate-600">入試区分</span>
              <select id="roadmap-exam-type" onchange="applyRoadmapExamDefaults()" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white cursor-pointer">${examTypeOptions}</select>
            </label>
          </div>
          <label class="block">
            <span class="text-[11px] font-bold text-slate-600">試験日（個別に変更できます）</span>
            <input id="roadmap-date" type="date" value="${examDate}" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
          </label>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-600">志望校（大学 学部）</span>
              <span id="roadmap-school-tier" class="text-[10px] font-bold text-slate-400 shrink-0"></span>
            </div>
            <input id="roadmap-school" type="text" autocomplete="off" value="${esc(currentLabel)}" placeholder="例: 早稲田大学 政治経済学部" oninput="filterRoadmapSchools()" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <div id="roadmap-school-results" class="mt-2 max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white"></div>
            <p class="text-[10px] text-slate-400 mt-1 leading-relaxed">候補をタップして選択。一覧に無い場合はそのまま入力して保存できます。</p>
          </div>
          <label class="block">
            <span class="text-[11px] font-bold text-slate-600">目標偏差値</span>
            <input id="roadmap-target" type="number" min="30" max="80" step="1" value="${rm && rm.targetDeviation ? rm.targetDeviation : 60}" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
          </label>
          <div class="flex gap-2">
            <button type="button" onclick="saveRoadmapFromForm()" class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">この計画で保存</button>
            ${rm ? `<button type="button" onclick="clearRoadmap()" class="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer">解除</button>` : ""}
          </div>
        </div>
        ${plan ? `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-extrabold text-slate-900">逆算プラン</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.status === "behind" ? "text-rose-700 bg-rose-50 border-rose-300" : plan.status === "ahead" ? "text-emerald-700 bg-emerald-50 border-emerald-300" : "text-slate-600 bg-slate-50 border-slate-300"}">${statusText(plan)}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-slate-50 rounded-xl py-2"><p class="text-[10px] text-slate-400 font-bold">残り日数</p><p class="text-base font-extrabold text-slate-800">${plan.daysLeft}</p></div>
            <div class="bg-slate-50 rounded-xl py-2"><p class="text-[10px] text-slate-400 font-bold">1日の新規</p><p class="text-base font-extrabold text-indigo-700">${plan.wordsPerDay}<span class="text-[10px]">語</span></p></div>
            <div class="bg-slate-50 rounded-xl py-2"><p class="text-[10px] text-slate-400 font-bold">残り</p><p class="text-base font-extrabold text-slate-800">${plan.remaining}<span class="text-[10px]">語</span></p></div>
          </div>
          <ul class="space-y-2">${milestones}</ul>
          <p class="text-[10px] text-slate-400 leading-relaxed">残り語数は「マスター」した単語だけを差し引きます（3回以上正解かつ正答率90%以上）。模試の偏差値が目標に届かないときは、発展（Part 4–5）のマスターを優先すると伸びやすいです。</p>
        </div>` : ""}
      </div>`;

    filterRoadmapSchools();
  }

  root.openRoadmap = function () {
    try { if (typeof syncModeUi === "function") syncModeUi(); } catch (e) {}
    renderRoadmapScreen();
    if (typeof navigate === "function") navigate("screen-roadmap");
    else {
      const el = document.getElementById("screen-roadmap");
      if (el) el.classList.remove("hidden");
    }
  };

  root.saveRoadmapFromForm = function () {
    const schoolEl = document.getElementById("roadmap-school");
    const dateEl = document.getElementById("roadmap-date");
    const targetEl = document.getElementById("roadmap-target");
    const gradeEl = document.getElementById("roadmap-grade");
    const typeEl = document.getElementById("roadmap-exam-type");
    const label = String((schoolEl && schoolEl.value) || "").trim();
    const examDate = String((dateEl && dateEl.value) || "").trim();
    if (!label) { if (typeof showToast === "function") showToast("志望校を入力してください"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) { if (typeof showToast === "function") showToast("試験日を選んでください"); return; }
    const found = facultyOptions().find((o) => o.label === label);
    const tier = found ? found.tier : 3;
    const prev = roadmap();
    saveRoadmap({
      label,
      tier,
      grade: gradeEl ? gradeEl.value : "k3",
      examType: typeEl ? typeEl.value : "private",
      targetDeviation: Math.min(80, Math.max(30, Number(targetEl && targetEl.value) || 60)),
      examDate,
      startDate: (prev && prev.startDate) || todayStr(),
      createdAt: (prev && prev.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    renderRoadmapScreen();
    if (typeof showToast === "function") showToast("🎯 ロードマップを保存しました");
  };

  root.clearRoadmap = function () {
    const db = userDataRef();
    if (db) delete db.roadmap;
    if (typeof saveUserData === "function") saveUserData();
    renderRoadmapScreen();
    renderHomeRoadmapCard();
    if (typeof renderHomeDailyGoal === "function") renderHomeDailyGoal();
    if (typeof showToast === "function") showToast("ロードマップを解除しました");
  };

  root.renderHomeRoadmapCard = renderHomeRoadmapCard;
  root.renderRoadmapScreen = renderRoadmapScreen;
  root.roadmapDailyTarget = roadmapDailyTarget;
  root.roadmapCurrentPlan = currentPlan;
})(typeof window !== "undefined" ? window : globalThis);
