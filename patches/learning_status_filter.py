import io, sys

PATH = "index.html"
s = io.open(PATH, encoding="utf-8", newline="").read()

# 行末を LF に統一（過去の編集で混在した CRCRLF もここで整える）
s = s.replace("\r\n", "\n").replace("\r", "\n")
NL = "\n"


def rep(old, new, count=1):
    global s
    old = old.replace("\r\n", "\n").replace("\r", "\n")
    new = new.replace("\r\n", "\n").replace("\r", "\n")
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:200])
    s = s.replace(old, new, count)

# ---------- 1) 共通ヘルパー + 辞典フィルタの状態保持 ----------
rep(
"""    let dictionaryFilter = { part: "all", start: "", end: "" };""",
"""    // ===== 学習ステータス判定（辞典・出題絞り込みで共通利用） =====
    const WORD_STATUSES = ["all", "unlearned", "weak", "learning", "mastered"];
    const WORD_STATUS_LABEL = {
      all: "すべて",
      unlearned: "未学習",
      weak: "苦手",
      learning: "学習中",
      mastered: "マスター"
    };

    function getWordStatus(id) {
      const s = (userData.wordStats || {})[id];
      if (!s || !s.total) return "unlearned";
      const pct = Math.round((s.correct / s.total) * 100);
      if (s.correct >= 2 && pct >= 80) return "mastered";
      if (s.correct >= 1) return "learning";
      return "weak";
    }

    function wordMatchesStatus(id, status) {
      if (!status || status === "all") return true;
      return getWordStatus(id) === status;
    }

    let dictionaryFilter = { part: "all", start: "", end: "", status: "all" };"""
)

# ---------- 2) 辞典フィルタの読み込み ----------
rep(
"""          dictionaryFilter.end = saved.end === undefined || saved.end === null ? "" : String(saved.end);""",
"""          dictionaryFilter.end = saved.end === undefined || saved.end === null ? "" : String(saved.end);
          dictionaryFilter.status = WORD_STATUSES.includes(String(saved.status)) ? String(saved.status) : "all";"""
)

# ---------- 3) 辞典フィルタ UI 同期（ステータスボタン） ----------
rep(
"""      if (endEl && document.activeElement !== endEl) endEl.value = dictionaryFilter.end;
    }""",
"""      if (endEl && document.activeElement !== endEl) endEl.value = dictionaryFilter.end;
      document.querySelectorAll("[data-dict-status]").forEach(btn => {
        const active = btn.dataset.dictStatus === dictionaryFilter.status;
        btn.className = `px-2.5 py-1 text-[11px] font-bold rounded-md border transition cursor-pointer ${
          active
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
        }`;
      });
    }"""
)

# ---------- 4) ステータス絞り込みの setter ----------
rep(
"""    function handleDictionaryRangeInput() {""",
"""    function setDictionaryStatusFilter(status) {
      dictionaryFilter.status = WORD_STATUSES.includes(status) ? status : "all";
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    function handleDictionaryRangeInput() {"""
)

# ---------- 5) リセットにステータスを含める ----------
rep(
"""    function resetDictionaryFilters() {
      dictionaryFilter = { part: "all", start: "", end: "" };""",
"""    function resetDictionaryFilters() {
      dictionaryFilter = { part: "all", start: "", end: "", status: "all" };"""
)

# ---------- 6) 辞典の絞り込み判定 ----------
rep(
"""        if (dictionaryFilter.part !== "all" && entry.part !== dictionaryFilter.part) hit = false;""",
"""        if (dictionaryFilter.part !== "all" && entry.part !== dictionaryFilter.part) hit = false;
        if (hit && dictionaryFilter.status !== "all" && entry.status !== dictionaryFilter.status) hit = false;"""
)

rep(
"""      const filtering = query !== "" || dictionaryFilter.part !== "all" || hasRange;""",
"""      const filtering = query !== "" || dictionaryFilter.part !== "all" || hasRange || dictionaryFilter.status !== "all";"""
)

# ---------- 7) 辞典の行データに学習ステータスを持たせる ----------
rep(
"""          part: String(w.part || 1),
          idText: String(w.id),""",
"""          part: String(w.part || 1),
          status: getWordStatus(w.id),
          idText: String(w.id),"""
)

# ---------- 8) 辞典 HTML：ステータス絞り込みボタン ----------
rep(
"""          <button type="button" id="dict-filter-part2" data-dict-part="2" onclick="setDictionaryPartFilter('2')" class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer">Part 2</button>
        </div>""",
"""          <button type="button" id="dict-filter-part2" data-dict-part="2" onclick="setDictionaryPartFilter('2')" class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer">Part 2</button>
        </div>
        <div class="flex flex-wrap gap-1.5 pt-0.5">
          <button type="button" data-dict-status="all" onclick="setDictionaryStatusFilter('all')">すべて</button>
          <button type="button" data-dict-status="unlearned" onclick="setDictionaryStatusFilter('unlearned')">未学習</button>
          <button type="button" data-dict-status="weak" onclick="setDictionaryStatusFilter('weak')">苦手</button>
          <button type="button" data-dict-status="learning" onclick="setDictionaryStatusFilter('learning')">学習中</button>
          <button type="button" data-dict-status="mastered" onclick="setDictionaryStatusFilter('mastered')">マスター</button>
        </div>"""
)

# ---------- 9) 範囲選択 HTML：学習状況フィルター ----------
rep(
"""      <button type="button" id="start-quiz-btn" onclick="startCustomQuiz()\"""",
"""      <!-- 学習状況で出題を絞り込み -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-bold text-slate-700">学習状況で絞り込み</label>
          <span id="quiz-status-hint" class="text-[11px] font-bold text-emerald-600">全 0 語</span>
        </div>
        <div class="grid grid-cols-5 gap-1.5">
          <button type="button" data-quiz-status="all" onclick="setQuizStatusFilter('all')">すべて</button>
          <button type="button" data-quiz-status="unlearned" onclick="setQuizStatusFilter('unlearned')">未学習</button>
          <button type="button" data-quiz-status="weak" onclick="setQuizStatusFilter('weak')">苦手</button>
          <button type="button" data-quiz-status="learning" onclick="setQuizStatusFilter('learning')">学習中</button>
          <button type="button" data-quiz-status="mastered" onclick="setQuizStatusFilter('mastered')">マスター</button>
        </div>
        <p class="text-[11px] text-slate-400 leading-relaxed">未学習＝まだ出題なし／苦手＝正解0回／学習中＝正解あり／マスター＝正解2回以上かつ正答率80%以上</p>
      </div>

      <button type="button" id="start-quiz-btn" onclick="startCustomQuiz()\""""
)

# ---------- 10) クイズ側のステータスフィルター実装 ----------
rep(
"""    function startQuiz() {""",
"""    // ===== 出題の学習状況フィルター =====
    const QUIZ_STATUS_KEY = "LEAP_QUIZ_STATUS_FILTER_V1";
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
    }

    function getQuizBasePool() {
      if (rangeMode === "custom") {
        const startEl = document.getElementById("custom-start-id");
        const endEl = document.getElementById("custom-end-id");
        const start = parseInt(startEl && startEl.value) || 1;
        const end = parseInt(endEl && endEl.value) || 100;
        if (start > end) return [];
        return ALL_WORDS.filter(w => w.id >= start && w.id <= end);
      }
      const parts = getSelectedPartList();
      if (parts.length === 0) return [];
      return getPoolForParts(parts);
    }

    function updateQuizStatusHint() {
      const el = document.getElementById("quiz-status-hint");
      if (!el) return;
      const base = getQuizBasePool();
      const matched = base.filter(w => wordMatchesStatus(w.id, quizStatusFilter)).length;
      el.textContent = quizStatusFilter === "all"
        ? `全 ${base.length} 語`
        : `該当 ${matched} 語 / ${base.length} 語`;
      el.className = `text-[11px] font-bold ${base.length > 0 && matched === 0 ? "text-rose-600" : "text-emerald-600"}`;
    }

    function startQuiz() {"""
)

# ---------- 11) startQuiz でフィルター適用 ----------
rep(
"""        alert(`指定された範囲（ID: ${selectedRange.start}〜${selectedRange.end}）に単語が存在しません。\\n※ 現在はID: ${range.start}〜${range.end}に対応しています。`);
        return;
      }
      startQuizWithPool(pool);""",
"""        alert(`指定された範囲（ID: ${selectedRange.start}〜${selectedRange.end}）に単語が存在しません。\\n※ 現在はID: ${range.start}〜${range.end}に対応しています。`);
        return;
      }
      // デイリーチャレンジ以外は学習状況フィルターを適用
      if (!isDailyMode && quizStatusFilter !== "all") {
        pool = pool.filter(w => wordMatchesStatus(w.id, quizStatusFilter));
        if (pool.length === 0) {
          alert(`学習状況「${WORD_STATUS_LABEL[quizStatusFilter]}」に該当する単語がありません。\\n条件を「すべて」に戻すか、範囲を広げてください。`);
          return;
        }
      }
      startQuizWithPool(pool);"""
)

# ---------- 12) 表示の更新フック ----------
rep(
"""    function updatePartSelectionSummary() {
      const el = document.getElementById("part-selected-summary");
      if (!el) return;""",
"""    function updatePartSelectionSummary() {
      const el = document.getElementById("part-selected-summary");
      if (!el) return;
      updateQuizStatusHint();"""
)

rep(
"""      if (!titleEl || !rateEl || !barEl) return;""",
"""      updateQuizStatusHint();
      if (!titleEl || !rateEl || !barEl) return;"""
)

rep(
"""      if (mode === "part") {
        if (partBtn) partBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-slate-900 transition-all";""",
"""      updateQuizStatusHint();
      if (mode === "part") {
        if (partBtn) partBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-slate-900 transition-all";"""
)

# ---------- 13) 初期化 ----------
rep(
"""      loadPartSelection();""",
"""      loadPartSelection();
      loadQuizStatusFilter();"""
)

io.open(PATH, "w", encoding="utf-8", newline="").write(s)
print("learning-status filters added")
