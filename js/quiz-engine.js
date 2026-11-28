/* provides: 出題エンジン（範囲選択・Part複数選択・カスタム範囲・quizState・startQuizWithPool・renderQuestion・handleAnswer・finishQuiz・到達度テスト・タイマー・デイリーチャレンジ）と、忘却曲線・学習状況フィルター・品詞推定・例文データ・ダミー選択肢の各ヘルパー
   requires: core.js（currentSubject / LEAP_SOURCE / KOBUN_SOURCE / ALL_WORDS / PARTS / navigate / showToast / showAlert / showConfirm）
             words_data.js / examples_data.js、index.html の userData / saveUserData / speakEnglish 等。
             いずれも呼び出し時の参照のみで、読み込み順には依存しない。
   note: index.html のインライン JS から Stage 3 として切り出し（コードは無改変）。 */
    // 範囲選択 ＆ 出題数
    let rangeMode = "part";
    let selectedRange = { start: 1, end: 400, label: "Part 1" };
    let questionLimit = 10;
    let isWeakMode = false;

    
    // ===== カスタム範囲（LEAP と 古文単語で別々に保存・番号基準） =====
    const CUSTOM_RANGE_KEYS = { leap: "LEAP_CUSTOM_RANGE_V1", kobun: "LEAP_KOBUN_CUSTOM_RANGE_V1" };
    let customRangeDraft = { start: 1, end: 100 };

    function isKobunZone() { return currentSubject === "kobun"; }

    function wordNumber(w) {
      return (w && typeof w.num === "number") ? w.num : (w ? w.id : 0);
    }

    function subjectNumberRange() {
      const nums = ALL_WORDS.map(wordNumber).filter(n => typeof n === "number" && isFinite(n));
      if (!nums.length) return { min: 1, max: 1 };
      return { min: Math.min.apply(null, nums), max: Math.max.apply(null, nums) };
    }

    function clampNumber(value, min, max) {
      const n = Number(value);
      if (!isFinite(n)) return min;
      return Math.min(max, Math.max(min, Math.round(n)));
    }

    // 単語番号 → 単語ID（LEAPは ID = 番号、古文は 10001〜 のIDを番号に変換）
    function numberToWordId(num) {
      if (!isKobunZone()) {
        const n = Number(num);
        return isFinite(n) ? n : null;
      }
      const hit = ALL_WORDS.find(w => wordNumber(w) === Number(num));
      return hit ? hit.id : null;
    }

    function customRangeStorageKey() {
      return isKobunZone() ? CUSTOM_RANGE_KEYS.kobun : CUSTOM_RANGE_KEYS.leap;
    }

    // 保存された範囲はゾーンごとに独立（LEAPで1〜300を入れても古文には影響しない）
    function loadCustomRange() {
      const numRange = subjectNumberRange();
      let draft = { start: numRange.min, end: numRange.max };
      try {
        const saved = JSON.parse(localStorage.getItem(customRangeStorageKey()) || "null");
        if (saved && isFinite(Number(saved.start)) && isFinite(Number(saved.end))) {
          draft = {
            start: clampNumber(saved.start, numRange.min, numRange.max),
            end: clampNumber(saved.end, numRange.min, numRange.max)
          };
        }
      } catch (e) {}
      customRangeDraft = draft;

      const startEl = document.getElementById("custom-start-id");
      const endEl = document.getElementById("custom-end-id");
      if (startEl) { startEl.value = String(draft.start); startEl.min = String(numRange.min); startEl.max = String(numRange.max); }
      if (endEl) { endEl.value = String(draft.end); endEl.min = String(numRange.min); endEl.max = String(numRange.max); }

      const startLabel = document.getElementById("custom-start-label");
      const endLabel = document.getElementById("custom-end-label");
      if (startLabel) startLabel.textContent = isKobunZone() ? "開始 単語番号" : "開始 ID";
      if (endLabel) endLabel.textContent = isKobunZone() ? "終了 単語番号" : "終了 ID";

      const note = document.getElementById("custom-range-note");
      if (note) {
        note.textContent = isKobunZone()
          ? `※ 古文単語は「単語番号」1〜${numRange.max} で指定できます（辞典の番号と同じ）。`
          : `※ LEAPは ID（単語番号）1〜${numRange.max} で指定できます（例: 1〜200、450〜800）。`;
      }
      updateCustomRangeStats();
    }

    function handleCustomRangeInput() {
      const numRange = subjectNumberRange();
      const startEl = document.getElementById("custom-start-id");
      const endEl = document.getElementById("custom-end-id");
      const start = parseInt(startEl && startEl.value);
      const end = parseInt(endEl && endEl.value);
      customRangeDraft = {
        start: isFinite(start) ? clampNumber(start, numRange.min, numRange.max) : numRange.min,
        end: isFinite(end) ? clampNumber(end, numRange.min, numRange.max) : numRange.max
      };
      try { localStorage.setItem(customRangeStorageKey(), JSON.stringify(customRangeDraft)); } catch (e) {}
      updateCustomRangeStats();
    }

    // 入力された単語番号から実際の出題範囲（ID範囲＋プール）を組み立てる
    function getCustomRangeSelection() {
      const numRange = subjectNumberRange();
      const startEl = document.getElementById("custom-start-id");
      const endEl = document.getElementById("custom-end-id");
      const startNumRaw = parseInt(startEl && startEl.value);
      const endNumRaw = parseInt(endEl && endEl.value);
      const startNum = clampNumber(isFinite(startNumRaw) ? startNumRaw : numRange.min, numRange.min, numRange.max);
      const endNum = clampNumber(isFinite(endNumRaw) ? endNumRaw : numRange.max, numRange.min, numRange.max);
      if (startNum > endNum) return { valid: false, error: "range", startNum, endNum };

      const startId = numberToWordId(startNum);
      const endId = numberToWordId(endNum);
      if (startId === null || endId === null) return { valid: false, error: "missing", startNum, endNum };

      const idStart = Math.min(startId, endId);
      const idEnd = Math.max(startId, endId);
      const pool = ALL_WORDS.filter(w => typeof w.id === "number" && w.id >= idStart && w.id <= idEnd);
      return {
        valid: true,
        startNum, endNum,
        start: idStart, end: idEnd, pool,
        label: isKobunZone() ? `単語番号: ${startNum}〜${endNum}` : `ID: ${startNum}〜${endNum}`
      };
    }

    function updateCustomRangeStats() {
      const titleEl = document.getElementById("custom-stats-title");
      const roundEl = document.getElementById("custom-stats-round");
      const rateEl = document.getElementById("custom-stats-rate");
      const barEl = document.getElementById("custom-stats-bar");
      updateQuizStatusHint();
      if (!titleEl || !rateEl || !barEl) return;

      const sel = getCustomRangeSelection();
      if (!sel.valid) {
        titleEl.textContent = sel.error === "missing"
          ? "その番号の単語が見つかりません"
          : "開始番号は終了番号以下にしてください";
        rateEl.textContent = "-";
        barEl.style.width = "0%";
        return;
      }

      const stats = getRangeStats(sel.start, sel.end, sel.pool);
      titleEl.textContent = isKobunZone()
        ? `指定範囲: 単語番号 ${sel.startNum} 〜 ${sel.endNum}`
        : `指定範囲: ID ${sel.startNum} 〜 ${sel.endNum}`;
      if (roundEl) roundEl.textContent = `${stats.round}周目`;
      rateEl.textContent = `完了率: ${stats.rate}% (${stats.learnedCount}/${stats.totalWords}語)`;
      barEl.style.width = `${stats.rate}%`;
    }

    function switchRangeMode(mode) {
      rangeMode = mode;
      const partBtn = document.getElementById("tab-btn-part");
      const customBtn = document.getElementById("tab-btn-custom");
      const partPanel = document.getElementById("panel-part");
      const customPanel = document.getElementById("panel-custom");

      updateQuizStatusHint();
      if (mode === "part") {
        if (partBtn) partBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-slate-900 transition-all";
        if (customBtn) customBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-all";
        if (partPanel) partPanel.classList.remove("hidden");
        if (customPanel) customPanel.classList.add("hidden");
      } else {
        if (customBtn) customBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-slate-900 transition-all";
        if (partBtn) partBtn.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-all";
        if (partPanel) partPanel.classList.add("hidden");
        if (customPanel) { customPanel.classList.remove("hidden"); updateCustomRangeStats(); }
      }
    }

    function setQuestionCount(count) {
      questionLimit = count;
      const badge = document.getElementById("current-qcount-badge");
      if (badge) badge.textContent = count === 0 ? "全問" : `${count}問`;

      document.querySelectorAll(".q-count-btn").forEach(btn => {
        btn.className = "q-count-btn py-2 text-xs font-bold border rounded-lg bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer";
      });
      if (event && event.target && event.target.classList.contains("q-count-btn")) {
        event.target.className = "q-count-btn py-2 text-xs font-bold border rounded-lg bg-slate-900 text-white border-slate-900 cursor-pointer";
      }
      const customInput = document.getElementById("custom-qcount-input");
      if (customInput) customInput.value = "";
    }

    function handleCustomQCountInput(val) {
      const num = parseInt(val);
      if (!isNaN(num) && num > 0) {
        questionLimit = num;
        const badge = document.getElementById("current-qcount-badge");
        if (badge) badge.textContent = `${num}問 (自由指定)`;
        document.querySelectorAll(".q-count-btn").forEach(btn => {
          btn.className = "q-count-btn py-2 text-xs font-bold border rounded-lg bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer";
        });
      }
    }

    // ===== Partの複数選択 =====
    const PART_STORAGE_KEY = "LEAP_SELECTED_PARTS_V1";
    const KOBUN_PART_STORAGE_KEY = "LEAP_KOBUN_SELECTED_PARTS_V1";
    function partStorageKey() {
      return currentSubject === "kobun" ? KOBUN_PART_STORAGE_KEY : PART_STORAGE_KEY;
    }
    let selectedParts = [1];

    // 例文・文脈テストも範囲指定を利用できる（例文のある単語だけが出題対象）
    function isRangeSelectionLocked() {
      return false;
    }

    function isPartAvailable(part) {
      const range = getDataIdRange();
      if (!part || !range.end) return false;
      return part.start <= range.end && part.end >= range.start;
    }
    function partWordCount(part) {
      return ALL_WORDS.filter(w => typeof w.id === "number" && w.id >= part.start && w.id <= part.end).length;
    }
    function getAvailableParts() {
      return PARTS.filter(p => isPartAvailable(p));
    }
    function getSelectedPartList() {
      return PARTS.filter(p => selectedParts.includes(p.id) && isPartAvailable(p));
    }
    function getPoolForParts(parts) {
      return ALL_WORDS.filter(w => typeof w.id === "number" && parts.some(p => w.id >= p.start && w.id <= p.end));
    }

    function loadPartSelection() {
      try {
        const raw = JSON.parse(localStorage.getItem(partStorageKey()) || "null");
        if (Array.isArray(raw)) {
          const hasData = getDataIdRange().end > 0;
          const valid = raw.map(Number).filter(id => PARTS.some(p => p.id === id && (!hasData || isPartAvailable(p))));
          selectedParts = Array.from(new Set(valid)).sort((a, b) => a - b);
        }
      } catch (e) { console.warn("part selection load failed", e); }
      renderPartSelectList();
    }

    function savePartSelection() {
      try { localStorage.setItem(partStorageKey(), JSON.stringify(selectedParts)); } catch (e) {}
    }

    function togglePartSelection(partId) {
      if (isRangeSelectionLocked()) return;
      const part = PARTS.find(p => p.id === partId);
      if (!isPartAvailable(part)) return;
      if (selectedParts.includes(partId)) {
        selectedParts = selectedParts.filter(id => id !== partId);
      } else {
        selectedParts = [...selectedParts, partId].sort((a, b) => a - b);
      }
      savePartSelection();
      renderPartSelectList();
    }

    function selectAllParts() {
      if (isRangeSelectionLocked()) return;
      selectedParts = getAvailableParts().map(p => p.id);
      savePartSelection();
      renderPartSelectList();
    }

    function clearAllParts() {
      if (isRangeSelectionLocked()) return;
      selectedParts = [];
      savePartSelection();
      renderPartSelectList();
    }

    function updatePartSelectionSummary() {
      const el = document.getElementById("part-selected-summary");
      if (!el) return;
      updateQuizStatusHint();
      if (isRangeSelectionLocked()) {
        el.className = "text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-bold leading-relaxed";
        el.textContent = "例文・文脈テストは準備中のため、範囲指定は利用できません。通常4択モードでお試しください。";
        return;
      }
      const parts = getSelectedPartList();
      if (parts.length === 0) {
        el.className = "text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-bold";
        el.textContent = "Partが選択されていません（1つ以上選んでください）";
        return;
      }
      const pool = getPoolForParts(parts);
      const total = pool.length;
      const stats = getRangeStats(1, 1000, pool);

      el.className = "text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 space-y-1";
      el.innerHTML = `
        <div class="flex justify-between items-center font-bold">
          <span>選択中: <span class="text-emerald-900">${parts.map(p => p.name).join("・")}</span></span>
          <span class="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md text-[11px]">${stats.round}周目</span>
        </div>
        <div class="flex justify-between items-center text-[11px] text-emerald-700">
          <span>合計完了率: <strong>${stats.rate}%</strong> (${stats.learnedCount}/${total}語習得)</span>
          <div class="w-28 bg-emerald-200 h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-600 h-full rounded-full" style="width: ${stats.rate}%"></div>
          </div>
        </div>
      `;
    }

    // Part の範囲表記（古文は冊内の単語番号、LEAP は ID）
    function partRangeLabel(part) {
      if (!part) return "";
      if (currentSubject === "kobun") {
        const s = typeof part.numStart === "number" ? part.numStart : Math.max(1, part.start - 10000);
        const e = typeof part.numEnd === "number" ? part.numEnd : Math.max(1, part.end - 10000);
        return `単語番号 ${s}〜${e}`;
      }
      return `ID: ${part.start} 〜 ${part.end}`;
    }

    function renderPartSelectList() {
      const listEl = document.getElementById("part-list");
      if (!listEl) return;
      listEl.innerHTML = "";

      const isKobun = currentSubject === "kobun";
      const titleEl = document.getElementById("part-panel-title");
      if (titleEl) titleEl.textContent = isKobun ? "出題する章を選択（複数OK）" : "出題するPartを選択（複数OK）";
      const noteEl = document.getElementById("part-roadmap-note");
      if (noteEl) {
        if (isKobun) {
          const planned = PARTS.filter(p => !isPartAvailable(p));
          const loaded = PARTS.filter(p => isPartAvailable(p));
          const totalWords = PARTS.reduce((sum, p) => sum + (p.end - p.start + 1), 0);
          noteEl.textContent = planned.length
            ? `古文単語は全${PARTS.length}章・${totalWords}語構想。現在は${loaded.map(p => p.name).join("・")}の${ALL_WORDS.length}語を収録し、${planned.map(p => p.name).join("・")}は今後追加予定です。`
            : `古文単語は全${PARTS.length}章・${totalWords}語を収録済みです。`;
          noteEl.classList.remove("hidden");
        } else {
          noteEl.classList.add("hidden");
        }
      }

      const lockAllParts = isRangeSelectionLocked();
      PARTS.forEach(part => {
        const available = !lockAllParts && isPartAvailable(part);
        if (!available) {
          listEl.insertAdjacentHTML("beforeend", `
            <div class="w-full text-left p-4 bg-slate-100/70 border border-slate-200/70 rounded-xl flex justify-between items-center gap-3 select-none">
              <div class="min-w-0">
                <div class="font-bold text-slate-500">${part.name}</div>
                <div class="text-xs text-slate-400 mt-0.5 break-words">${part.desc}（${partRangeLabel(part)}）</div>
                <div class="text-[10px] font-bold text-violet-500 mt-1">今後追加予定</div>
              </div>
              <div class="flex flex-col items-end gap-1.5 shrink-0">
                <span class="text-xs font-semibold px-2.5 py-1 bg-slate-200/50 rounded-md text-slate-400">${part.end - part.start + 1}語</span>
                <span class="bg-slate-900/85 text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full tracking-wider shadow flex items-center gap-1 border border-slate-700 whitespace-nowrap">
                  <span>🔒</span> COMING SOON
                </span>
              </div>
            </div>
          `);
          return;
        }

        const selected = selectedParts.includes(part.id);
        const count = partWordCount(part);
        const stats = getRangeStats(part.start, part.end);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        btn.onclick = () => togglePartSelection(part.id);
        btn.className = `w-full text-left p-4 border-2 rounded-xl transition shadow-sm flex flex-col gap-2 group cursor-pointer ${
          selected ? "border-emerald-500 bg-emerald-50/60" : "bg-white border-slate-200 hover:border-emerald-400"
        }`;

        btn.innerHTML = `
          <div class="w-full flex justify-between items-center gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-5 h-5 rounded-md border-2 flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                selected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent"
              }">✓</span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>${part.name}</span>
                  <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">プレイ可能</span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5">${part.desc}（${partRangeLabel(part)}）</div>
              </div>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-md border shrink-0 ${
              selected ? "bg-emerald-500 text-white border-emerald-500" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }">${count}語</span>
          </div>

          <!-- 完了率・周回数バー -->
          <div class="w-full pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs font-medium text-slate-500">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold ${stats.rate === 100 ? 'text-emerald-700 font-extrabold' : 'text-slate-700'}">
                完了率: ${stats.rate}% (${stats.learnedCount}/${stats.totalWords}語)
              </span>
              <span class="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded-md">
                ${stats.round}周目
              </span>
            </div>
            <div class="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden shrink-0">
              <div class="bg-emerald-500 h-full rounded-full transition-all duration-300" style="width: ${stats.rate}%"></div>
            </div>
          </div>
        `;
        listEl.appendChild(btn);
      });

      updatePartSelectionSummary();
    }

    function startCustomQuiz() {
      isWeakMode = false;
      isDailyMode = false;
      if (rangeMode === "custom") {
        const sel = getCustomRangeSelection();
        if (!sel.valid) {
          showAlert({
            title: "範囲の指定を確認",
            message: sel.error === "missing"
              ? "指定した単語番号の単語が見つかりません。番号を確認してください。"
              : "開始番号は終了番号以下にしてください。",
            icon: "🔢"
          });
          return;
        }
        selectedRange = { start: sel.start, end: sel.end, label: sel.label };
        startQuiz();
        return;
      }

      const parts = getSelectedPartList();
      if (parts.length === 0) {
        showAlert({
          title: "Partを選択してください",
          message: "出題するPartを1つ以上選択してください。\n「全選択」で利用可能なPartをまとめて選べます。",
          icon: "📚"
        });
        return;
      }
      const allAvailable = getAvailableParts().length;
      selectedRange = {
        start: Math.min(...parts.map(p => p.start)),
        end: Math.max(...parts.map(p => p.end)),
        partIds: parts.map(p => p.id),
        label: parts.length === allAvailable
          ? (currentSubject === "kobun" ? `全章（${parts.map(p => p.id - 100).join("・")}章）` : "全Part")
          : parts.map(p => p.name).join("・")
      };
      startQuiz();
    }

    // 苦手単語復習モードの開始
    function startWeakWordsQuiz(forceAll) {
      const allWeakList = getSubjectWeakWords();
      if (allWeakList.length === 0) {
        showAlert({
          title: "苦手単語がありません",
          message: currentSubject === "kobun" ? "このゾーンで間違えた苦手単語はまだありません！" : "間違えた苦手単語はまだありません！",
          icon: "🧠"
        });
        return;
      }
      closeWeakWordsModal();
      isWeakMode = true;

      const dueList = getDueWeakWords();
      const targetList = (!forceAll && dueList.length > 0) ? dueList : allWeakList;
      const labelText = (!forceAll && dueList.length > 0)
        ? `忘却曲線復習 (${dueList.length}語)`
        : `苦手単語特訓 (${targetList.length}語)`;

      selectedRange = { start: 1, end: 1000, label: labelText };
      questionLimit = targetList.length;
      // 忘却曲線復習はゲームモード・出題スタイルの設定を引き継がない（常に通常4択・通常モード）
      startQuizWithPool(targetList, { forceNormalMode: true, forceNormalStyle: true });
    }

    // クイズエンジン
    let quizState = {
      questions: [],
      currentIndex: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctCount: 0,
      earnedCoins: 0,
      earnedExp: 0,
      mistakes: [],
      answeredCount: 0,
      isAnswered: false,
      isMasked: false,
      isAborted: false,
      endReason: "",
      timeLeftMs: SPRINT_TOTAL_MS,
      questionTimeLeftMs: SUDDEN_MS,
      style: null
    };

    // デイリーチャレンジモードフラグ（startDailyChallenge() でtrue/false制御）
    let isDailyMode = false;

    function getTodayString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // ===== 日付・忘却曲線（エビングハウス）ユーティリティ =====
    function addDaysToDate(dateStr, days) {
      const parts = dateStr.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // クイズ完走時に連続学習日数を更新（同日は据え置き、昨日から連続なら+1）
    function recordPlayDay() {
      const today = getTodayString();
      if (userData.lastPlayDate === today) return;
      const yesterday = addDaysToDate(today, -1);
      userData.streak = userData.lastPlayDate === yesterday ? (userData.streak || 0) + 1 : 1;
      userData.lastPlayDate = today;
    }

    // エビングハウス忘却曲線のインターバル（ステージ1: +1日、ステージ2: +3日、ステージ3: +7日、ステージ4: +14日）
    const FORGETTING_STAGES = {
      1: { days: 1, label: "ステージ 1 (+1日後)" },
      2: { days: 3, label: "ステージ 2 (+3日後)" },
      3: { days: 7, label: "ステージ 3 (+7日後)" },
      4: { days: 14, label: "ステージ 4 (+14日後)" }
    };

    // 苦手単語を記録した場所（どのモードで間違えたか）
    const WEAK_SOURCE_LABELS = { quiz: "クイズ", mock: "模試", exam: "到達度テスト", review: "苦手復習", daily: "デイリー" };
    function weakSourceLabel(source) { return WEAK_SOURCE_LABELS[source] || WEAK_SOURCE_LABELS.quiz; }

    function getSubjectWeakWords() {
      const ids = new Set(ALL_WORDS.map(w => w.id));
      return Object.values(userData.weakWords || {}).filter(w => ids.has(w.id));
    }

    function getDueWeakWords() {
      const today = getTodayString();
      return getSubjectWeakWords().filter(w => !w.nextReview || w.nextReview <= today);
    }

    // 単語ごとの統計・周回数・完了率計算ヘルパー
    function getRangeStats(startId, endId, customPool) {
      const words = customPool || ALL_WORDS.filter(w => w.id >= startId && w.id <= endId);
      const totalWords = words.length;
      if (totalWords === 0) return { totalWords: 0, learnedCount: 0, rate: 0, round: 1 };

      const stats = userData.wordStats || {};
      let learnedCount = 0;
      let minAnswerCount = Infinity;

      words.forEach(w => {
        const s = stats[w.id];
        const total = s ? (s.total || 0) : 0;
        const correct = s ? (s.correct || 0) : 0;
        if (correct >= 1) learnedCount++;
        if (total < minAnswerCount) minAnswerCount = total;
      });

      if (!Number.isFinite(minAnswerCount)) minAnswerCount = 0;
      const rate = Math.round((learnedCount / totalWords) * 100);
      const round = minAnswerCount + 1; // 全問1回解いたら2周目

      return { totalWords, learnedCount, rate, round };
    }


    // ===== 出題の学習状況フィルター =====
    const QUIZ_STATUS_KEY = "LEAP_QUIZ_STATUS_FILTER_V2";
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
    }

    function getQuizBasePool() {
      if (rangeMode === "custom") {
        const sel = getCustomRangeSelection();
        return sel.valid ? sel.pool : [];
      }
      const parts = getSelectedPartList();
      if (parts.length === 0) return [];
      return getPoolForParts(parts);
    }

    // 学習状況チップに、いまの範囲での該当語数を出す（例文モードでは例文のある語だけで数える）
    function updateQuizStatusCounts(base) {
      const pool = base || getQuizBasePool();
      const counting = effectiveQuizStyle() === "context" ? pool.filter(w => getContextData(w)) : pool;
      document.querySelectorAll("[data-quiz-status]").forEach(btn => {
        const st = btn.dataset.quizStatus;
        const count = st === "all" ? counting.length : counting.filter(w => getWordStatus(w.id) === st).length;
        const num = btn.querySelector(".quiz-status-count");
        if (num) num.textContent = String(count);
      });
    }

    function updateQuizStatusHint() {
      const el = document.getElementById("quiz-status-hint");
      if (!el) return;
      const base = getQuizBasePool();
      const matched = base.filter(w => wordMatchesStatuses(w.id, quizStatusFilters)).length;
      updateQuizStatusCounts(base);

      if (effectiveQuizStyle() === "context") {
        // 例文モードでも学習状況フィルターを効かせ、該当語数を例文あり語数と並べて出す
        const withExample = currentSubject === "kobun"
          ? base.filter(w => hasKobunExample(w)).length
          : base.filter(w => getContextData(w)).length;
        const matchedWithExample = base.filter(w => (currentSubject === "kobun" ? hasKobunExample(w) : getContextData(w)) && wordMatchesStatuses(w.id, quizStatusFilters)).length;
        if (withExample === 0) {
          el.textContent = `例文データのある単語がありません（0 / ${base.length} 語）`;
          el.className = "text-[11px] font-bold text-rose-600";
        } else if (quizStatusFilters.length === 0) {
          el.textContent = `例文あり ${withExample} 語 / ${base.length} 語`;
          el.className = "text-[11px] font-bold text-emerald-600";
        } else {
          el.textContent = `該当 ${matchedWithExample} 語 / 例文あり ${withExample} 語`;
          el.className = `text-[11px] font-bold ${matchedWithExample === 0 ? "text-rose-600" : "text-emerald-600"}`;
        }
        return;
      }

      el.textContent = quizStatusFilters.length === 0
        ? `全 ${base.length} 語`
        : `該当 ${matched} 語 / ${base.length} 語`;
      el.className = `text-[11px] font-bold ${base.length > 0 && matched === 0 ? "text-rose-600" : "text-emerald-600"}`;
    }

    function startQuiz() {
      let pool;
      if (Array.isArray(selectedRange.partIds) && selectedRange.partIds.length > 0) {
        pool = getPoolForParts(PARTS.filter(p => selectedRange.partIds.includes(p.id)));
      } else {
        pool = ALL_WORDS.filter(w => w.id >= selectedRange.start && w.id <= selectedRange.end);
      }
      if (pool.length === 0) {
        const range = getDataIdRange();
        showAlert({
          title: "単語が見つかりません",
          message: `指定された範囲（ID: ${selectedRange.start}〜${selectedRange.end}）に単語が存在しません。\n※ 現在はID: ${range.start}〜${range.end}に対応しています。`,
          icon: "🔍"
        });
        return;
      }
      // デイリーチャレンジ以外は学習状況フィルターを適用
      if (!isDailyMode && quizStatusFilters.length > 0) {
        pool = pool.filter(w => wordMatchesStatuses(w.id, quizStatusFilters));
        if (pool.length === 0) {
          const labelText = quizStatusFilters.map(st => WORD_STATUS_LABEL[st]).join("・");
          showAlert({
            title: "該当する単語がありません",
            message: `学習状況「${labelText}」に該当する単語がありません。\n条件を「すべて」に戻すか、範囲を広げてください。`,
            icon: "🎯"
          });
          return;
        }
      }
      startQuizWithPool(pool);
    }

    // ===== 品詞（POS）推定 =====
    // 単語データに pos があればそれを優先し、なければ英語の語尾 → 日本語語義の順で推定する。
    const POS_LABELS = { noun: "名詞", verb: "動詞", adj: "形容詞", adv: "副詞", other: "その他" };
    const posCache = new Map();

    // 品詞記号（四角バッジ）の定義。データ側は "他動詞" / "vt" / "verb_transitive" などを受け付ける。
    const POS_TAGS = {
      vt: { symbol: "他", label: "他動詞" },
      vi: { symbol: "自", label: "自動詞" },
      v: { symbol: "動", label: "動詞" },
      n: { symbol: "名", label: "名詞" },
      adj: { symbol: "形", label: "形容詞" },
      adjn: { symbol: "形動", label: "形容動詞" },
      adv: { symbol: "副", label: "副詞" },
      prep: { symbol: "前", label: "前置詞" },
      conj: { symbol: "接", label: "接続詞" },
      pron: { symbol: "代", label: "代名詞" },
      aux: { symbol: "助", label: "助動詞" },
      part: { symbol: "助", label: "助詞" },
      int: { symbol: "間", label: "間投詞" }
    };

    function normalizePosDetail(raw) {
      const p = String(raw || "").trim().toLowerCase();
      if (!p) return "";
      if (/^(vt|v-t|verb_transitive|transitive|他動詞|他)$/.test(p)) return "vt";
      if (/^(vi|v-i|verb_intransitive|intransitive|自動詞|自)$/.test(p)) return "vi";
      if (/^(adjn|na-adj|na_adj|形容動詞|形動)$/.test(p)) return "adjn";
      if (/^(adj|adjective|形容詞|形)$/.test(p)) return "adj";
      if (/^(adv|adverb|副詞|副)$/.test(p)) return "adv";
      if (/^(n|noun|名詞|名)$/.test(p)) return "n";
      if (/^(prep|preposition|前置詞|前)$/.test(p)) return "prep";
      if (/^(conj|conjunction|接続詞|接)$/.test(p)) return "conj";
      if (/^(pron|pronoun|代名詞|代)$/.test(p)) return "pron";
      if (/^(aux|auxiliary|助動詞)$/.test(p)) return "aux";
      if (/^(part|particle|助詞)$/.test(p)) return "part";
      if (/^(int|interjection|間投詞|間投|間)$/.test(p)) return "int";
      if (/^(v|verb|動詞|動)$/.test(p)) return "v";
      return "";
    }

    function basePosFromTag(tag) {
      if (tag === "vt" || tag === "vi" || tag === "v") return "verb";
      if (tag === "adj" || tag === "adjn") return "adj";
      if (tag === "adv") return "adv";
      if (tag === "n" || tag === "pron") return "noun";
      return "other";
    }

    function normalizePos(raw) {
      const tag = normalizePosDetail(raw);
      if (!tag) return "other";
      return basePosFromTag(tag) || "other";
    }

    // 表示用の品詞記号。品詞データが未登録の単語はバッジを出さない（推測で誤表示しない）。
    function getPosTag(w) {
      if (!w) return "";
      if (w.pos) {
        const tag = normalizePosDetail(w.pos);
        if (tag) return tag;
      }
      if (currentSubject === "leap") {
        const builtinAll = builtinExamples();
        const ex = builtinAll[w.id] || builtinAll[String(w.id)];
        if (ex && ex.pos) return normalizePosDetail(ex.pos);
      }
      return "";
    }

    // 複数品詞（自・他など）に対応したタグ一覧
    function getPosTags(w) {
      if (!w) return [];
      const list = [];
      const push = (raw) => {
        const tag = normalizePosDetail(raw);
        if (tag && !list.includes(tag)) list.push(tag);
      };
      if (Array.isArray(w.posTags)) w.posTags.forEach(push);
      else if (w.detail && Array.isArray(w.detail.posTags)) w.detail.posTags.forEach(push);
      if (!list.length) push(getPosTag(w));
      return list;
    }

    function posBadgeHtml(tag) {
      const def = POS_TAGS[tag];
      if (!def) return "";
      const size = def.symbol.length > 1 ? "text-[9px]" : "text-[11px]";
      return `<span title="${escapeHtml(def.label)}" class="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-[5px] border font-bold align-middle shrink-0 ${size} border-slate-300 bg-white text-slate-600">${escapeHtml(def.symbol)}</span>`;
    }

    function posBadgesHtml(w) {
      return getPosTags(w).map(posBadgeHtml).join("");
    }

    // 四角いバッジに「他」「自」「名」「形」などを表示する（複数品詞は並べる）
    function applyPosBadge(el, w) {
      if (!el) return;
      const tags = getPosTags(w);
      if (!tags.length) {
        el.textContent = "";
        el.removeAttribute("title");
        el.className = "hidden";
        return;
      }
      el.innerHTML = tags.map(posBadgeHtml).join("");
      el.title = tags.map(t => POS_TAGS[t].label).join("・");
      el.className = "inline-flex items-center gap-1 flex-wrap align-middle shrink-0";
    }

    // 発音記号（IPA）を単語の下に表示
    function applyWordIpa(el, w) {
      if (!el) return;
      const ipa = (w && ((w.detail && w.detail.ipa) || w.ipa)) || "";
      if (!ipa) {
        el.textContent = "";
        el.classList.add("hidden");
        return;
      }
      el.textContent = `[${ipa}]`;
      el.classList.remove("hidden");
    }

    function inferPos(w) {
      if (!w) return "other";
      if (w.pos) return normalizePos(w.pos);
      const cacheKey = currentSubject + ":" + w.id;
      if (posCache.has(cacheKey)) return posCache.get(cacheKey);

      let pos = "other";
      const rawWord = String(w.word || "");
      const lw = rawWord.toLowerCase();

      // 例文データに品詞が付いている場合はそれを優先
      if (currentSubject === "leap") {
        const builtinAll = builtinExamples();
        const ex = builtinAll[w.id] || builtinAll[String(w.id)];
        if (ex && ex.pos) pos = normalizePos(ex.pos);
      }
      if (pos === "other" && currentSubject !== "kobun" && /^[a-z][a-z-]*$/.test(lw)) {
        if (/ly$/.test(lw)) pos = "adv";
        else if (/(ous|ful|less|ive|able|ible|ical|al|ic|ant|ent|ary|ory)$/.test(lw)) pos = "adj";
        else if (/(tion|sion|ment|ness|ity|ance|ence|ism|ship|hood|dom|ure)$/.test(lw)) pos = "noun";
        else if (/(ize|ise|ify)$/.test(lw)) pos = "verb";
      }
      if (pos === "other") {
        const segs = String(w.meaning || "").split(/[、,]/).map(s => s.trim()).filter(Boolean);
        const first = segs.length ? segs[0] : "";
        const startsTransitive = segs.some(s => /^〜[をにとの]/.test(s));
        if (/(ている|でいる|いた|かった|しい|ない|い|な)$/.test(first) && !/(する|した|られる)$/.test(first) && !startsTransitive) {
          pos = "adj";
        } else if (/(する|した)$/.test(String(w.meaning || "")) || /(される|られる|なる)$/.test(String(w.meaning || "")) || startsTransitive) {
          pos = "verb";
        } else if (/(に|へ|で)$/.test(first) && !/の$/.test(first)) {
          pos = "adv";
        } else {
          pos = "noun";
        }
      }
      posCache.set(cacheKey, pos);
      return pos;
    }

    // ===== 例文データ（内蔵 + 読み込み） =====
    // 例文データ（examples_data.js）は defer で読み込むので、参照時にグローバルを見る
    function builtinExamples() {
      return (typeof LEAP_EXAMPLE_DATA !== "undefined" && LEAP_EXAMPLE_DATA) ? LEAP_EXAMPLE_DATA : {};
    }
    const extraExamples = {};

    function registerExampleEntry(raw) {
      if (!raw || typeof raw !== "object") return false;
      const en = typeof raw.example === "string" ? raw.example
        : typeof raw.sentence === "string" ? raw.sentence
        : (Array.isArray(raw.examples) && typeof raw.examples[0] === "string") ? raw.examples[0]
        : (Array.isArray(raw.examples) && raw.examples[0] && typeof raw.examples[0].en === "string") ? raw.examples[0].en
        : "";
      if (!en) return false;
      let id = typeof raw.id === "number" ? raw.id : null;
      if (id === null && typeof raw.word === "string") {
        const hit = ALL_WORDS.find(w => String(w.word).toLowerCase() === raw.word.toLowerCase());
        if (hit) id = hit.id;
      }
      if (id === null) return false;
      const ja = typeof raw.example_ja === "string" ? raw.example_ja
        : typeof raw.exampleJa === "string" ? raw.exampleJa
        : (Array.isArray(raw.examples) && raw.examples[0] && typeof raw.examples[0].ja === "string") ? raw.examples[0].ja
        : "";
      extraExamples[id] = { en, ja };
      return true;
    }

    function getExampleFor(w) {
      if (!w || typeof w.id !== "number") return null;
      if (typeof w.example === "string" && w.example) return { en: w.example, ja: w.example_ja || "" };
      if (Array.isArray(w.examples) && w.examples.length) {
        const first = w.examples[0];
        if (typeof first === "string") return { en: first, ja: "" };
        if (first && typeof first.en === "string") return { en: first.en, ja: first.ja || "" };
      }
      if (extraExamples[w.id] && extraExamples[w.id].en) return extraExamples[w.id];
      if (currentSubject === "leap") {
        const builtinAll = builtinExamples();
        const builtin = builtinAll[w.id] || builtinAll[String(w.id)];
        if (builtin && typeof builtin.en === "string") return { en: builtin.en, ja: builtin.ja || "" };
      }
      return null;
    }

    // 例文中の対象単語を [ ____ ] に置き換える（活用形 s/es/ed/d/ing/ly にも対応）
    function buildCloze(sentence, word) {
      const src = String(sentence || "");
      const target = String(word || "").trim();
      if (!src || !target) return null;
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("\\b" + escaped + "(?:s|es|ed|d|ing|ly)?\\b", "i");
      const m = src.match(re);
      if (!m) return null;
      return {
        prompt: src.slice(0, m.index) + "[ ____ ]" + src.slice(m.index + m[0].length),
        form: m[0]
      };
    }

    // 古文で例文クイズに出題できる例文を持つか（関連語の例文しかない語は対象外）
    function hasKobunExample(w) {
      const list = w && w.detail && Array.isArray(w.detail.examples) ? w.detail.examples : [];
      return list.some(ex => ex && ex.quizEligible && ex.answer && ex.prompt && ex.prompt.includes("[ ____ ]"));
    }

    function getContextData(w, pickRandom) {
      // 古文は古典の例文の空欄を出す。例文が無い語だけ語義→古語にフォールバック
      if (currentSubject === "kobun") {
        const list = (w && w.detail && Array.isArray(w.detail.examples)) ? w.detail.examples : [];
        const pool = list.filter(ex => ex && ex.quizEligible && ex.answer && ex.prompt && ex.prompt.includes("[ ____ ]"));
        if (pool.length) {
          const ex = pickRandom ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
          return {
            en: ex.plain,
            ja: ex.ja || "",
            prompt: ex.prompt,
            form: ex.answer || "",
            meaning: ex.ja || "",
            jaMark: "",
            source: ex.source || "",
            marked: ex.sentence || "",
            kobun: true
          };
        }
        const meaning = formatKobunMeaning((w && w.meaning) || "");
        if (!meaning) return null;
        return { en: meaning, ja: "", prompt: meaning, form: "", reverse: true };
      }
      // 詳細データの例文（括弧マーカー付き）を最優先で使う
      const d = w && w.detail;
      if (d && Array.isArray(d.examples) && d.examples.length) {
        const usable = d.examples.filter(ex => ex && ex.hasBlank && ex.prompt);
        if (usable.length) {
          const ex = pickRandom ? usable[Math.floor(Math.random() * usable.length)] : usable[0];
          return {
            en: ex.plain || ex.en,
            ja: ex.ja || "",
            prompt: ex.prompt,
            form: ex.answer || "",
            meaning: ex.ja || "",
            jaMark: ex.jaMark || ""
          };
        }
      }
      const ex = getExampleFor(w);
      if (!ex) return null;
      const cloze = buildCloze(ex.en, w.word);
      if (!cloze) return null;
      return { en: ex.en, ja: ex.ja || "", prompt: cloze.prompt, form: cloze.form };
    }

    // ===== インテリジェントなダミー選択肢 =====
    function sharedPrefixLength(a, b) {
      const n = Math.min(a.length, b.length);
      let i = 0;
      while (i < n && a[i] === b[i]) i++;
      return i;
    }

    // target と同じ品詞を優先し、苦手単語・スペル類似語を混ぜる。
    // blocked には「クイズセット内の他の正解」を渡し、メタ読みを防ぐ。
    function pickDistractorWords(target, mode, usedKeys, blocked, count) {
      const need = count || 3;
      const pos = inferPos(target);
      const weakIds = new Set(Object.keys(userData.weakWords || {}).map(Number));
      const targetWord = String(target.word || "").toLowerCase();
      const targetMeaning = String(target.meaning || "");
      const samePos = { weak: [], trap: [], plain: [] };
      const rest = [];

      ALL_WORDS.forEach(w => {
        if (!w || w.id === target.id) return;
        if (!w.word && !w.meaning) return;
        const key = mode === "word" ? String(w.word || "") : String(w.meaning || "");
        if (!key || usedKeys.has(key) || blocked.has(key)) return;
        if (String(w.meaning || "") === targetMeaning) return;
        if (mode === "word" && String(w.word || "").toLowerCase() === targetWord) return;
        const item = { key, word: w };
        if (inferPos(w) === pos) {
          samePos.plain.push(item);
          if (weakIds.has(w.id)) samePos.weak.push(item);
          if (mode === "word" && sharedPrefixLength(String(w.word || "").toLowerCase(), targetWord) >= 3) samePos.trap.push(item);
        } else {
          rest.push(item);
        }
      });

      const picked = [];
      const pickedKeys = new Set();
      const take = (list, max) => {
        let taken = 0;
        for (const item of shuffleArray(list)) {
          if (picked.length >= need || taken >= max) break;
          if (pickedKeys.has(item.key)) continue;
          picked.push(item.word);
          pickedKeys.add(item.key);
          taken++;
        }
      };

      // 1) 苦手単語  2) スペル・接頭辞が似たトラップ  3) 同品詞  4) 不足分は全体から
      take(samePos.weak, 1);
      take(samePos.trap, 1);
      take(samePos.plain, need - picked.length);
      if (picked.length < need) take(rest, need - picked.length);
      return picked;
    }

    // ===== 到達度テスト（50問・25分・S〜D判定）=====
    const EXAM_QUESTION_COUNT = 50;
    const EXAM_TOTAL_MS = 25 * 60 * 1000;
    // 模試は開催回ごとの duration_sec を使うため、現在の試験の制限時間を保持する
    let examSessionTotalMs = EXAM_TOTAL_MS;
    const EXAM_RANGE_KEY = "LEAP_EXAM_RANGE_V1";
    const EXAM_GRADES = [
      { grade: "S", min: 95, label: "完璧", cls: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-300" },
      { grade: "A", min: 85, label: "優秀", cls: "text-emerald-700 bg-emerald-50 border-emerald-300" },
      { grade: "B", min: 70, label: "合格圈", cls: "text-sky-700 bg-sky-50 border-sky-300" },
      { grade: "C", min: 55, label: "要復習", cls: "text-amber-700 bg-amber-50 border-amber-300" },
      { grade: "D", min: 0, label: "基礎から", cls: "text-rose-700 bg-rose-50 border-rose-300" }
    ];
    let examPartId = null; // null = 現在のゾーンの全範囲
    let examRunning = false;
    let examStartedAt = 0;

    function examGradeFor(accuracy) {
      return EXAM_GRADES.find(g => accuracy >= g.min) || EXAM_GRADES[EXAM_GRADES.length - 1];
    }

    function loadExamRange() {
      try {
        const raw = localStorage.getItem(EXAM_RANGE_KEY);
        const id = raw ? Number(raw) : NaN;
        examPartId = Number.isFinite(id) && PARTS.some(p => p.id === id) ? id : null;
      } catch (e) { examPartId = null; }
    }

    function examRangeLabel() {
      const part = examPartId ? PARTS.find(p => p.id === examPartId) : null;
      return part ? part.name : "全範囲";
    }

    function renderExamScreen() {
      loadExamRange();
      const wrap = document.getElementById("exam-part-buttons");
      if (wrap) {
        wrap.innerHTML = "";
        const options = [{ id: null, name: "全範囲" }].concat(getAvailableParts().map(p => ({ id: p.id, name: p.name })));
        options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          const on = examPartId === opt.id;
          btn.className = "py-2 px-2 text-[11px] font-bold border rounded-lg transition cursor-pointer " +
            (on ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100");
          btn.textContent = opt.name;
          btn.addEventListener("click", () => {
            examPartId = opt.id;
            try { localStorage.setItem(EXAM_RANGE_KEY, opt.id === null ? "" : String(opt.id)); } catch (e) {}
            renderExamScreen();
          });
          wrap.appendChild(btn);
        });
      }

      const summary = document.getElementById("exam-range-summary");
      if (summary) {
        const part = examPartId ? PARTS.find(p => p.id === examPartId) : null;
        const words = part ? getPoolForParts([part]) : ALL_WORDS;
        summary.textContent = `${examRangeLabel()} ・ ${words.length}語`;
      }

      const history = Array.isArray(userData.examHistory) ? userData.examHistory : [];
      const bestEl = document.getElementById("exam-best-grade");
      if (bestEl) {
        if (history.length === 0) {
          bestEl.textContent = "最高判定: -";
        } else {
          const best = history.reduce((mx, h) => Math.max(mx, Number(h.accuracy) || 0), 0);
          bestEl.textContent = `最高判定: ${examGradeFor(best).grade}（${Math.round(best)}%）`;
        }
      }

      const list = document.getElementById("exam-history-list");
      if (list) {
        list.innerHTML = "";
        if (history.length === 0) {
          const empty = document.createElement("p");
          empty.className = "text-[11px] text-slate-400";
          empty.textContent = "まだ記録がありません。最初のテストを受けてみましょう。";
          list.appendChild(empty);
        } else {
          history.slice(0, 5).forEach((h) => {
            const g = examGradeFor(Number(h.accuracy) || 0);
            const row = document.createElement("div");
            row.className = "flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5";
            const left = document.createElement("span");
            left.className = "min-w-0 truncate text-slate-600";
            left.textContent = `${h.date || ""} ・ ${h.range || ""}`;
            const right = document.createElement("span");
            right.className = "shrink-0 flex items-center gap-2";
            right.innerHTML = `<span class="font-bold text-slate-800 tabular-nums">${Number(h.correct) || 0}/${Number(h.total) || 0}（${Math.round(Number(h.accuracy) || 0)}%）</span><span class="font-extrabold border rounded-md px-1.5 py-0.5 ${g.cls}">${g.grade}</span>`;
            row.appendChild(left);
            row.appendChild(right);
            list.appendChild(row);
          });
        }
      }
    }

    // フレンドが共有した到達度テストと同じ範囲で挑戦する
    function startExamChallenge(subject, partId) {
      const subj = subject === "kobun" ? "kobun" : "leap";
      if (subj !== currentSubject) {
        applySubject(subj, { silent: true });
        loadPartSelection();
      }
      examPartId = (partId === null || partId === undefined || partId === "null" || partId === "") ? null : Number(partId);
      if (examPartId && !PARTS.some(p => p.id === examPartId)) examPartId = null;
      try { localStorage.setItem(EXAM_RANGE_KEY, examPartId === null ? "" : String(examPartId)); } catch (e) {}
      startExam();
    }

    function startExam() {
      const part = examPartId ? PARTS.find(p => p.id === examPartId) : null;
      const pool = part ? getPoolForParts([part]) : [...ALL_WORDS];
      if (pool.length === 0) {
        showAlert({ title: "単語がありません", message: "この範囲には単語データがありません。", icon: "🔍" });
        return;
      }
      startQuizWithPool(pool, { examMode: true });
    }


    function startQuizWithPool(pool, options) {
      const forceNormal = !!(options && options.forceNormalMode);
      const forceNormalStyle = !!(options && options.forceNormalStyle);
      const mockRun = !!(options && options.mockExam);
      const examRun = !!(options && options.examMode) || mockRun;
      const forcedCount = Number(options && options.questionCount) || 0;
      // 新しいクイズの開始では前回の「つづき」を消さない。
      // 上書きされるのは、新しいクイズで2問目以降に進んで saveResumeState() が走ったときだけ。
      mockExamRunning = mockRun;
      examRunning = examRun;
      examStartedAt = examRun ? Date.now() : 0;
      examSessionTotalMs = mockRun
        ? Math.max(60, Number(options && options.durationSec) || 1500) * 1000
        : EXAM_TOTAL_MS;
      const style = (forceNormalStyle || examRun) ? "normal" : effectiveQuizStyle();
      const mode = examRun ? "exam" : (forceNormal ? "normal" : gameMode);
      quizGameMode = mode;
      quizState.style = style;
      let candidates = shuffleArray([...pool]);

      // 例文データが未読み込み（defer の直後など）なら一度だけ待って再試行
      if (style === "context" && typeof LEAP_WORD_DETAILS === "undefined" && !(options && options.__examplesRetried)) {
        showToast("例文データを読み込み中です…");
        const retry = () => startQuizWithPool(pool, Object.assign({}, options, { __examplesRetried: true }));
        if (window.LEAP_EXAMPLES_READY) window.LEAP_EXAMPLES_READY.then(retry); else setTimeout(retry, 1200);
        return;
      }
      if (style === "context") {
        candidates = candidates.filter(w => getContextData(w));
        if (candidates.length === 0) {
          showAlert({
            title: "例文データがありません",
            message: "この範囲には例文データが登録されていません。\n\n・別の範囲を選ぶ\n・ホームの「[+] 追加のJSONファイルを読み込む」から例文入りデータを追加\n　形式: [{\"id\": 61, \"example\": \"...\", \"example_ja\": \"...\"}]\n\nのいずれかをお試しください。",
            icon: "📝"
          });
          return;
        }
      }
      if (candidates.length === 0) {
        showAlert({ title: "単語が見つかりません", message: "指定された範囲に単語が存在しません。", icon: "🔍" });
        return;
      }

      let targetCount;
      if (mode === "sprint") {
        targetCount = Math.min(80, Math.max(30, candidates.length));
      } else if (mode === "exam") {
        const examCap = mockRun
          ? (Number(options && options.mockQuestionCount) || EXAM_QUESTION_COUNT)
          : EXAM_QUESTION_COUNT;
        targetCount = Math.min(examCap, candidates.length);
      } else {
        const normalCap = forcedCount > 0 ? forcedCount : questionLimit;
        targetCount = normalCap === 0 ? candidates.length : Math.min(normalCap, candidates.length);
      }

      const selectedWords = [];
      if (mode === "sprint") {
        // 60秒で解ける問題数を確保するため、語数が少ない場合は周回して補充する
        let guard = 0;
        while (selectedWords.length < targetCount && guard < 200) {
          const round = shuffleArray(candidates);
          for (const w of round) {
            if (selectedWords.length >= targetCount) break;
            if (selectedWords.length && candidates.length > 1 && selectedWords[selectedWords.length - 1].id === w.id) continue;
            selectedWords.push(w);
          }
          guard++;
        }
      } else {
        selectedWords.push(...candidates.slice(0, targetCount));
      }

      // ディレクターズ・カット方式: セット内の正解はダミーに使わない
      const blockedMeanings = new Set(selectedWords.map(w => String(w.meaning || "")));
      const blockedWords = new Set(selectedWords.map(w => String(w.word || "")));

      quizState.questions = selectedWords.map(targetWord => {
        const contextData = style === "context" ? getContextData(targetWord, true) : null;
        const optionMode = contextData ? "word" : "meaning";
        const correctText = optionMode === "word" ? String(targetWord.word || "") : String(targetWord.meaning || "");
        const usedKeys = new Set([correctText]);
        const blocked = optionMode === "word" ? blockedWords : blockedMeanings;
        const distractors = pickDistractorWords(targetWord, optionMode, usedKeys, blocked, 3);
        const options = shuffleArray([
          { text: correctText, isCorrect: true, word: targetWord },
          ...distractors.map(w => ({
            text: optionMode === "word" ? String(w.word || "") : String(w.meaning || ""),
            isCorrect: false,
            word: w
          }))
        ]);
        return {
          word: targetWord,
          type: optionMode,
          sentence: contextData ? contextData.prompt : "",
          sentenceEn: contextData ? contextData.en : "",
          sentenceJa: contextData ? contextData.ja : "",
          sentenceJaMark: contextData ? contextData.jaMark : "",
          sentenceSource: contextData ? (contextData.source || "") : "",
          sentenceMarked: contextData ? (contextData.marked || "") : "",
          pos: inferPos(targetWord),
          options
        };
      });

      quizState.questions = quizState.questions.filter(q => q.options.length >= 4);
      if (quizState.questions.length === 0) {
        showAlert({ title: "出題できません", message: "選択肢を作れるだけの単語データがありません。", icon: "📚" });
        return;
      }

      quizState.currentIndex = 0;
      quizState.score = 0;
      quizState.combo = 0;
      quizState.maxCombo = 0;
      quizState.correctCount = 0;
      quizState.earnedCoins = 0;
      quizState.earnedExp = 0;
      quizState.mistakes = [];
      quizState.isAnswered = false;
      quizState.isMasked = false;
      quizState.isAborted = false;
      quizState.answeredCount = 0;
      quizState.endReason = "";
      quizState.timeLeftMs = mode === "exam" ? examSessionTotalMs : SPRINT_TOTAL_MS;
      quizState.questionTimeLeftMs = SUDDEN_MS;
      quizState.answerLog = {}; // 模試の提出用（index → 正誤）
      quizState.answerTimes = {}; // 模試の時間配分ログ（index → 解答までの秒数）
      quizState.questionShownAt = 0;
      quizState.startLevel = getLevelState(userData.exp).level;

      const rInfo = document.getElementById("quiz-range-info");
      if (rInfo) {
        const modeTag = mode === "normal" ? "" : ` ・ ${GAME_MODES[mode].icon}${GAME_MODES[mode].label}`;
        const styleTag = style === "context" ? " ・ 📝例文"
          : style === "listening" ? " ・ 🎧音声"
          : style === "spelling" ? " ・ 🔤スペル"
          : "";
        const examLabel = examRun
          ? (mockRun ? (mockExamCurrent && mockExamCurrent.title ? mockExamCurrent.title : "全国一斉模試") : examRangeLabel())
          : selectedRange.label;
        rInfo.textContent = `${examLabel}${styleTag}${modeTag}`;
      }
      const liveCoins = document.getElementById("quiz-live-coins");
      if (liveCoins) liveCoins.textContent = `🪙 +0`;

      navigate("screen-quiz");
      setupQuizClock();
      renderQuestion();
    }

    // ===== タイマー（60秒スプリント / サドンデス）=====
    let brainFirstTimer = null;
    let quizClockTimer = null;

    function brainFirstDelayMs() {
      return quizGameMode === "sprint" ? 800 : 1200;
    }

    function clearBrainTimer() {
      if (brainFirstTimer) { clearTimeout(brainFirstTimer); brainFirstTimer = null; }
    }

    function stopQuizClock() {
      if (quizClockTimer) { clearInterval(quizClockTimer); quizClockTimer = null; }
    }

    function stopQuizTimers() {
      clearBrainTimer();
      stopQuizClock();
      quizState.isMasked = false;
    }

    function setupQuizClock() {
      stopQuizClock();
      const wrap = document.getElementById("quiz-timer-wrap");
      if (quizGameMode === "normal") {
        if (wrap) wrap.classList.add("hidden");
        return;
      }
      if (wrap) wrap.classList.remove("hidden");
      if (quizGameMode === "exam") {
        quizState.timeLeftMs = examSessionTotalMs;
        startExamClock();
        updateTimerUi();
        return;
      }
      if (quizGameMode === "sprint") {
        quizState.timeLeftMs = SPRINT_TOTAL_MS;
        startSprintClock();
      } else {
        quizState.questionTimeLeftMs = SUDDEN_MS;
      }
      updateTimerUi();
    }

    function startSprintClock() {
      stopQuizClock();
      quizClockTimer = setInterval(() => {
        if (quizState.isMasked || quizState.isAnswered) return;
        quizState.timeLeftMs -= 100;
        if (quizState.timeLeftMs <= 0) {
          quizState.timeLeftMs = 0;
          updateTimerUi();
          finishQuiz(false, "timeup");
          return;
        }
        updateTimerUi();
      }, 100);
    }

    // 到達度テスト: 25分のカウントダウン（延長・誤答ペナルティなし）
    function startExamClock() {
      stopQuizClock();
      quizClockTimer = setInterval(() => {
        quizState.timeLeftMs = Math.max(0, (quizState.timeLeftMs || 0) - 1000);
        if (quizState.timeLeftMs <= 0) {
          updateTimerUi();
          finishQuiz(false, "examtime");
          return;
        }
        updateTimerUi();
      }, 1000);
    }

    function startSuddenClock() {
      stopQuizClock();
      quizState.questionTimeLeftMs = SUDDEN_MS;
      updateTimerUi();
      quizClockTimer = setInterval(() => {
        if (quizState.isAnswered || quizState.isMasked) return;
        quizState.questionTimeLeftMs -= 100;
        if (quizState.questionTimeLeftMs <= 0) {
          quizState.questionTimeLeftMs = 0;
          updateTimerUi();
          handleSuddenTimeout();
          return;
        }
        updateTimerUi();
      }, 100);
    }

    function startQuestionClock() {
      if (quizGameMode === "sprint") {
        if (!quizClockTimer) startSprintClock();
      } else if (quizGameMode === "sudden") {
        startSuddenClock();
      }
    }

    function updateTimerUi() {
      const wrap = document.getElementById("quiz-timer-wrap");
      if (!wrap || quizGameMode === "normal") return;
      const bar = document.getElementById("quiz-timer-bar");
      const label = document.getElementById("quiz-timer-label");
      const note = document.getElementById("quiz-timer-note");
      const urgentClass = "h-full rounded-full bg-rose-500 transition-all duration-100";
      const normalClass = "h-full rounded-full bg-amber-500 transition-all duration-100";
      if (quizGameMode === "exam") {
        const left = Math.max(0, quizState.timeLeftMs || 0);
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        if (label) label.textContent = `🎓 残り ${m}:${String(s).padStart(2, "0")}`;
        if (bar) { bar.style.width = `${Math.min(100, (left / Math.max(1, examSessionTotalMs)) * 100)}%`; bar.className = left <= 300000 ? urgentClass : normalClass; }
        if (note) note.textContent = "時間切れで自動終了";
        return;
      }
      if (quizGameMode === "sprint") {
        const left = Math.max(0, quizState.timeLeftMs || 0);
        if (label) label.textContent = `⏱️ 60秒スプリント: ${(left / 1000).toFixed(1)}s`;
        if (bar) { bar.style.width = `${Math.min(100, (left / SPRINT_TOTAL_MS) * 100)}%`; bar.className = left <= 10000 ? urgentClass : normalClass; }
        if (note) note.textContent = "5コンボ +3秒 / 誤答 -2秒";
      } else {
        const left = Math.max(0, quizState.questionTimeLeftMs || 0);
        if (label) label.textContent = `💀 サドンデス: 残り ${(left / 1000).toFixed(1)}s`;
        if (bar) { bar.style.width = `${(left / SUDDEN_MS) * 100}%`; bar.className = left <= 2500 ? urgentClass : normalClass; }
        if (note) note.textContent = "誤答・時間切れで即終了";
      }
    }

    function handleSuddenTimeout() {
      if (quizState.isAnswered) return;
      const q = quizState.questions[quizState.currentIndex];
      quizState.isAnswered = true;
      if (q) {
        quizState.answeredCount = (quizState.answeredCount || 0) + 1;
        registerWrongAnswer(q);
      }
      showToast("⏰ 時間切れ…");
      finishQuiz(false, "sudden");
    }

    // escapeHtml は js/core.js に集約（ファイル分割 Stage 2 で重複を解消）

    // 例文の日本語訳のうち、空欄に対応する語義を見やすく強調する
    function highlightJapanese(ja, w, forcedMark) {
      const text = String(ja || "");
      if (!text) return "";
      // データ側で対応語句が個別指定されている場合はそれを優先する
      if (forcedMark && text.includes(forcedMark)) {
        const fi = text.indexOf(forcedMark);
        return escapeHtml(text.slice(0, fi))
          + `<mark class="bg-emerald-100 text-emerald-900 font-bold px-0.5 rounded" title="空欄に入る語の意味">${escapeHtml(forcedMark)}</mark>`
          + escapeHtml(text.slice(fi + forcedMark.length));
      }
      const candidates = new Set();
      const add = (raw) => {
        let s = String(raw || "").replace(/[①-⑳]/g, "")
          .replace(/^[〜~～]+/, "")
          .replace(/^[（(][^）)]*[）)]/, "")
          .replace(/[（(][^）)]*$/g, "")
          .trim();
        s = s.replace(/(している|している|される|られた|する|した|な|の|だ)$/g, "").trim();
        if (s.length > 2) s = s.replace(/^[をにがはとでへの]/, "");
        if (s.length >= 2 && !/^(こと|もの|ひと|人|〜|する|ある)$/.test(s)) candidates.add(s);
      };
      if (w && w.meaning) String(w.meaning).split(/[、,／\/]/).forEach(add);
      if (w && w.detail && Array.isArray(w.detail.senses)) {
        w.detail.senses.forEach(se => {
          String(se.text || "").split(/[、,／\/\s　]/).forEach(seg => {
            add(seg);
            add(seg.replace(/[（(][^）)]*[）)]/g, ""));
          });
        });
      }
      let best = "";
      candidates.forEach(c => {
        if (text.includes(c) && c.length > best.length) best = c;
      });
      // 語形が違う場合（身体→体 など）は漢字1字の一致まで探す
      if (!best) {
        const kanji = new Set();
        candidates.forEach(c => {
          for (const ch of c) if (/[\u4e00-\u9fff]/.test(ch)) kanji.add(ch);
        });
        kanji.forEach(ch => { if (text.includes(ch)) best = best || ch; });
      }
      // 対応する語句を特定できない場合も、和訳全体を緑にして見やすくする
      if (!best) {
        return `<mark class="bg-emerald-100 text-emerald-900 rounded px-0.5">${escapeHtml(text)}</mark>`;
      }
      const idx = text.indexOf(best);
      // 「開発」→「開発する」、「発」→「発展する」のように語尾まで広げて強調する
      const range = expandJapaneseWord(text, idx, best.length);
      best = text.slice(range.start, range.end);
      return escapeHtml(text.slice(0, range.start))
        + `<mark class="bg-emerald-100 text-emerald-900 font-bold px-0.5 rounded" title="空欄に入る語の意味">${escapeHtml(best)}</mark>`
        + escapeHtml(text.slice(range.end));
    }

    function expandJapaneseWord(text, start, len) {
      const isKanji = (c) => /[\u4e00-\u9fff]/.test(c);
      const isKata = (c) => /[\u30a0-\u30ff]/.test(c);
      const isHira = (c) => /[\u3040-\u309f]/.test(c);
      const particles = "のにをがはでともへや";
      let s = start;
      let e = start + len;
      while (s > 0 && (isKanji(text[s - 1]) || isKata(text[s - 1]))) s--;
      while (e < text.length && (isKanji(text[e]) || isKata(text[e]))) e++;
      while (e < text.length && isHira(text[e]) && !particles.includes(text[e])) e++;
      return { start: s, end: e };
    }

    function contextJaHtml(w, ja, forcedMark) {
      // 辞典の詳細シートと同じ「訳」バッジで揃える
      return `<span class="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 mr-1 align-[1px]">訳</span>${highlightJapanese(ja, w, forcedMark)}`;
    }

    // 古文の例文訳（【】をハイライト）＋出典バッジ
    function kobunJaHtml(q) {
      const body = formatKobunMarked(q && q.sentenceJa ? q.sentenceJa : "");
      const src = q && q.sentenceSource
        ? `<span class="inline-block ml-1 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded px-1 py-0.5 align-[1px]">${escapeHtml(q.sentenceSource)}</span>`
        : "";
      return `<span class="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 mr-1 align-[1px]">訳</span>${body}${src}`;
    }

    // 自力想起ステップ: 選択肢の代わりにマスクを表示
    function renderOptionMask() {
      const container = document.getElementById("quiz-options-container");
      if (!container) return;
      container.innerHTML = "";
      const hint = activeQuizStyle() === "context"
        ? (currentSubject === "kobun" ? "空欄に入りそうな古語を思い出してみよう…" : "空欄に入りそうな単語を想像してみよう…")
        : activeQuizStyle() === "listening"
          ? "聞こえた単語の意味を思い出してみよう…"
          : "日本語の語義を思い出してみよう…";
      const mask = document.createElement("div");
      mask.className = "brain-mask rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-2";
      mask.innerHTML = `
        <div class="brain-emoji text-3xl">🧠</div>
        <p class="text-sm font-bold text-slate-700">まず頭の中で思い出そう</p>
        <p class="text-[11px] text-slate-400 leading-relaxed">${escapeHtml(hint)}</p>
        <div class="w-full max-w-[220px] mx-auto bg-slate-200 h-1 rounded-full overflow-hidden">
          <div id="brain-mask-bar" class="h-full bg-emerald-500" style="width:0%"></div>
        </div>
      `;
      container.appendChild(mask);
      const bar = document.getElementById("brain-mask-bar");
      if (bar) {
        requestAnimationFrame(() => {
          bar.style.transition = `width ${brainFirstDelayMs()}ms linear`;
          bar.style.width = "100%";
        });
      }
    }

    function renderOptions(q) {
      const container = document.getElementById("quiz-options-container");
      if (!container || !q) return;
      container.innerHTML = "";
      q.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        // active:scale-[0.99] はスマホタッチ時にドラッグ判定されクリックを無効化する原因となるため排除
        btn.className = "option-reveal w-full text-left p-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-800 transition-colors flex items-center gap-3 cursor-pointer select-none";
        btn.style.touchAction = "manipulation";
        btn.style.animationDelay = `${idx * 60}ms`;
        // 子要素に pointer-events-none を付与して確実にボタン本体でイベントを受け止める
        btn.innerHTML = `<span class="w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200 pointer-events-none">${idx + 1}</span><span class="text-sm leading-snug pointer-events-none">${escapeHtml(opt.text)}</span>`;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleAnswer(opt, btn);
        });
        container.appendChild(btn);
      });
    }

    function revealContextAnswer(q) {
      if (!q || q.type !== "word") return;
      const wordRow = document.getElementById("quiz-word-row");
      if (wordRow) wordRow.classList.remove("hidden");
      const wordEl = document.getElementById("quiz-word");
      if (wordEl) wordEl.textContent = q.word.word;
      const sentenceEl = document.getElementById("quiz-context-sentence");
      if (sentenceEl) {
        if (currentSubject === "kobun" && q.sentenceMarked) sentenceEl.innerHTML = formatKobunMarked(q.sentenceMarked);
        else sentenceEl.textContent = q.sentenceEn || q.sentence;
      }
      const jaEl = document.getElementById("quiz-context-ja");
      if (jaEl && q.sentenceJa) {
        jaEl.innerHTML = currentSubject === "kobun" ? kobunJaHtml(q) : contextJaHtml(q.word, q.sentenceJa, q.sentenceJaMark);
        jaEl.classList.remove("hidden");
      }
      // 正解の単語が出たので、例文側の品詞バッジと指示チップは隠す（二重表示を防ぐ）
      const promptEl = document.getElementById("quiz-context-prompt");
      if (promptEl) {
        promptEl.textContent = currentSubject === "kobun" && q.sentenceSource
          ? `✅ 正解 ・ ${q.sentenceSource}`
          : "✅ 正解";
      }
      const ctxPos = document.getElementById("quiz-context-pos");
      if (ctxPos) ctxPos.classList.add("hidden");
      applyWordIpa(document.getElementById("quiz-word-ipa"), q.word);
    }

    // 通常クイズ・例文クイズ共通の正解表示
    function showAnswerFeedback(q) {
      const el = document.getElementById("quiz-answer-feedback");
      if (!el || !q || !q.word) return;
      if (currentSubject === "kobun") {
        const reading = String(q.word.reading || q.word.yomi || "");
        el.textContent = `正解: ${q.word.word}（${reading && reading !== q.word.word ? reading + " / " : ""}${formatKobunMeaning(q.word.meaning)}）`;
        el.classList.remove("hidden");
        return;
      }
      const tag = getPosTag(q.word);
      const posLabel = (POS_TAGS[tag] && POS_TAGS[tag].label) || POS_LABELS[q.pos] || "語彙";
      el.textContent = `正解: ${q.word.word}（${posLabel} / ${q.word.meaning}）`;
      el.classList.remove("hidden");
    }

    // ===== 学習記録（カレンダー・Part別マスター率）=====
    // 日別の解答数を記録する（学習カレンダー用。正誤を問わず1問1カウント）
    function bumpDailyLog() {
      const today = getTodayString();
      if (!userData.dailyLog || typeof userData.dailyLog !== "object") userData.dailyLog = {};
      userData.dailyLog[today] = (Number(userData.dailyLog[today]) || 0) + 1;
      // 今日の目標（1日20問）に到達したら1日1回だけ祝う
      try {
        const goal = (typeof DAILY_GOAL_COUNT === "number") ? DAILY_GOAL_COUNT : 20;
        if (userData.dailyLog[today] === goal && localStorage.getItem("LEAP_DAILY_GOAL_SEEN_V1") !== today) {
          localStorage.setItem("LEAP_DAILY_GOAL_SEEN_V1", today);
          showToast(`🎯 今日の目標 ${goal}問 を達成！`);
        }
      } catch (e) {}
      const keys = Object.keys(userData.dailyLog).sort();
      if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => { delete userData.dailyLog[k]; });
    }

    function calendarLevel(count) {
      if (count <= 0) return "";
      if (count < 10) return "l1";
      if (count < 30) return "l2";
      if (count < 60) return "l3";
      return "l4";
    }

    function renderStatsScreen() {
      const log = (userData.dailyLog && typeof userData.dailyLog === "object") ? userData.dailyLog : {};
      const answered = Object.keys(log).reduce((sum, k) => sum + (Number(log[k]) || 0), 0);
      const words = ALL_WORDS || [];
      const stats = userData.wordStats || {};
      const mastered = words.filter(w => getWordStatus(w.id) === "mastered").length;
      const weak = Object.keys(userData.weakWords || {}).filter(id => Number(id) >= 10000 ? currentSubject === "kobun" : currentSubject === "leap").length;

      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setText("stats-streak", String(userData.streak || 0));
      setText("stats-answered", String(answered));
      setText("stats-mastered", String(mastered));
      setText("stats-weak", String(weak));
      const zoneBadge = document.getElementById("stats-zone-badge");
      if (zoneBadge) {
        zoneBadge.textContent = currentSubject === "kobun" ? "古文" : "LEAP";
        zoneBadge.className = currentSubject === "kobun"
          ? "text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md"
          : "text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md";
      }

      // カレンダー: 直近12週（今日を含む・日曜始まり）
      const cal = document.getElementById("stats-calendar");
      if (cal) {
        cal.innerHTML = "";
        const todayStr = getTodayString();
        const dow = new Date().getDay();
        const totalDays = 11 * 7 + dow + 1;
        const startDate = addDaysToDate(todayStr, -(totalDays - 1));
        for (let w = 0; w < 12; w++) {
          const col = document.createElement("div");
          col.className = "grid gap-1";
          col.style.gridTemplateRows = "repeat(7, 12px)";
          for (let d = 0; d < 7; d++) {
            const offset = w * 7 + d;
            const cell = document.createElement("div");
            if (offset > totalDays - 1) {
              cell.className = "w-3 h-3";
              cell.style.visibility = "hidden";
            } else {
              const dateStr = addDaysToDate(startDate, offset);
              const count = Number(log[dateStr] || 0);
              cell.className = `cal-cell w-3 h-3 ${calendarLevel(count)}`;
              cell.title = `${dateStr} ・ ${count}問`;
            }
            col.appendChild(cell);
          }
          cal.appendChild(col);
        }
      }

      // Part別マスター率
      const wrap = document.getElementById("stats-parts");
      if (wrap) {
        wrap.innerHTML = "";
        const parts = getAvailableParts();
        if (!parts.length) {
          const empty = document.createElement("p");
          empty.className = "text-[11px] text-slate-400";
          empty.textContent = "対象のPartがありません。";
          wrap.appendChild(empty);
        }
        parts.forEach((p) => {
          const partWords = getPoolForParts([p]);
          const total = partWords.length;
          const m = partWords.filter(w => getWordStatus(w.id) === "mastered").length;
          const studied = partWords.filter(w => (stats[w.id] && Number(stats[w.id].total) > 0)).length;
          const rate = total > 0 ? Math.round((m / total) * 100) : 0;
          const row = document.createElement("div");
          row.className = "space-y-1";
          row.innerHTML = `
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="min-w-0 truncate font-bold text-slate-700">${escapeHtml(p.name || `Part ${p.id}`)}</span>
              <span class="shrink-0 text-slate-500 tabular-nums"><span class="font-extrabold text-emerald-700">${m}</span>/${total}語 ・ ${rate}%</span>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full" style="width:${rate}%"></div>
            </div>
            <p class="text-[10px] text-slate-400">学習済み ${studied}/${total} 語</p>
          `;
          wrap.appendChild(row);
        });
      }
    }

    function renderQuestion() {
      try {
        if (!quizState.questions || quizState.questions.length === 0 || !quizState.questions[quizState.currentIndex]) {
          console.warn("No question found at currentIndex", quizState.currentIndex);
          finishQuiz(false);
          return;
        }

        const q = quizState.questions[quizState.currentIndex];
        quizState.isAnswered = false;
        // 時間配分ログ用: この問題を表示した時刻（模試のみ提出データに載せる）
        quizState.questionShownAt = Date.now();
        clearBrainTimer();
        if (quizGameMode === "sudden") stopQuizClock();

        const total = quizState.questions.length;
        const current = quizState.currentIndex + 1;
        const progText = document.getElementById("quiz-progress-text");
        const progBar = document.getElementById("quiz-progress-bar");
        if (progText) progText.textContent = `Q ${current} / ${total}`;
        if (progBar) progBar.style.width = `${((current - 1) / total) * 100}%`;
        saveResumeState();

        const liveCoins = document.getElementById("quiz-live-coins");
        if (liveCoins) liveCoins.textContent = `🪙 +${quizState.earnedCoins}`;

        const comboBadge = document.getElementById("quiz-combo-badge");
        if (comboBadge) {
          if (quizState.combo >= 2) {
            comboBadge.textContent = `🔥 ${quizState.combo} COMBO`;
            comboBadge.classList.remove("hidden");
          } else {
            comboBadge.classList.add("hidden");
          }
        }

        
        const wordIdEl = document.getElementById("quiz-word-id");
        const wordEl = document.getElementById("quiz-word");
        const wordStatsEl = document.getElementById("quiz-word-stats-badge");
        if (wordIdEl) wordIdEl.textContent = (currentSubject === "kobun" && typeof q.word.num === "number")
          ? `単語番号: #${q.word.num}`
          : `ID: #${q.word.id}`;
        if (wordEl) wordEl.textContent = q.word.word;
        applyWordIpa(document.getElementById("quiz-word-ipa"), q.word);

        // 例文・文脈テストでは単語と語義を隠し、例文の空欄を見せる
        // リスニングでは見出し語を隠し、音声だけで出題する
        const isContext = q.type === "word";
        const isListening = activeQuizStyle() === "listening";
        const isSpelling = activeQuizStyle() === "spelling";
        const wordRow = document.getElementById("quiz-word-row");
        const contextBox = document.getElementById("quiz-context-box");
        const listeningBox = document.getElementById("quiz-listening-box");
        const spellingBox = document.getElementById("quiz-spelling-box");
        if (wordRow) wordRow.classList.toggle("hidden", isContext || isListening || isSpelling);
        if (contextBox) contextBox.classList.toggle("hidden", !isContext);
        if (listeningBox) listeningBox.classList.toggle("hidden", !isListening);
        if (isListening) {
          const lLen = document.getElementById("quiz-listening-length");
          if (lLen) lLen.textContent = `${String(q.word.word || "").length}文字`;
        }
        if (spellingBox) spellingBox.classList.toggle("hidden", !isSpelling);
        if (isSpelling) {
          const meaningEl = document.getElementById("quiz-spelling-meaning");
          if (meaningEl) meaningEl.textContent = q.word.meaning || "";
          applyPosBadge(document.getElementById("quiz-spelling-pos"), q.word);
          const input = document.getElementById("quiz-spelling-input");
          if (input) {
            input.value = "";
            input.disabled = false;
            input.className = "flex-1 min-w-0 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-300";
          }
          const submitBtn = document.getElementById("quiz-spelling-submit");
          if (submitBtn) submitBtn.disabled = false;
          // 入力欄に自動フォーカスして、毎問の「入力欄タップ」を省く
          // （rAF はタブが非表示だと発火しないので使わない）
          if (typeof focusSpellingInput === "function") {
            focusSpellingInput();
            setTimeout(focusSpellingInput, 60);
          }
          const sLen = document.getElementById("quiz-spelling-length");
          if (sLen) sLen.textContent = `${String(q.word.word || "").length}文字`;
        }
        if (isContext) {
          const sentenceEl = document.getElementById("quiz-context-sentence");
          if (sentenceEl) sentenceEl.textContent = q.sentence;
          // 日本語訳は出題時からセットで表示する（訳がないと解けないため）
          const jaEl = document.getElementById("quiz-context-ja");
          if (jaEl) {
            if (q.sentenceJa) {
              jaEl.innerHTML = currentSubject === "kobun" ? kobunJaHtml(q) : contextJaHtml(q.word, q.sentenceJa, q.sentenceJaMark);
              jaEl.classList.remove("hidden");
            } else {
              jaEl.textContent = "";
              jaEl.classList.add("hidden");
            }
          }
          const promptEl = document.getElementById("quiz-context-prompt");
          if (promptEl) {
            promptEl.textContent = currentSubject === "kobun"
              ? (String(q.sentence || "").includes("[ ____ ]") ? "空欄に入る古語を選べ" : "この現代語訳にあてはまる古語を選べ")
              : "空欄に最もふさわしい語を選べ";
            promptEl.classList.remove("hidden");
          }
        }
        const feedbackEl = document.getElementById("quiz-answer-feedback");
        if (feedbackEl) {
          feedbackEl.classList.add("hidden");
          feedbackEl.textContent = "";
        }
        quizState.waitingNext = false;
        const nextBtn = document.getElementById("quiz-next-btn");
        if (nextBtn) nextBtn.classList.add("hidden");
        // 品詞記号バッジ（データがある単語のみ表示）
        applyPosBadge(document.getElementById("quiz-word-pos"), q.word);
        applyPosBadge(document.getElementById("quiz-context-pos"), q.word);
        updateTimerUi();

        if (wordStatsEl) {
          const st = (userData.wordStats || {})[q.word.id];
          if (st && st.total > 0) {
            const pct = Math.round((st.correct / st.total) * 100);
            wordStatsEl.textContent = `正率 ${pct}% (${st.correct}/${st.total})`;
            wordStatsEl.className = pct >= 80
              ? "text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
              : pct >= 50
                ? "text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"
                : "text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200";
          } else {
            wordStatsEl.textContent = "初出題";
            wordStatsEl.className = "text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full";
          }
        }


        // スペル入力では選択肢を使わない（マスクも不要）
        if (isSpelling) {
          const optionsWrap = document.getElementById("quiz-options-container");
          if (optionsWrap) optionsWrap.innerHTML = "";
          quizState.isMasked = false;
          startQuestionClock();
          updateTimerUi();
          return;
        }

        const container = document.getElementById("quiz-options-container");
        if (!container) return;

        // リスニングは音声そのものが問題文なので、選択肢のマスク前（出題直後）に再生する
        if (isListening) setTimeout(() => { try { speakListeningWord(); } catch (e) {} }, 60);

        // ブレイン・ファースト: 1〜1.2秒は選択肢を隠して自力想起を促す
        quizState.isMasked = true;
        renderOptionMask();
        brainFirstTimer = setTimeout(() => {
          brainFirstTimer = null;
          quizState.isMasked = false;
          if (quizState.isAnswered) return;
          renderOptions(q);
          startQuestionClock();
          updateTimerUi();
          if (isContext) {
            // 例文クイズも通常クイズと同じタイミングで自動読み上げ（設定ON時のみ）
            if (userData.voiceEnabled) setTimeout(() => { try { speakQuizExample(); } catch (e) {} }, 60);
          } else if (!isListening) {
            setTimeout(() => { try { speakWord(); } catch (e) {} }, 30);
          }
        }, brainFirstDelayMs());
      } catch (err) {
        console.error("renderQuestion error:", err);
        quizState.isAnswered = false;
      }
    }

    // 不正解時の記録（学習履歴・忘却曲線・ミス一覧）
    function registerWrongAnswer(q) {
      if (!q || !q.word) return;
      quizState.combo = 0;
      if (!quizState.mistakes.some(m => m.id === q.word.id)) quizState.mistakes.push(q.word);

      if (!userData.wordStats) userData.wordStats = {};
      if (!userData.wordStats[q.word.id]) userData.wordStats[q.word.id] = { correct: 0, total: 0 };
      userData.wordStats[q.word.id].total++;

      // 忘却曲線システム: 不正解時はステージ1（翌日復習）に登録/リセット
      if (!userData.weakWords) userData.weakWords = {};
      const today = getTodayString();
      const nextDate = addDaysToDate(today, 1);
      // どのモードで間違えたかを残す（直近の誤答元）
      const weakSource = mockExamRunning ? "mock"
        : examRunning ? "exam"
          : isWeakMode ? "review"
            : isDailyMode ? "daily"
              : "quiz";
      const existing = userData.weakWords[q.word.id];
      if (!existing) {
        userData.weakWords[q.word.id] = {
          id: q.word.id,
          word: q.word.word,
          meaning: q.word.meaning,
          count: 1,
          stage: 1,
          nextReview: nextDate,
          lastReviewed: today,
          source: weakSource
        };
      } else {
        existing.count = (existing.count || 1) + 1;
        existing.stage = 1;
        existing.nextReview = nextDate;
        existing.lastReviewed = today;
        existing.source = weakSource;
      }
      // 一度克服（苦手リストから卒業）した単語を間違えたら、克服記録を取り消す
      if (userData.graduatedWords) delete userData.graduatedWords[q.word.id];
      saveUserData();
    }

    // 解答直後の誤タップだけを防ぐ最小ガード。以前の 350ms 待ちは「次へ」表示が遅く感じるため短縮した。
    const NEXT_TAP_GUARD_MS = 120;

    function handleAnswer(selectedOption, clickedBtn) {
      if (quizState.isAnswered) return;
      quizState.isAnswered = true;
      quizState.answeredCount = (quizState.answeredCount || 0) + 1;

      // 回答中は全ボタンのクリックを即時無効化（誤連打・多重実行を完全防止）
      const allOptionBtns = document.getElementById("quiz-options-container")?.querySelectorAll("button") || [];
      allOptionBtns.forEach(b => {
        b.style.pointerEvents = "none";
      });

      const q = quizState.questions[quizState.currentIndex];
      // 全国一斉模試: 提出用に問題ごとの正誤を記録する
      if (mockExamRunning) {
        quizState.answerLog = quizState.answerLog || {};
        quizState.answerLog[quizState.currentIndex] = !!selectedOption.isCorrect;
        quizState.answerTimes = quizState.answerTimes || {};
        quizState.answerTimes[quizState.currentIndex] = Math.max(0, Math.round((Date.now() - (quizState.questionShownAt || Date.now())) / 1000));
      }
      const container = document.getElementById("quiz-options-container");
      const buttons = container ? container.querySelectorAll("button") : [];

      // 学習カレンダー用に日別の解答数を記録
      bumpDailyLog();
      if (typeof playAnswerFeedback === "function") playAnswerFeedback(!!selectedOption.isCorrect);

      // 単語ごとの学習履歴データ (userData.wordStats) を蓄積
      if (!userData.wordStats) userData.wordStats = {};
      if (!userData.wordStats[q.word.id]) {
        userData.wordStats[q.word.id] = { correct: 0, total: 0 };
      }

      if (selectedOption.isCorrect) {
        userData.wordStats[q.word.id].total++;
        userData.wordStats[q.word.id].correct++;
        quizState.correctCount++;
        quizState.combo++;
        if (quizState.combo > quizState.maxCombo) quizState.maxCombo = quizState.combo;

        let coinBonus = 10;
        if (quizState.combo >= 10) coinBonus += 10;
        else if (quizState.combo >= 5) coinBonus += 5;
        else if (quizState.combo >= 3) coinBonus += 2;

        quizState.earnedCoins += coinBonus;
        quizState.earnedExp += EXP_PER_CORRECT;
        quizState.score += quizGameMode === "normal" ? (100 / quizState.questions.length) : 10;

        // 60秒スプリント: 5コンボごとに +3秒
        if (quizGameMode === "sprint" && quizState.combo > 0 && quizState.combo % 5 === 0) {
          quizState.timeLeftMs = (quizState.timeLeftMs || 0) + SPRINT_BONUS_MS;
          updateTimerUi();
          showToast("⏱ コンボボーナス +3秒！");
        }

        // 1問ごとにコインとEXPを即時保存（途中で閉じても失われない）
        userData.coins += coinBonus;
        userData.exp = (userData.exp || 0) + EXP_PER_CORRECT;
        userData.level = getLevelState(userData.exp).level;

        // Feverアニメーション
        const comboBadge = document.getElementById("quiz-combo-badge");
        const quizSection = document.getElementById("screen-quiz");
        if (comboBadge) {
          comboBadge.classList.remove("combo-pop-anim");
          void comboBadge.offsetWidth; // reflow
          comboBadge.classList.add("combo-pop-anim");
          setTimeout(() => comboBadge.classList.remove("combo-pop-anim"), 400);
        }
        if (quizState.combo === 10 && quizSection) {
          quizSection.classList.remove("fever-5-active","fever-10-active");
          void quizSection.offsetWidth;
          quizSection.classList.add("fever-10-active");
          setTimeout(() => quizSection.classList.remove("fever-10-active"), 800);
          showToast("🔥🔥 10 COMBO FEVER!! 🔥🔥");
        } else if (quizState.combo === 5 && quizSection) {
          quizSection.classList.remove("fever-5-active","fever-10-active");
          void quizSection.offsetWidth;
          quizSection.classList.add("fever-5-active");
          setTimeout(() => quizSection.classList.remove("fever-5-active"), 800);
          showToast("🔥 5 COMBO! 熱い！");
        }

        // 実績チェック
        checkAchievements();

        // 忘却曲線復習システム: 正解時はステージアップ（ステージ4クリアで克服卒業）
        if (isWeakMode && userData.weakWords && userData.weakWords[q.word.id]) {
          const item = userData.weakWords[q.word.id];
          const currStage = item.stage || 1;
          const today = getTodayString();
          item.lastReviewed = today;

          if (currStage >= 4) {
            // ステージ4完了 = 完全に定着したため克服マスターとしてリストから卒業！
            // 卒業した事実を残しておかないと、クラウド統合で他端末の古いデータから復活してしまう
            delete userData.weakWords[q.word.id];
            if (!userData.graduatedWords) userData.graduatedWords = {};
            userData.graduatedWords[q.word.id] = today;
          } else {
            // 次のステージへ進め、忘却曲線に応じた次回期日を設定
            item.stage = currStage + 1;
            const daysToAdd = FORGETTING_STAGES[item.stage] ? FORGETTING_STAGES[item.stage].days : 7;
            item.nextReview = addDaysToDate(today, daysToAdd);
          }
        }
        saveUserData();

        clickedBtn.classList.remove("bg-white", "hover:bg-slate-50", "border-slate-200");
        clickedBtn.classList.add("bg-emerald-50", "border-emerald-500", "text-emerald-900");
      } else {
        registerWrongAnswer(q);

        if (quizGameMode === "sprint") {
          quizState.timeLeftMs = Math.max(0, (quizState.timeLeftMs || 0) - SPRINT_PENALTY_MS);
          updateTimerUi();
          showToast("⏱ 誤答ペナルティ -2秒");
          if (quizState.timeLeftMs <= 0) quizState.endReason = "timeup";
        }
        if (quizGameMode === "sudden") quizState.endReason = "sudden";
      }

      // 全選択肢ボタンの正誤判定スタイル適用 ＆ 不正解選択肢も含めた日本語訳の表示
      buttons.forEach((btn, idx) => {
        const opt = q.options[idx];
        if (!opt) return;
        const isCorrect = opt.isCorrect;
        const isChosen = opt === selectedOption;

        btn.classList.remove("bg-white", "hover:bg-slate-50", "border-slate-200");
        if (isCorrect) {
          btn.classList.add("bg-emerald-50", "border-emerald-500", "text-emerald-900");
        } else if (isChosen) {
          btn.classList.add("bg-rose-50", "border-rose-400", "text-rose-900");
        } else {
          btn.classList.add("bg-slate-50/70", "border-slate-200", "text-slate-600", "opacity-85");
        }

        const badgeClass = isCorrect ? "bg-emerald-200 text-emerald-800" : (isChosen ? "bg-rose-200 text-rose-800" : "bg-slate-200 text-slate-600");
        const numBadge = `<span class="w-6 h-6 rounded-md ${badgeClass} text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200 pointer-events-none">${idx + 1}</span>`;

        if (q.type === "word") {
          // 例文クイズ（選択肢が英単語）：全選択肢にそれぞれの日本語訳を表示
          // 古文の例文クイズでは選択肢の古語に語義を添える（学習の手がかり）
          const isKobun = currentSubject === "kobun";
          const subText = isKobun
            ? formatKobunMeaning((opt.word && opt.word.meaning) || "")
            : ((opt.word && opt.word.meaning) || "");
          const showSub = !!subText;
          btn.innerHTML = `${numBadge}<div class="min-w-0 flex-1 pointer-events-none text-left"><div class="text-sm font-bold leading-snug">${escapeHtml(opt.text)}</div>${showSub ? `<div class="text-xs text-slate-600 mt-1 font-medium bg-white/70 rounded px-1.5 py-0.5 inline-block border border-slate-200/60">${escapeHtml(subText)}</div>` : ""}`;
        } else {
          // 通常クイズ（選択肢が日本語訳）：全選択肢に対応する英単語を表示
          const enWord = (opt.word && opt.word.word) || "";
                      const wordLabel = currentSubject === "kobun" ? "古語" : "英";
            btn.innerHTML = `${numBadge}<div class="min-w-0 flex-1 pointer-events-none text-left"><div class="text-sm font-bold leading-snug">${escapeHtml(opt.text)}</div>${enWord ? `<div class="text-xs text-slate-500 mt-1 font-medium bg-white/70 rounded px-1.5 py-0.5 inline-block border border-slate-200/60">${wordLabel}: ${escapeHtml(enWord)}</div>` : ""}`;
        }
        if (isCorrect) {
          btn.innerHTML += `<span class="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">✓ 正解</span>`;
        }
        btn.innerHTML += `</div>`;
      });

      if (q.type === "word") {
        revealContextAnswer(q);
        // 例文クイズでは答えの単語も自動で読み上げる
        if (userData.voiceEnabled) {
          setTimeout(() => { try { speakEnglish(q.word.word); } catch (e) {} }, 260);
        }
      }
      if (activeQuizStyle() === "listening") revealListeningAnswer(q);
      showAnswerFeedback(q);

      const liveCoins = document.getElementById("quiz-live-coins");
      if (liveCoins) liveCoins.textContent = `🪙 +${quizState.earnedCoins}`;

      // 「タップして次へ」は解答直後に即表示する（待たせない）。
      // 誤爆防止は proceedToNextQuestion / 画面タップ側の短いガード（NEXT_TAP_GUARD_MS）で行う。
      quizState.waitingNext = true;
      quizState.answeredAt = Date.now();
      const nextBtn = document.getElementById("quiz-next-btn");
      if (nextBtn) nextBtn.classList.remove("hidden");
      buttons.forEach(btn => {
        btn.style.pointerEvents = "auto";
        btn.onclick = (e) => {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          proceedToNextQuestion(e);
        };
      });
    }

    function proceedToNextQuestion(e) {
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      if (!quizState.waitingNext) return;
      if (Date.now() - (quizState.answeredAt || 0) < NEXT_TAP_GUARD_MS) return;
      quizState.waitingNext = false;
      const nextBtn = document.getElementById("quiz-next-btn");
      if (nextBtn) nextBtn.classList.add("hidden");

      if (quizState.endReason) {
        finishQuiz(false, quizState.endReason);
        return;
      }
      quizState.currentIndex++;
      if (quizState.currentIndex < quizState.questions.length) {
        renderQuestion();
      } else {
        finishQuiz(false);
      }
    }

    window.addEventListener("keydown", (e) => {
      const quizScreen = document.getElementById("screen-quiz");
      if (!quizScreen || quizScreen.classList.contains("hidden")) return;
      if (quizState.waitingNext) {
        proceedToNextQuestion(e);
        return;
      }
      if (quizState.isAnswered || quizState.isMasked) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        const buttons = document.getElementById("quiz-options-container").querySelectorAll("button");
        const idx = parseInt(e.key) - 1;
        if (buttons[idx]) buttons[idx].click();
      }
    });

    // クイズ中断時：正解した分のコインを保存して結果を確定
    // 中断確認ダイアログ用: その時点の成績
    function quizProgressSummary() {
      const total = quizState.questions ? quizState.questions.length : 0;
      const answered = Math.max(0, Math.min(quizState.currentIndex || 0, total));
      const correct = quizState.correctCount || 0;
      const coins = quizState.earnedCoins || 0;
      const score = Math.round(quizState.score || 0);
      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { total, answered, correct, coins, score, accuracy };
    }

    function quizInterruptMessage() {
      const st = quizProgressSummary();
      return `ここまで ${st.answered} / ${st.total} 問に回答` +
        `
正解 ${st.correct} 問（正答率 ${st.accuracy}%）` +
        `
獲得 🪙 ${st.coins} Coin ／ スコア ${st.score} pt` +
        `

中断すると結果画面へ移動します（獲得済みのコインは保存されます）。`;
    }

    async function abortQuiz() {
      if (quizState.currentIndex === 0) {
        navigate("screen-home");
        return;
      }
      const ok = await showConfirm({
        title: "クイズを中断しますか？",
        message: quizInterruptMessage(),
        okText: "中断する",
        cancelText: "続ける",
        icon: "🏳️"
      });
      if (ok) {
        checkAchievements();
        finishQuiz(true);
      }
    }

    function finishQuiz(isAborted, endReason) {
      stopQuizTimers();
      clearResumeStateIfCurrent();
      quizState.isAborted = !!isAborted;
      quizState.endReason = endReason || quizState.endReason || "";
      const reason = quizState.endReason;
      const endedEarly = !!isAborted || reason === "timeup" || reason === "sudden" || reason === "examtime";
      const answeredSoFar = Math.max(quizState.answeredCount || 0, 0);
      const totalQ = endedEarly ? answeredSoFar : quizState.questions.length;
      const accuracy = totalQ > 0 ? Math.round((quizState.correctCount / totalQ) * 100) : 0;
      const finalScore = Math.round(quizState.score);

      // 全国一斉模試: ローカル履歴ではなく全国集計へ提出し、成績表画面へ戻す
      if (mockExamRunning) {
        const mockExam = mockExamCurrent;
        const mockScore = quizState.correctCount || 0;
        const mockQuestions = quizState.questions || [];
        const mockAnswers = mockQuestions.map((q, i) => ({
          id: q.word ? q.word.id : null,
          correct: !!(quizState.answerLog && quizState.answerLog[i]),
          sec: Math.max(0, Number(quizState.answerTimes && quizState.answerTimes[i]) || 0)
        }));
        const mockElapsed = Math.max(0, Math.round((Date.now() - (mockExamStartedAt || Date.now())) / 1000));
        const mockLate = mockExam ? (Date.now() > Date.parse(mockExam.end_at)) : false;
        mockLastMistakes = (quizState.mistakes || []).slice();
        mockExamRunning = false;
        examRunning = false;
        if (!isAborted && mockExam && mockQuestions.length > 0) {
          submitMockExamResult(mockExam, mockScore, mockQuestions.length, mockElapsed, mockAnswers, mockLate);
        } else if (isAborted) {
          mockSubmitNote = "中断したため、模試の記録は提出していません。";
        }
        saveUserData();
        checkAchievements();
        navigate(MOCK_SCREEN_ID);
        return;
      }

      // 到達度テスト: 判定と履歴保存（中断時は記録しない）
      let examSummary = null;
      if (examRunning && !isAborted && totalQ > 0) {
        const grade = examGradeFor(accuracy);
        const rangeName = examRangeLabel();
        const history = Array.isArray(userData.examHistory) ? userData.examHistory : [];
        const prevSame = history.find(h => h && (h.subject || "leap") === currentSubject && h.range === rangeName) || null;
        const seconds = Math.max(0, Math.min(Math.round((Date.now() - (examStartedAt || Date.now())) / 1000), Math.round(examSessionTotalMs / 1000)));
        userData.examHistory = [{
          id: `exam-${Date.now()}`,
          date: getTodayString(),
          subject: currentSubject,
          range: rangeName,
          correct: quizState.correctCount,
          total: totalQ,
          accuracy: accuracy,
          grade: grade.grade,
          seconds: seconds
        }, ...history].slice(0, 20);
        examSummary = { grade: grade, rangeName: rangeName, prevSame: prevSame, seconds: seconds };
      }

      // デイリーチャレンジ: コイン2倍（獲得済みの同額を追加付与）
      let isDailyBonus = false;
      if (isDailyMode && !isAborted) {
        const today = getTodayString();
        if (userData.lastDailyDate !== today) {
          userData.lastDailyDate = today;
          userData.coins += quizState.earnedCoins;
          quizState.earnedCoins = quizState.earnedCoins * 2;
          isDailyBonus = true;
        }
      }

      // EXPとコインは1問ごとに保存済み。ここではレベルアップ判定のみ行う
      const gainedExp = quizState.earnedExp || 0;
      const levelBefore = quizState.startLevel || getLevelState(userData.exp).level;
      const levelAfter = getLevelState(userData.exp).level;
      const leveledUp = levelAfter > levelBefore;
      userData.level = levelAfter;

      // スコア履歴に追加（最大5件）
      if (!isAborted && totalQ > 0) {
        userData.totalQuizzes = (userData.totalQuizzes || 0) + 1;
        userData.maxComboEver = Math.max(userData.maxComboEver || 0, quizState.maxCombo || 0);
        if (!userData.scoreHistory) userData.scoreHistory = [];
        userData.scoreHistory.unshift({
          score: finalScore,
          correct: quizState.correctCount,
          total: totalQ,
          accuracy: accuracy,
          combo: quizState.maxCombo,
          coins: quizState.earnedCoins,
          range: examRunning
            ? `${examRangeLabel()} ・ 🎓到達度テスト`
            : selectedRange.label
              + (quizGameMode === "normal" ? "" : ` ・ ${GAME_MODES[quizGameMode].icon}${GAME_MODES[quizGameMode].label}`)
              + (quizState.style === "listening" ? " ・ 🎧音声" : quizState.style === "spelling" ? " ・ 🔤スペル" : "")
              + (quizState.questions[0] && quizState.questions[0].type === "word" ? " ・ 📝例文" : ""),
          date: getTodayString(),
          isDaily: isDailyBonus
        });
        if (userData.scoreHistory.length > 5) userData.scoreHistory = userData.scoreHistory.slice(0, 5);
      }

      if (!isAborted) {
        recordPlayDay();
        if (isDailyBonus) userData.dailyClears = (userData.dailyClears || 0) + 1;
        if (isWeakMode) userData.reviewClears = (userData.reviewClears || 0) + 1;
      }

      saveUserData();
      checkAchievements();
      cloudPushSoon("quiz");

      const rHead = document.getElementById("result-header-label");
      const rTitle = document.getElementById("result-title-name");
      const chBadge = document.getElementById("result-challenge-badge");
      const dailyBadgeEl = document.getElementById("result-daily-badge");
      const historyCompare = document.getElementById("result-history-compare");
      const ecBox = document.getElementById("result-earned-coins").parentElement;
      const actBtns = document.getElementById("result-action-buttons");
      const chActs = document.getElementById("result-challenge-action");

      if (rHead) {
        if (isAborted) rHead.textContent = "QUIZ ABORTED (中断結果)";
        else if (examRunning) rHead.textContent = "🎓 到達度テスト RESULT";
        else if (reason === "timeup") rHead.textContent = "⏱ TIME ATTACK RESULT";
        else if (reason === "sudden") rHead.textContent = "💀 SUDDEN DEATH RESULT";
        else if (quizState.style === "spelling") rHead.textContent = "🔤 SPELLING RESULT";
        else if (quizState.style === "listening") rHead.textContent = "🎧 LISTENING RESULT";
        else if (quizState.questions[0] && quizState.questions[0].type === "word") rHead.textContent = "📝 CONTEXT TEST RESULT";
        else rHead.textContent = "QUIZ RESULT";
      }
      if (rTitle) rTitle.textContent = getFullTitle();
      if (chBadge) chBadge.classList.add("hidden");
      if (ecBox) ecBox.classList.remove("hidden");
      if (actBtns) actBtns.classList.remove("hidden");
      if (chActs) chActs.classList.add("hidden");

      // デイリーバッジ表示
      if (dailyBadgeEl) {
        if (isDailyBonus) dailyBadgeEl.classList.remove("hidden");
        else dailyBadgeEl.classList.add("hidden");
      }

      // 到達度テストの判定バナー
      const examBanner = document.getElementById("result-exam-banner");
      if (examBanner) {
        if (examSummary) {
          const gradeEl = document.getElementById("result-exam-grade");
          if (gradeEl) {
            gradeEl.textContent = examSummary.grade.grade;
            gradeEl.className = `border rounded-lg px-2 py-0.5 text-base font-extrabold ${examSummary.grade.cls}`;
          }
          const rangeEl = document.getElementById("result-exam-range");
          if (rangeEl) rangeEl.textContent = `${examSummary.rangeName} ・ ${examSummary.grade.label}`;
          const compareEl = document.getElementById("result-exam-compare");
          if (compareEl) {
            const prev = examSummary.prevSame;
            if (!prev) {
              compareEl.textContent = `初回受験 ・ 所要 ${Math.max(1, Math.round(examSummary.seconds / 60))}分`;
            } else {
              const diff = accuracy - (Number(prev.accuracy) || 0);
              compareEl.textContent = diff > 0
                ? `前回比 +${diff}%（前回 ${prev.grade || "-"}）`
                : diff < 0
                  ? `前回比 ${diff}%（前回 ${prev.grade || "-"}）`
                  : `前回と同じ正答率（前回 ${prev.grade || "-"}）`;
            }
          }
          examBanner.classList.remove("hidden");
        } else {
          examBanner.classList.add("hidden");
        }
      }

      // スコア履歴との比較表示
      if (historyCompare) {
        const history = userData.scoreHistory || [];
        const prevBest = history.length >= 2 ? history.slice(1).reduce((mx, h) => Math.max(mx, h.accuracy), 0) : null;
        if (prevBest !== null && !isAborted) {
          const diff = accuracy - prevBest;
          if (diff > 0) {
            historyCompare.textContent = `📈 前回比 +${diff}% 改善！`;
            historyCompare.className = "text-xs font-semibold text-emerald-600 mt-1";
          } else if (diff < 0) {
            historyCompare.textContent = `📉 前回比 ${diff}%`;
            historyCompare.className = "text-xs font-semibold text-slate-400 mt-1";
          } else {
            historyCompare.textContent = "前回と同スコア！";
            historyCompare.className = "text-xs font-semibold text-slate-400 mt-1";
          }
          historyCompare.classList.remove("hidden");
        } else {
          historyCompare.classList.add("hidden");
        }
      }

      document.getElementById("result-score").innerHTML = `${quizState.correctCount}/${totalQ}<span class="text-xs font-normal text-slate-500">問</span>`;
      document.getElementById("result-accuracy").innerHTML = `${accuracy}<span class="text-xs font-normal text-slate-500">%</span>`;
      document.getElementById("result-combo").innerHTML = `${quizState.maxCombo}<span class="text-xs font-normal text-slate-500">回</span>`;
      document.getElementById("result-earned-coins").textContent = isDailyBonus
        ? `+${quizState.earnedCoins} Coin 獲得！(2倍ボーナス🌟)`
        : `+${quizState.earnedCoins} Coin 獲得！`;
      const rStreak = document.getElementById("result-streak");
      if (rStreak) {
        if (!isAborted && (userData.streak || 0) > 0) {
          rStreak.textContent = `🔥 連続学習 ${userData.streak}日！`;
          rStreak.classList.remove("hidden");
        } else {
          rStreak.classList.add("hidden");
        }
      }

      // レベル・称号・アバター・EXPの反映
      const rLevel = document.getElementById("result-player-level");
      const rPlayerTitle = document.getElementById("result-player-title");
      const rExp = document.getElementById("result-exp-earned");
      const rLevelUp = document.getElementById("result-levelup");
      if (rLevel) rLevel.textContent = `Lv.${userData.level}`;
      if (rPlayerTitle) rPlayerTitle.textContent = getFullTitle();
      if (rExp) rExp.textContent = `+${gainedExp} EXP`;
      applyFrameStyle(document.getElementById("result-avatar"), userData.equippedFrame, "w-12 h-12 text-2xl");
      if (rLevelUp) {
        if (leveledUp) {
          rLevelUp.textContent = `🎉 Lv.${levelBefore} → Lv.${levelAfter} にレベルアップ！`;
          rLevelUp.classList.remove("hidden");
        } else {
          rLevelUp.classList.add("hidden");
        }
      }
      if (leveledUp) showToast(`🎉 Lv.${levelAfter} にレベルアップ！`);

      // 「間違えた単語だけ復習」ボタンの表示通制
      const reviewWrap = document.getElementById("result-review-mistakes");
      const reviewCount = document.getElementById("result-review-count");
      const mistakeCount = (quizState.mistakes || []).length;
      if (reviewWrap) reviewWrap.classList.toggle("hidden", mistakeCount === 0);
      if (reviewCount) reviewCount.textContent = String(mistakeCount);

      // 間違えた単語リスト（復習用）
      const mistakeSection = document.getElementById("result-mistakes-section");
      const mistakeList = document.getElementById("result-mistakes-list");
      if (mistakeList) mistakeList.innerHTML = "";

      if (quizState.mistakes.length > 0) {
        if (mistakeSection) mistakeSection.classList.remove("hidden");
        quizState.mistakes.forEach(w => {
          const item = document.createElement("div");
          item.className = "flex items-start justify-between gap-3 py-2 border-b border-slate-200/60 last:border-0";
          item.innerHTML = `
            <div class="shrink-0 max-w-[45%] min-w-0">
              <span class="font-bold text-slate-800 break-words">${w.word}</span>
              <span class="text-slate-400 text-[10px] ml-1 whitespace-nowrap">#${w.id}</span>
            </div>
            <div class="text-slate-600 font-medium text-right leading-relaxed break-words min-w-0">${w.meaning}</div>
          `;
          if (mistakeList) mistakeList.appendChild(item);
        });
      } else {
        if (mistakeSection) mistakeSection.classList.add("hidden");
      }

      if (isAborted) {
        showToast(`中断しました。🪙 ${quizState.earnedCoins} Coin を獲得しました！`);
      }

      navigate("screen-result");
    }

    // ===== 中断したクイズの再開（LEAP_QUIZ_RESUME_V1） =====
    // 保存形式・妥当性・上書き可否は js/quiz-resume.js（LeapQuizResume）に集約し、テスト可能にしている。
    let resumeRestoring = false;

    function canSaveResume() {
      return !mockExamRunning && !examRunning && quizGameMode === "normal" && quizState.questions.length > 0;
    }

    function currentQuizWordIds() {
      return quizState.questions
        .map(q => (q.word && typeof q.word.id === "number") ? q.word.id : null)
        .filter(id => id !== null);
    }

    function saveResumeState() {
      if (resumeRestoring || !canSaveResume()) return;
      // 1問目の表示だけでは保存しない（別のクイズの「つづき」を黙って潰さないため）
      if (!LeapQuizResume.canOverwrite(quizState.currentIndex)) return;
      const ids = currentQuizWordIds();
      if (ids.length < 2) return;
      const payload = LeapQuizResume.buildPayload({
        subject: currentSubject,
        ids: ids,
        index: quizState.currentIndex,
        style: quizState.style,
        label: selectedRange.label,
        correctCount: quizState.correctCount,
        combo: quizState.combo,
        maxCombo: quizState.maxCombo,
        earnedCoins: quizState.earnedCoins,
        earnedExp: quizState.earnedExp,
        score: quizState.score,
        mistakeIds: (quizState.mistakes || []).map(w => w.id),
        isDaily: !!isDailyMode,
        isWeak: !!isWeakMode
      });
      LeapQuizResume.write(window.localStorage, payload);
    }

    // ホームのバナー用（現在のゾーンで有効なものだけ）
    function peekResumeState() { return loadResumeState(); }

    function loadResumeState() {
      const st = LeapQuizResume.read(window.localStorage);
      return LeapQuizResume.isResumable(st, currentSubject) ? st : null;
    }

    function clearResumeState() {
      LeapQuizResume.clear(window.localStorage);
    }

    // いま終えた（中断した）クイズの保存だけを消す。別クイズの「つづき」は残す。
    function clearResumeStateIfCurrent() {
      const st = LeapQuizResume.read(window.localStorage);
      if (!st) return;
      if (!LeapQuizResume.matchesQuiz(st, currentSubject, currentQuizWordIds())) return;
      clearResumeState();
    }

    function discardResumeQuiz() {
      clearResumeState();
      if (typeof renderHomeResumeBanner === "function") renderHomeResumeBanner();
      showToast("前回の続きを破棄しました");
    }

    function resumeQuiz() {
      const st = loadResumeState();
      if (!st) { showToast("再開できるクイズがありません"); return; }
      const byId = new Map(ALL_WORDS.map(w => [w.id, w]));
      const pool = st.ids.map(id => byId.get(Number(id))).filter(Boolean);
      if (pool.length < 2) { clearResumeState(); return; }
      resumeRestoring = true;
      isDailyMode = !!st.isDaily;
      isWeakMode = !!st.isWeak;
      questionLimit = pool.length;
      quizStyle = QUIZ_STYLES.includes(st.style) ? st.style : "normal";
      if (typeof syncModeUi === "function") syncModeUi();
      startQuizWithPool(pool, { questionCount: pool.length, resume: true });
      // 保存時の並び・進捗に戻す
      const ordered = st.ids.map(id => quizState.questions.find(q => q.word && q.word.id === Number(id))).filter(Boolean);
      if (ordered.length) quizState.questions = ordered;
      quizState.currentIndex = Math.min(Math.max(0, Number(st.index) || 0), quizState.questions.length - 1);
      quizState.correctCount = Number(st.correctCount) || 0;
      quizState.combo = Number(st.combo) || 0;
      quizState.maxCombo = Number(st.maxCombo) || 0;
      quizState.earnedCoins = Number(st.earnedCoins) || 0;
      quizState.earnedExp = Number(st.earnedExp) || 0;
      quizState.score = Number(st.score) || 0;
      quizState.mistakes = (st.mistakeIds || []).map(id => byId.get(Number(id))).filter(Boolean);
      quizState.startLevel = getLevelState(userData.exp).level;
      if (st.label) selectedRange = { start: selectedRange.start, end: selectedRange.end, label: st.label };
      resumeRestoring = false;
      renderQuestion();
      showToast("前回の続きから再開しました");
    }

    // 結果画面の「間違えた単語だけ復習」
    function reviewResultMistakes() {
      const pool = (quizState.mistakes || []).slice();
      if (!pool.length) { showToast("復習する単語がありません"); return; }
      isDailyMode = false;
      isWeakMode = false;
      quizGameMode = "normal";
      questionLimit = Math.min(20, pool.length);
      selectedRange = { start: selectedRange.start, end: selectedRange.end, label: "間違い直し" };
      startQuizWithPool(pool, { questionCount: questionLimit, forceNormalMode: true });
    }

    function retryCurrentQuiz() {
      if (examRunning) startExam();
      else if (isWeakMode) startWeakWordsQuiz();
      else startQuiz();
    }

    // ===== デイリーチャレンジ =====
    // 全収録範囲から出題しつつ、過去に間違えた単語（苦手単語）をメインにする
    async function startDailyChallenge() {
      const today = getTodayString();
      if (userData.lastDailyDate === today) {
        const again = await showConfirm({
          title: "本日のデイリーはクリア済み",
          message: "もう一度プレイしますか？（コイン2倍ボーナスはありません）",
          okText: "もう一度プレイ",
          cancelText: "やめておく",
          icon: "🌅",
          danger: false
        });
        if (!again) return;
        isDailyMode = false;
      } else {
        isDailyMode = true;
      }
      isWeakMode = false;
      questionLimit = 20;

      const range = getDataIdRange();
      const inRange = ALL_WORDS.filter(w => w.id >= range.start && w.id <= range.end);
      if (inRange.length === 0) {
        showAlert({ title: "単語データがありません", message: "単語データが読み込まれていません。", icon: "📥" });
        return;
      }
      selectedRange = { start: range.start, end: range.end, label: `デイリーチャレンジ (ID: ${range.start}〜${range.end})` };

      // 苦手単語は間違い回数が多いほど出やすくする
      const wordById = new Map(inRange.map(w => [w.id, w]));
      const weakEntries = Object.values(userData.weakWords || {})
        .filter(w => wordById.has(w.id))
        .sort((a, b) => (b.count || 0) - (a.count || 0));

      const total = Math.min(questionLimit, inRange.length);
      const weakQuota = weakEntries.length === 0 ? 0 : Math.min(weakEntries.length, Math.round(total * 0.7));

      const picked = [];
      const pickedIds = new Set();

      if (weakQuota > 0) {
        const weighted = [];
        weakEntries.forEach(w => {
          const repeats = Math.max(1, Math.min(w.count || 1, 5));
          for (let i = 0; i < repeats; i++) weighted.push(wordById.get(w.id));
        });
        shuffleArray(weighted).forEach(w => {
          if (picked.length >= weakQuota || pickedIds.has(w.id)) return;
          picked.push(w);
          pickedIds.add(w.id);
        });
      }

      // 残りの枠は苦手以外の単語から埋める（苦手70% / 新規30%のバランスを保つ）
      const weakIds = new Set(weakEntries.map(w => w.id));
      shuffleArray(inRange.filter(w => !weakIds.has(w.id))).forEach(w => {
        if (picked.length >= total) return;
        picked.push(w);
        pickedIds.add(w.id);
      });
      if (picked.length < total) {
        shuffleArray(inRange).forEach(w => {
          if (picked.length >= total || pickedIds.has(w.id)) return;
          picked.push(w);
          pickedIds.add(w.id);
        });
      }

      // デイリーチャレンジはサドンデス等の設定を引き継がない
      startQuizWithPool(picked, { forceNormalMode: true });
    }
