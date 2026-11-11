import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read()
s = s.replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:180])
    s = s.replace(old, new, 1)


# ================= A. 辞典フィルタ: 複数選択 =================
rep('    let dictionaryFilter = { part: "all", start: "", end: "", status: "all" };',
    '    let dictionaryFilter = { parts: [], start: "", end: "", statuses: [] };')

rep('''    function loadDictionaryFilter() {
      try {
        const saved = JSON.parse(localStorage.getItem(DICT_FILTER_KEY) || "null");
        if (saved && typeof saved === "object") {
          dictionaryFilter.part = ["all", "1", "2"].includes(String(saved.part)) ? String(saved.part) : "all";
          dictionaryFilter.start = saved.start === undefined || saved.start === null ? "" : String(saved.start);
          dictionaryFilter.end = saved.end === undefined || saved.end === null ? "" : String(saved.end);
          dictionaryFilter.status = WORD_STATUSES.includes(String(saved.status)) ? String(saved.status) : "all";
        }
      } catch (e) { console.warn("dictionary filter load failed", e); }
      syncDictionaryFilterUi();
    }''',
'''    function loadDictionaryFilter() {
      try {
        const saved = JSON.parse(localStorage.getItem(DICT_FILTER_KEY) || "null");
        if (saved && typeof saved === "object") {
          const validParts = PARTS.map(p => String(p.id));
          const parts = Array.isArray(saved.parts)
            ? saved.parts.map(String)
            : (saved.part && saved.part !== "all" ? [String(saved.part)] : []);
          const statuses = Array.isArray(saved.statuses)
            ? saved.statuses.map(String)
            : (saved.status && saved.status !== "all" ? [String(saved.status)] : []);
          dictionaryFilter.parts = parts.filter(p => validParts.includes(p));
          dictionaryFilter.statuses = statuses.filter(st => WORD_STATUSES.includes(st) && st !== "all");
          dictionaryFilter.start = saved.start === undefined || saved.start === null ? "" : String(saved.start);
          dictionaryFilter.end = saved.end === undefined || saved.end === null ? "" : String(saved.end);
        }
      } catch (e) { console.warn("dictionary filter load failed", e); }
      syncDictionaryFilterUi();
    }''')

rep('''      document.querySelectorAll("[data-dict-part]").forEach(btn => {
        const active = btn.dataset.dictPart === dictionaryFilter.part;
        btn.classList.toggle("bg-white", active);
        btn.classList.toggle("shadow-sm", active);
        btn.classList.toggle("text-slate-900", active);
        btn.classList.toggle("text-slate-600", !active);
      });''',
'''      const dictChip = (active) => "px-2.5 py-1 text-[11px] font-bold rounded-md border transition cursor-pointer " +
        (active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100");
      document.querySelectorAll("[data-dict-part]").forEach(btn => {
        const pid = btn.dataset.dictPart;
        const active = pid === "all" ? dictionaryFilter.parts.length === 0 : dictionaryFilter.parts.includes(pid);
        btn.className = dictChip(active);
      });''')

rep('''      document.querySelectorAll("[data-dict-status]").forEach(btn => {
        const active = btn.dataset.dictStatus === dictionaryFilter.status;
        btn.className = `px-2.5 py-1 text-[11px] font-bold rounded-md border transition cursor-pointer ${
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
        }`;
      });''',
'''      document.querySelectorAll("[data-dict-status]").forEach(btn => {
        const st = btn.dataset.dictStatus;
        const active = st === "all" ? dictionaryFilter.statuses.length === 0 : dictionaryFilter.statuses.includes(st);
        btn.className = dictChip(active);
      });''')

rep('''    function setDictionaryPartFilter(part) {
      dictionaryFilter.part = part;
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }''',
'''    function setDictionaryPartFilter(part) {
      const value = String(part);
      const valid = PARTS.map(p => String(p.id));
      if (value === "all") {
        dictionaryFilter.parts = [];
      } else if (!valid.includes(value)) {
        return;
      } else if (dictionaryFilter.parts.includes(value)) {
        dictionaryFilter.parts = dictionaryFilter.parts.filter(p => p !== value);
      } else {
        dictionaryFilter.parts = [...dictionaryFilter.parts, value];
      }
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }''')

rep('''    function setDictionaryStatusFilter(status) {
      dictionaryFilter.status = WORD_STATUSES.includes(status) ? status : "all";
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }''',
'''    function setDictionaryStatusFilter(status) {
      if (status === "all" || !WORD_STATUSES.includes(status)) {
        dictionaryFilter.statuses = [];
      } else if (dictionaryFilter.statuses.includes(status)) {
        dictionaryFilter.statuses = dictionaryFilter.statuses.filter(st => st !== status);
      } else {
        dictionaryFilter.statuses = [...dictionaryFilter.statuses, status];
      }
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    function setDictionaryStatusSelection(statuses) {
      dictionaryFilter.statuses = (statuses || []).filter(st => WORD_STATUSES.includes(st) && st !== "all");
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }''')

rep('      dictionaryFilter = { part: "all", start: "", end: "", status: "all" };',
    '      dictionaryFilter = { parts: [], start: "", end: "", statuses: [] };')

rep('''        if (dictionaryFilter.part !== "all" && entry.part !== dictionaryFilter.part) hit = false;
        if (hit && dictionaryFilter.status !== "all" && entry.status !== dictionaryFilter.status) hit = false;''',
'''        if (dictionaryFilter.parts.length > 0 && !dictionaryFilter.parts.includes(entry.part)) hit = false;
        if (hit && dictionaryFilter.statuses.length > 0 && !dictionaryFilter.statuses.includes(entry.status)) hit = false;''')

rep('''      const filtering = query !== "" || dictionaryFilter.part !== "all" || hasRange || dictionaryFilter.status !== "all";''',
'''      const filtering = query !== "" || dictionaryFilter.parts.length > 0 || hasRange || dictionaryFilter.statuses.length > 0;''')

# 複数選択であることが分かるヒント
rep('''          <span class="text-xs font-bold text-slate-500">絞り込み</span>''',
'''          <span class="text-xs font-bold text-slate-500">絞り込み<span class="ml-1 text-[10px] font-normal text-slate-400">複数選択OK</span></span>''')

# ================= B. 出題フィルタ: 複数選択 =================
rep('''    const QUIZ_STATUS_KEY = "LEAP_QUIZ_STATUS_FILTER_V1";
    let quizStatusFilter = "all";

    function loadQuizStatusFilter() {
      try {
        const saved = localStorage.getItem(QUIZ_STATUS_KEY);
        if (WORD_STATUSES.includes(saved)) quizStatusFilter = saved;
      } catch (e) {}
      syncQuizStatusUi();
      updateQuizStatusHint();
    }

    function saveQuizStatusFilter() {
      try { localStorage.setItem(QUIZ_STATUS_KEY, quizStatusFilter); } catch (e) {}
    }

    function setQuizStatusFilter(status) {
      quizStatusFilter = WORD_STATUSES.includes(status) ? status : "all";
      saveQuizStatusFilter();
      syncQuizStatusUi();
      updateQuizStatusHint();
    }

    function syncQuizStatusUi() {
      document.querySelectorAll("[data-quiz-status]").forEach(btn => {
        const active = btn.dataset.quizStatus === quizStatusFilter;
        btn.className = `py-2 text-[11px] font-bold border rounded-lg transition cursor-pointer ${
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
        }`;
      });
    }''',
'''    const QUIZ_STATUS_KEY = "LEAP_QUIZ_STATUS_FILTER_V2";
    const QUIZ_STATUS_LEGACY_KEY = "LEAP_QUIZ_STATUS_FILTER_V1";
    let quizStatusFilters = [];

    function loadQuizStatusFilter() {
      try {
        const saved = localStorage.getItem(QUIZ_STATUS_KEY);
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) quizStatusFilters = arr.filter(st => WORD_STATUSES.includes(st) && st !== "all");
        } else {
          const legacy = localStorage.getItem(QUIZ_STATUS_LEGACY_KEY);
          if (legacy && legacy !== "all" && WORD_STATUSES.includes(legacy)) quizStatusFilters = [legacy];
        }
      } catch (e) {}
      syncQuizStatusUi();
      updateQuizStatusHint();
    }

    function saveQuizStatusFilter() {
      try { localStorage.setItem(QUIZ_STATUS_KEY, JSON.stringify(quizStatusFilters)); } catch (e) {}
    }

    function setQuizStatusFilter(status) {
      if (status === "all" || !WORD_STATUSES.includes(status)) {
        quizStatusFilters = [];
      } else if (quizStatusFilters.includes(status)) {
        quizStatusFilters = quizStatusFilters.filter(st => st !== status);
      } else {
        quizStatusFilters = [...quizStatusFilters, status];
      }
      saveQuizStatusFilter();
      syncQuizStatusUi();
      updateQuizStatusHint();
    }

    function syncQuizStatusUi() {
      document.querySelectorAll("[data-quiz-status]").forEach(btn => {
        const st = btn.dataset.quizStatus;
        const active = st === "all" ? quizStatusFilters.length === 0 : quizStatusFilters.includes(st);
        btn.className = `py-2 text-[11px] font-bold border rounded-lg transition cursor-pointer ${
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
        }`;
      });
    }''')

rep('''      const matched = base.filter(w => wordMatchesStatus(w.id, quizStatusFilter)).length;
      el.textContent = quizStatusFilter === "all"
        ? `全 ${base.length} 語`
        : `該当 ${matched} 語 / ${base.length} 語`;''',
'''      const matched = base.filter(w => wordMatchesStatuses(w.id, quizStatusFilters)).length;
      el.textContent = quizStatusFilters.length === 0
        ? `全 ${base.length} 語`
        : `該当 ${matched} 語 / ${base.length} 語`;''')

rep('''      if (!isDailyMode && quizStatusFilter !== "all") {
        pool = pool.filter(w => wordMatchesStatus(w.id, quizStatusFilter));
        if (pool.length === 0) {
          alert(`学習状況「${WORD_STATUS_LABEL[quizStatusFilter]}」に該当する単語がありません。\\n条件を「すべて」に戻すか、範囲を広げてください。`);
          return;
        }
      }''',
'''      if (!isDailyMode && quizStatusFilters.length > 0) {
        pool = pool.filter(w => wordMatchesStatuses(w.id, quizStatusFilters));
        if (pool.length === 0) {
          const labelText = quizStatusFilters.map(st => WORD_STATUS_LABEL[st]).join("・");
          alert(`学習状況「${labelText}」に該当する単語がありません。\\n条件を「すべて」に戻すか、範囲を広げてください。`);
          return;
        }
      }''')

rep('''    function wordMatchesStatus(id, status) {
      if (!status || status === "all") return true;
      return getWordStatus(id) === status;
    }''',
'''    function wordMatchesStatus(id, status) {
      if (!status || status === "all") return true;
      return getWordStatus(id) === status;
    }

    // 複数選択（いずれかに一致＝OR。範囲やPartとはANDで組み合わせる）
    function wordMatchesStatuses(id, statuses) {
      if (!Array.isArray(statuses) || statuses.length === 0) return true;
      return statuses.includes(getWordStatus(id));
    }''')

# ================= C. 漢字→かな検索インデックス =================
rep('''    function normalizeSearchText(str) {''',
'''    // 漢字→かな対応表。データ追加時にここへ追記すると、ひらがな検索で漢字の語がヒットする。
    const KANJI_READINGS = {};

    function kanaFromKanji(word) {
      const src = String(word || "");
      let out = "";
      let sawKanji = false;
      for (const ch of src) {
        if (/[\\u4e00-\\u9fff\\u3005]/.test(ch)) {
          sawKanji = true;
          const kana = KANJI_READINGS[ch];
          if (!kana) return "";
          out += kana;
        } else {
          out += ch;
        }
      }
      return sawKanji ? out : "";
    }

    function normalizeSearchText(str) {''')

rep('''          readingNorm: normalizeSearchText(w.reading || ""),''',
'''          searchKana: normalizeSearchText([w.reading || "", w.yomi || "", kanaFromKanji(w.word)].filter(Boolean).join(" ")),''')

rep('''            || entry.readingNorm.includes(query)''',
'''            || entry.searchKana.includes(query)''')

# ================= D. リンクにゾーン情報 =================
rep('''        rs: selectedRange.start,
        re: selectedRange.end,
        rl: selectedRange.label
      };''',
'''        rs: selectedRange.start,
        re: selectedRange.end,
        rl: selectedRange.label,
        z: currentSubject
      };''')

rep('''      const d = parseSharedParam();
      if (!d) return;

      const range = getDataIdRange();''',
'''      const d = parseSharedParam();
      if (!d) return;

      // ゾーン情報（z）があれば、その世界に切り替えてから範囲を復元する
      if (d.z && SUBJECTS[d.z] && d.z !== currentSubject) {
        if (applySubject(d.z, { silent: true })) loadPartSelection();
      }

      const range = getDataIdRange();''')

# ================= E. 実績の拡大 =================
rep('''    function isAchievementDone(id) {''',
'''    // === 追加実績（裏世界・学習の深さ） ===
    ACHIEVEMENTS.push(
      { id: "kobun_first", name: "裏世界への扉", icon: "🌌", category: "kobun", desc: "裏世界（古文単語）で初めて1問解く", price: 100,
        condition: (u) => Object.keys(u.wordStats || {}).some(k => Number(k) >= 10001) },
      { id: "kobun_10", name: "古文の入り口", icon: "📜", category: "kobun", desc: "古文単語を10語学習する", price: 150,
        condition: (u) => Object.keys(u.wordStats || {}).filter(k => Number(k) >= 10001).length >= 10 },
      { id: "kobun_50", name: "一章制覇", icon: "🏯", category: "kobun", desc: "1章の50語すべてに解答する", price: 400,
        condition: (u) => Object.keys(u.wordStats || {}).filter(k => Number(k) >= 10001).length >= 50 },
      { id: "kobun_master_10", name: "古文の定着", icon: "🖋️", category: "kobun", desc: "古文単語を10語マスターする", price: 500,
        condition: (u) => Object.entries(u.wordStats || {}).filter(([k, v]) => Number(k) >= 10001 && (v.correct || 0) >= 3).length >= 10 },
      { id: "both_worlds", name: "二つの世界", icon: "🌗", category: "kobun", desc: "表と裏の両方で3語ずつ学習する", price: 300,
        condition: (u) => {
          const keys = Object.keys(u.wordStats || {});
          return keys.filter(k => Number(k) < 10001).length >= 3 && keys.filter(k => Number(k) >= 10001).length >= 3;
        } },
      { id: "combo_10", name: "10連コンボ", icon: "⚡", category: "combo", desc: "1回のクイズで10コンボを達成する", price: 200,
        condition: (u) => (u.maxComboEver || 0) >= 10 },
      { id: "combo_20", name: "20連コンボ", icon: "🌩️", category: "combo", desc: "1回のクイズで20コンボを達成する", price: 450,
        condition: (u) => (u.maxComboEver || 0) >= 20 },
      { id: "quiz_30_times", name: "もはや日課", icon: "🗓️", category: "accuracy", desc: "累計30回クイズを完走する", price: 600,
        condition: (u) => (u.totalQuizzes || 0) >= 30 },
      { id: "accuracy_95", name: "ほぼ完璧", icon: "🔬", category: "accuracy", desc: "20問以上で正答率95%以上を達成する", price: 400,
        condition: (u) => _history(u).some(h => Number(h.accuracy) >= 95 && Number(h.total) >= 20) },
      { id: "perfect_3", name: "三度の完全無欠", icon: "🧿", category: "accuracy", desc: "正答率100%を3回達成する", price: 700,
        condition: (u) => _history(u).filter(h => Number(h.accuracy) === 100 && Number(h.total) >= 10).length >= 3 },
      { id: "level_50", name: "伝説の学習者", icon: "🪐", category: "level", desc: "プレイヤーLv.50に到達する", price: 3000,
        condition: (u) => getLevelState(u.exp).level >= 50 },
      { id: "coins_10000", name: "財宝の山", icon: "🏦", category: "collection", desc: "所持コインが10000を突破する", price: 3000,
        condition: (u) => Number(u.coins) >= 10000 }
    );

    function isAchievementDone(id) {''')

rep('''        { id: "daily", label: "継続" }''',
'''        { id: "daily", label: "継続" },
        { id: "kobun", label: "裏世界" }''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
