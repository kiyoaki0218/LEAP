import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read()
s = s.replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:160])
    s = s.replace(old, new, 1)


rep('  <script src="./words_data.js"></script>',
    '  <script src="./words_data.js"></script>\n  <script src="./kobun/kobun_words_data.js"></script>')

OLD_PARTS = '''    // Part定義（収録データに応じて利用可否を自動判定）
    const PARTS = [
      { id: 1, name: "Part 1", desc: "重要・基礎単語", start: 1, end: 400 },
      { id: 2, name: "Part 2", desc: "標準・頻出単語", start: 401, end: 1000 },
      { id: 3, name: "Part 3", desc: "応用・発展単語", start: 1001, end: 1400 },
      { id: 4, name: "Part 4", desc: "最難関・発展単語", start: 1401, end: 2000 },
      { id: 5, name: "+α 難単語", desc: "プラスアルファ", start: 2001, end: 2300 }
    ];

    // 実データ（LEAP_WORDS_DATA: words_data.js）
    let ALL_WORDS = [];
    if (typeof LEAP_WORDS_DATA !== 'undefined' && Array.isArray(LEAP_WORDS_DATA)) {
      ALL_WORDS = [...LEAP_WORDS_DATA];
    }'''

NEW_PARTS = '''    // Part定義（収録データに応じて利用可否を自動判定）
    const LEAP_PARTS = [
      { id: 1, name: "Part 1", desc: "重要・基礎単語", start: 1, end: 400 },
      { id: 2, name: "Part 2", desc: "標準・頻出単語", start: 401, end: 1000 },
      { id: 3, name: "Part 3", desc: "応用・発展単語", start: 1001, end: 1400 },
      { id: 4, name: "Part 4", desc: "最難関・発展単語", start: 1401, end: 2000 },
      { id: 5, name: "+α 難単語", desc: "プラスアルファ", start: 2001, end: 2300 }
    ];

    // ===== ゾーン（表の世界 / 裏世界） =====
    const LEAP_SOURCE = (typeof LEAP_WORDS_DATA !== "undefined" && Array.isArray(LEAP_WORDS_DATA)) ? LEAP_WORDS_DATA : [];
    const KOBUN_SOURCE = (typeof KOBUN_WORDS_DATA !== "undefined" && Array.isArray(KOBUN_WORDS_DATA)) ? KOBUN_WORDS_DATA : [];
    const KOBUN_PART_DEFS = (typeof KOBUN_PARTS !== "undefined" && Array.isArray(KOBUN_PARTS)) ? KOBUN_PARTS : [];
    const SUBJECT_STORAGE_KEY = "LEAP_SUBJECT_V1";

    const SUBJECTS = {
      leap: {
        key: "leap", short: "LEAP", label: "LEAP 英単語",
        heading: "LEAP 4択英単語",
        sub: "英語から日本語の語義を素早く答えるトレーニング",
        badge: "SIMPLE & SPEEDY",
        words: LEAP_SOURCE, parts: LEAP_PARTS
      },
      kobun: {
        key: "kobun", short: "裏世界", label: "古文単語（裏世界）",
        heading: "古文単語330",
        sub: "古典の語義を4択で。表の世界とは別の記録として残ります",
        badge: "ANOTHER WORLD",
        words: KOBUN_SOURCE, parts: KOBUN_PART_DEFS
      }
    };

    let currentSubject = "leap";
    let PARTS = LEAP_PARTS;
    let ALL_WORDS = [...LEAP_SOURCE];

    function currentZone() {
      return SUBJECTS[currentSubject] || SUBJECTS.leap;
    }

    function getSavedSubject() {
      try {
        const v = localStorage.getItem(SUBJECT_STORAGE_KEY);
        return SUBJECTS[v] ? v : "leap";
      } catch (e) { return "leap"; }
    }

    function syncZoneButtons() {
      const leapBtn = document.getElementById("zone-btn-leap");
      const kobunBtn = document.getElementById("zone-btn-kobun");
      const base = "flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer";
      if (leapBtn) leapBtn.className = base + (currentSubject === "leap" ? " bg-white shadow-sm text-slate-900" : " text-slate-500");
      if (kobunBtn) kobunBtn.className = base + (currentSubject === "kobun" ? " bg-white shadow-sm text-violet-800" : " text-slate-500");
      const zoneLabel = document.getElementById("zone-label");
      if (zoneLabel) zoneLabel.textContent = currentZone().short;
    }

    function applySubject(subject, opts) {
      const key = SUBJECTS[subject] ? subject : "leap";
      const conf = SUBJECTS[key];
      if (!conf.words.length && key !== "leap") {
        showToast("このゾーンの単語データはまだありません");
        currentSubject = "leap";
        return false;
      }
      currentSubject = key;
      ALL_WORDS = [...conf.words];
      PARTS = conf.parts;
      document.body.classList.toggle("kobun-mode", key === "kobun");
      try { localStorage.setItem(SUBJECT_STORAGE_KEY, key); } catch (e) {}

      const heroBadge = document.getElementById("home-hero-badge");
      const heroTitle = document.getElementById("home-hero-title");
      const heroSub = document.getElementById("home-hero-sub");
      const dot = document.getElementById("header-zone-dot");
      if (heroBadge) {
        heroBadge.textContent = conf.badge;
        heroBadge.className = key === "kobun"
          ? "inline-block px-3 py-1 bg-violet-100 text-violet-800 text-xs font-semibold rounded-full tracking-wider"
          : "inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full tracking-wider";
      }
      if (heroTitle) heroTitle.textContent = conf.heading;
      if (heroSub) heroSub.textContent = conf.sub;
      if (dot) {
        dot.classList.toggle("bg-violet-500", key === "kobun");
        dot.classList.toggle("bg-emerald-500", key !== "kobun");
      }
      syncZoneButtons();
      renderPartSelectList();
      syncDataRangeUi();
      updateUserUI();
      if (!opts || !opts.silent) {
        showToast(key === "kobun" ? "🌌 裏世界（古文単語）へ移動しました" : "🌤 表の世界（LEAP）へ戻りました");
      }
      return true;
    }

    function switchSubject(subject) {
      if (subject === currentSubject) return;
      if (!applySubject(subject)) return;
      const parts = getAvailableParts();
      selectedParts = parts.length ? [parts[0].id] : [];
      savePartSelection();
      renderPartSelectList();
      updatePartSelectionSummary();
      navigate("screen-home");
    }'''

rep(OLD_PARTS, NEW_PARTS)

rep('''      <div class="text-center space-y-2 py-2">
        <span class="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full tracking-wider">
          SIMPLE & SPEEDY
        </span>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">LEAP 4択英単語</h2>
        <p class="text-slate-500 text-sm">英語から日本語の語義を素早く答えるトレーニング</p>
      </div>''',
'''      <!-- ゾーン切替（表の世界 / 裏世界） -->
      <div class="flex bg-slate-200/70 p-1 rounded-xl">
        <button type="button" id="zone-btn-leap" onclick="switchSubject('leap')" class="flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer">LEAP 英単語</button>
        <button type="button" id="zone-btn-kobun" onclick="switchSubject('kobun')" class="flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer">🌌 裏世界（古文単語）</button>
      </div>

      <div class="zone-hero text-center space-y-2 py-2">
        <span id="home-hero-badge" class="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full tracking-wider">
          SIMPLE & SPEEDY
        </span>
        <h2 id="home-hero-title" class="text-3xl font-extrabold tracking-tight text-slate-900">LEAP 4択英単語</h2>
        <p id="home-hero-sub" class="text-slate-500 text-sm">英語から日本語の語義を素早く答えるトレーニング</p>
      </div>''')

rep('''      <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
      <h1 class="font-bold text-base sm:text-lg tracking-tight text-slate-900">LEAP Quiz</h1>''',
'''      <span id="header-zone-dot" class="w-3 h-3 rounded-full bg-emerald-500"></span>
      <h1 class="font-bold text-base sm:text-lg tracking-tight text-slate-900">LEAP Quiz</h1>
      <span id="zone-label" class="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.5 rounded-md">LEAP</span>''')

rep('''    function getWordStatus(id) {
      const s = (userData.wordStats || {})[id];
      if (!s || !s.total) return "unlearned";
      const pct = Math.round((s.correct / s.total) * 100);
      if (s.correct >= 2 && pct >= 80) return "mastered";
      if (s.correct >= 1) return "learning";
      return "weak";
    }''',
'''    // マスター: 正解3回以上かつ正答率90%以上 / 苦手: 正答率50%未満 / 学習中: それ以外
    function getWordStatus(id) {
      const s = (userData.wordStats || {})[id];
      if (!s || !s.total) return "unlearned";
      const pct = Math.round((s.correct / s.total) * 100);
      if (s.correct >= 3 && pct >= 90) return "mastered";
      if (pct < 50) return "weak";
      if (s.correct >= 1) return "learning";
      return "weak";
    }''')

rep('''        if (st && st.total > 0) {
          const pct = Math.round((st.correct / st.total) * 100);
          if (st.correct >= 2 && pct >= 80) {''',
'''        if (st && st.total > 0) {
          const pct = Math.round((st.correct / st.total) * 100);
          if (st.correct >= 3 && pct >= 90) {''')

rep('''          } else if (st.correct >= 1) {
            statusBadge = `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded shrink-0">学習中 (${pct}% ・ ${st.correct}/${st.total})</span>`;
          } else {
            statusBadge = `<span class="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded shrink-0">苦手 (${st.correct}/${st.total})</span>`;
          }''',
'''          } else if (pct < 50) {
            statusBadge = `<span class="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded shrink-0">苦手 (${pct}% ・ ${st.correct}/${st.total})</span>`;
          } else {
            statusBadge = `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded shrink-0">学習中 (${pct}% ・ ${st.correct}/${st.total})</span>`;
          }''')

rep('''      <div class="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 class="text-xl font-bold text-slate-900">単語辞典</h2>''',
'''      <div class="sticky top-0 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur-sm flex items-center justify-between border-b border-slate-200">
        <div>
          <h2 class="text-xl font-bold text-slate-900">単語辞典</h2>''')

rep('''    function wordMatchesStatus(id, status) {''',
'''    function toHiragana(str) {
      return String(str || "").replace(/[\\u30a1-\\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    }

    function normalizeSearchText(str) {
      const raw = String(str || "");
      const base = raw.normalize ? raw.normalize("NFKC").toLowerCase() : raw.toLowerCase();
      return toHiragana(base);
    }

    function wordMatchesStatus(id, status) {''')

rep('''          part: String(w.part || 1),
          status: getWordStatus(w.id),''',
'''          part: String(w.part || 1),
          status: getWordStatus(w.id),
          readingNorm: normalizeSearchText(w.reading || ""),''')

rep('''      const query = rawQuery.normalize ? rawQuery.normalize("NFKC").toLowerCase() : rawQuery.toLowerCase();''',
'''      const query = normalizeSearchText(rawQuery);''')

rep('''          hit = entry.idText.includes(query) || entry.word.includes(query) || entry.meaningNorm.includes(query);''',
'''          hit = entry.idText.includes(query)
            || normalizeSearchText(entry.word).includes(query)
            || entry.readingNorm.includes(query)
            || entry.meaningNorm.includes(query);''')

rep('''        idEl.textContent = w.id;''', '''        idEl.textContent = w.num || w.id;''')

rep('''    let currentAchievementTab = "all";

    function setAchievementTab(tab) {
      currentAchievementTab = tab;
      renderAchievementList();
    }''',
'''    let currentAchievementTab = "all";
    let currentAchievementDone = "all";

    function setAchievementTab(tab) {
      currentAchievementTab = tab;
      renderAchievementList();
    }

    function setAchievementDone(done) {
      currentAchievementDone = done;
      renderAchievementList();
    }''')

rep('''      const filtered = ACHIEVEMENTS.filter(a => currentAchievementTab === "all" || a.category === currentAchievementTab);''',
'''      const doneBar = document.createElement("div");
      doneBar.className = "flex gap-1.5 mb-2 text-[11px] font-bold";
      [
        { id: "all", label: "すべて" },
        { id: "done", label: "達成済み" },
        { id: "todo", label: "未達成" }
      ].forEach(d => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "flex-1 py-1.5 rounded-lg transition cursor-pointer " + (currentAchievementDone === d.id ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600");
        b.textContent = d.label;
        b.onclick = () => setAchievementDone(d.id);
        doneBar.appendChild(b);
      });
      list.appendChild(doneBar);

      const filtered = ACHIEVEMENTS.filter(a => {
        const tabOk = currentAchievementTab === "all" || a.category === currentAchievementTab;
        if (!tabOk) return false;
        const done = isAchievementDone(a.id);
        if (currentAchievementDone === "done") return done;
        if (currentAchievementDone === "todo") return !done;
        return true;
      });''')

rep('''      window.scrollTo(0, 0);
      if (screenId === "screen-shop") renderShop();''',
'''      window.scrollTo(0, 0);
      if (screenId === "screen-shop") renderShop();
      if (screenId === "screen-select") {
        renderPartSelectList();
        updatePartSelectionSummary();
        updateCustomRangeStats();
        updateQuizStatusHint();
      }
      if (screenId === "screen-dictionary") applyDictionaryFilters();
      if (screenId === "screen-home") updateUserUI();''')

rep('''    function getDueWeakWords() {
      const today = getTodayString();
      const allWeak = Object.values(userData.weakWords || {});
      return allWeak.filter(w => !w.nextReview || w.nextReview <= today);
    }''',
'''    function getSubjectWeakWords() {
      const ids = new Set(ALL_WORDS.map(w => w.id));
      return Object.values(userData.weakWords || {}).filter(w => ids.has(w.id));
    }

    function getDueWeakWords() {
      const today = getTodayString();
      return getSubjectWeakWords().filter(w => !w.nextReview || w.nextReview <= today);
    }''')

rep('''    function startWeakWordsQuiz(forceAll) {
      const allWeakList = Object.values(userData.weakWords || {});
      if (allWeakList.length === 0) {
        alert("間違えた苦手単語はまだありません！");
        return;
      }''',
'''    function startWeakWordsQuiz(forceAll) {
      const allWeakList = getSubjectWeakWords();
      if (allWeakList.length === 0) {
        alert(currentSubject === "kobun" ? "このゾーンで間違えた苦手単語はまだありません！" : "間違えた苦手単語はまだありません！");
        return;
      }''')

rep('''      const allWeakList = Object.values(userData.weakWords || {});
      const dueWeakList = getDueWeakWords();''',
'''      const allWeakList = getSubjectWeakWords();
      const dueWeakList = getDueWeakWords();''')

rep('''    async function checkAndFetchData() {
      if (ALL_WORDS.length > 0) return;''',
'''    async function checkAndFetchData() {
      if (currentSubject !== "leap") return;
      if (ALL_WORDS.length > 0) return;''')

rep('''      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });''',
'''      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch (e) {}
      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        onclone: (doc) => {
          const cloned = doc.getElementById("result-card");
          if (cloned) cloned.style.lineHeight = "1.45";
        }
      });''')

rep('''    const PART_STORAGE_KEY = "LEAP_SELECTED_PARTS_V1";''',
'''    const PART_STORAGE_KEY = "LEAP_SELECTED_PARTS_V1";
    const KOBUN_PART_STORAGE_KEY = "LEAP_KOBUN_SELECTED_PARTS_V1";
    function partStorageKey() {
      return currentSubject === "kobun" ? KOBUN_PART_STORAGE_KEY : PART_STORAGE_KEY;
    }''')

rep('''        const raw = JSON.parse(localStorage.getItem(PART_STORAGE_KEY) || "null");''',
'''        const raw = JSON.parse(localStorage.getItem(partStorageKey()) || "null");''')

rep('''      try { localStorage.setItem(PART_STORAGE_KEY, JSON.stringify(selectedParts)); } catch (e) {}''',
'''      try { localStorage.setItem(partStorageKey(), JSON.stringify(selectedParts)); } catch (e) {}''')

rep('''未学習＝まだ出題なし／苦手＝正解0回／学習中＝正解あり／マスター＝正解2回以上かつ正答率80%以上''',
'''未学習＝まだ出題なし／苦手＝正答率50%未満／学習中＝正答率50%以上／マスター＝正解3回以上かつ正答率90%以上''')

rep('''      loadPartSelection();
      loadQuizStatusFilter();''',
'''      applySubject(getSavedSubject(), { silent: true });
      loadPartSelection();
      loadQuizStatusFilter();''')

rep('''    /* 進行バー・選択状態などが沈まないように */
    html.dark .bg-emerald-200\\/60 { background-color: rgba(16,185,129,0.35) !important; }
  </style>''',
'''    /* 進行バー・選択状態などが沈まないように */
    html.dark .bg-emerald-200\\/60 { background-color: rgba(16,185,129,0.35) !important; }

    /* ===== 裏世界（古文単語）ゾーン ===== */
    body.kobun-mode { background-color: #f7f5ff; }
    html.dark body.kobun-mode { background-color: #0b0b1a; }
    .zone-hero { border-radius: 1rem; }
    body.kobun-mode .zone-hero { background-image: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 55%, #f5f3ff 100%); }
    html.dark body.kobun-mode .zone-hero { background-image: linear-gradient(135deg, #2e1065 0%, #312e81 100%); }
    body.kobun-mode #zone-label { background-color: #7c3aed; }
    body.kobun-mode #home-hero-title { color: #4c1d95; }
    html.dark body.kobun-mode #home-hero-title { color: #ddd6fe; }
    body.kobun-mode #home-hero-sub { color: #6d28d9; }
    html.dark body.kobun-mode #home-hero-sub { color: #c4b5fd; }
  </style>''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
