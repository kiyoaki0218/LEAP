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

  root.LeapRoadmapPlan = { computePlan, daysBetween, addDays, STORAGE_KEY };
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
      const done = inPart.filter((w) => {
        const s = stats[w.id];
        return s && Number(s.total) > 0;
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
    if (plan.remaining === 0) return "✅ 範囲をすべて学習済みです";
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
            <span>習得 ${plan.totalDone} / ${plan.totalWords} 語</span><span>${pct}%</span>
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
      return { id: f.id, label: `${f.univ} ${f.faculty}`, tier: Number(g.tier) || 3 };
    });
  }

  function renderRoadmapScreen() {
    const body = document.getElementById("roadmap-body");
    if (!body) return;
    const rm = roadmap();
    const opts = facultyOptions();
    const tierLabels = (typeof MOCK_TIER_LABELS !== "undefined") ? MOCK_TIER_LABELS : {};
    const currentLabel = rm ? rm.label : "";
    const plan = currentPlan();

    const schoolList = opts.slice(0, 400).map((o) =>
      `<option value="${typeof escapeHtml === "function" ? escapeHtml(o.label) : o.label}"></option>`).join("");

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
          <label class="block">
            <span class="text-[11px] font-bold text-slate-600">志望校（大学 学部）</span>
            <input id="roadmap-school" list="roadmap-school-list" value="${typeof escapeHtml === "function" ? escapeHtml(currentLabel) : currentLabel}" placeholder="例: 早稲田大学 政治経済学部" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <datalist id="roadmap-school-list">${schoolList}</datalist>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-[11px] font-bold text-slate-600">試験日</span>
              <input id="roadmap-date" type="date" value="${rm && rm.examDate ? rm.examDate : ""}" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            </label>
            <label class="block">
              <span class="text-[11px] font-bold text-slate-600">目標偏差値</span>
              <input id="roadmap-target" type="number" min="30" max="80" step="1" value="${rm && rm.targetDeviation ? rm.targetDeviation : 60}" class="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            </label>
          </div>
          <p class="text-[10px] text-slate-400 leading-relaxed">志望校は候補から選ぶと難易度（tier）が自動で入ります。候補に無い場合は自由入力でOKです。</p>
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
          <p class="text-[10px] text-slate-400 leading-relaxed">模試の偏差値が目標に届かないときは、発展（Part 4–5）の習得を優先すると伸びやすいです。</p>
        </div>` : ""}
      </div>`;
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
