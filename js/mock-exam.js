/* provides: 全国一斉模試（開催スケジュール・志望校エントリー・受験・成績表・共有リンク・端末内保存）
   requires: core.js（currentSubject / LEAP_SOURCE / KOBUN_SOURCE / navigate / showToast / showAlert / showConfirm）
             mock_schools_data.js（MOCK_UNIV_GROUPS / MOCK_FACULTIES / MOCK_TIER_LABELS）
             クラウド側の supabaseClient / cloudState / userData / quizState / startQuizWithPool 等。
             いずれも呼び出し時の参照のみで、読み込み順には依存しない。
   note: index.html のインライン JS から Stage 1 として切り出し（コードは無改変）。 */
    // ============================================================
    // 🏫 全国一斉模試（日時指定の時間割制）
    // ============================================================
    const MOCK_SCREEN_ID = "screen-mock-exam";
    const MOCK_DRAFT_KEY = "LEAP_MOCK_CHOICES_V1";
    const MOCK_JUDGE_THRESHOLDS = { 1: [63, 57, 50], 2: [60, 54, 47], 3: [56, 50, 44], 4: [52, 46, 40] };
    let mockExamsCache = [];
    let mockExamsError = "";
    let mockExamsLoaded = false;
    let mockSelectedExamId = null;
    let mockEntryChoices = [];
    let mockReport = null;
    let mockReportError = "";
    let mockMyResult = null;
    let mockLocalReport = null;
    let mockSubmitNote = "";
    let mockCountdownTimer = null;
    let mockCountdownPhase = "";
    let mockExamRunning = false;
    let mockExamCurrent = null;
    let mockExamStartedAt = 0;
    let mockLastMistakes = [];
    let mockBusy = false;
    let mockSchoolFilter = { category: "", tier: "", query: "" };
    let mockScheduleNote = "";

    const MOCK_LOCAL_RESULTS_KEY = "LEAP_MOCK_LOCAL_RESULTS_V1";
    const MOCK_OFFLINE_EXAM_ID = "local-practice";

    // 全国集計に提出できる状態か（ログイン済み＋Supabase 設定済み）
    function mockIsReady() { return !!supabaseClient && !!(typeof cloudState !== "undefined" && cloudState && cloudState.user); }
    function mockCurrentExam() { return mockExamsCache.find(e => e.id === mockSelectedExamId) || null; }

    // 公開スケジュール RPC は受験時間外に question_ids を返さないため、問題数は question_count を使う
    function mockQuestionCount(exam) {
      const n = Number(exam && exam.question_count);
      if (Number.isFinite(n) && n > 0) return n;
      return Array.isArray(exam && exam.question_ids) ? exam.question_ids.length : 0;
    }

    // 未ログイン・オフライン時の受験結果（端末内保存）
    function mockLoadLocalResults() {
      try {
        const raw = JSON.parse(localStorage.getItem(MOCK_LOCAL_RESULTS_KEY) || "{}");
        return raw && typeof raw === "object" ? raw : {};
      } catch (e) { return {}; }
    }
    function mockLocalResult(examId) {
      const r = mockLoadLocalResults()[examId];
      return r && typeof r === "object" ? r : null;
    }
    function mockSaveLocalResult(examId, result) {
      try {
        const all = mockLoadLocalResults();
        all[examId] = result;
        localStorage.setItem(MOCK_LOCAL_RESULTS_KEY, JSON.stringify(all));
      } catch (e) {}
    }
    function mockClearLocalResult(examId) {
      try {
        const all = mockLoadLocalResults();
        if (!all[examId]) return;
        delete all[examId];
        localStorage.setItem(MOCK_LOCAL_RESULTS_KEY, JSON.stringify(all));
      } catch (e) {}
    }

    // ---- リマインド（開始24時間前から1日1回お知らせ） ----
    const MOCK_REMINDERS_KEY = "LEAP_MOCK_REMINDERS_V1";
    const MOCK_REMINDER_SEEN_KEY = "LEAP_MOCK_REMINDER_SEEN_V1";
    const MOCK_NOTES_KEY = "LEAP_MOCK_NOTES_V1";

    function mockLoadJsonObject(key) {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "{}");
        return raw && typeof raw === "object" ? raw : {};
      } catch (e) { return {}; }
    }
    function mockWriteJsonObject(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    function mockLoadReminders() { return mockLoadJsonObject(MOCK_REMINDERS_KEY); }
    function mockReminderFor(examId) {
      const r = mockLoadReminders()[examId];
      return r && typeof r === "object" ? r : null;
    }

    function toggleMockReminder(examId) {
      const exam = mockExamsCache.find(e => e.id === (examId || mockSelectedExamId));
      if (!exam) return;
      if (exam.offline) { showToast("練習模試はいつでも受けられるため、リマインドは不要です"); return; }
      const all = mockLoadReminders();
      if (all[exam.id]) {
        delete all[exam.id];
        mockWriteJsonObject(MOCK_REMINDERS_KEY, all);
        showToast("⏰ リマインドを解除しました");
      } else {
        all[exam.id] = {
          examId: exam.id, title: exam.title,
          start_at: exam.start_at, end_at: exam.end_at,
          created: new Date().toISOString()
        };
        mockWriteJsonObject(MOCK_REMINDERS_KEY, all);
        showToast("⏰ 開始24時間前からお知らせします");
      }
      renderMockExamScreen();
    }

    function mockTodayKey() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // 起動時に呼ぶ。開始24時間前〜終了までで、その日まだ知らせていない回をトーストで通知する
    function mockCheckReminders() {
      const all = mockLoadReminders();
      const ids = Object.keys(all);
      if (!ids.length) return;
      const seen = mockLoadJsonObject(MOCK_REMINDER_SEEN_KEY);
      const today = mockTodayKey();
      const due = [];
      let changed = false;
      ids.forEach(id => {
        const r = all[id];
        if (!r) { delete all[id]; changed = true; return; }
        const start = Date.parse(r.start_at);
        const end = Date.parse(r.end_at);
        // 終了して1日以上たった回は自動で片付ける
        if (Number.isFinite(end) && Date.now() > end + 86400000) { delete all[id]; changed = true; return; }
        if (!Number.isFinite(start)) return;
        const msToStart = start - Date.now();
        const open = Date.now() >= start && (!Number.isFinite(end) || Date.now() <= end);
        if (((msToStart > 0 && msToStart <= 86400000) || open) && seen[id] !== today) due.push(r);
      });
      if (changed) mockWriteJsonObject(MOCK_REMINDERS_KEY, all);
      if (!due.length) return;
      due.forEach(r => { seen[r.examId] = today; });
      mockWriteJsonObject(MOCK_REMINDER_SEEN_KEY, seen);
      const first = due[0];
      const start = Date.parse(first.start_at);
      const label = Date.now() >= start ? "受験受付中です" : `開始まで ${mockFormatCountdown(start - Date.now())}`;
      const extra = due.length > 1 ? `（ほか ${due.length - 1}件）` : "";
      showToast(`⏰ リマインド: 「${first.title}」${label}${extra}`);
    }

    // ---- 振り返りメモ（模試ごとに端末保存） ----
    function mockNoteFor(examId) {
      const n = mockLoadJsonObject(MOCK_NOTES_KEY)[examId];
      return n && typeof n.text === "string" && n.text ? n : null;
    }

    function saveMockNote(examId) {
      const exam = mockExamsCache.find(e => e.id === (examId || mockSelectedExamId));
      if (!exam) return;
      const el = document.getElementById("mock-note-input");
      const text = String(el ? el.value : "").slice(0, 500).trim();
      const all = mockLoadJsonObject(MOCK_NOTES_KEY);
      if (!text) {
        delete all[exam.id];
        mockWriteJsonObject(MOCK_NOTES_KEY, all);
        showToast("振り返りメモを削除しました");
      } else {
        all[exam.id] = { text: text, updated: new Date().toISOString() };
        mockWriteJsonObject(MOCK_NOTES_KEY, all);
        showToast("📝 振り返りメモを保存しました");
      }
      renderMockExamScreen();
    }

    function deleteMockNote(examId) {
      const id = examId || mockSelectedExamId;
      if (!id) return;
      const all = mockLoadJsonObject(MOCK_NOTES_KEY);
      if (!all[id]) return;
      delete all[id];
      mockWriteJsonObject(MOCK_NOTES_KEY, all);
      showToast("振り返りメモを削除しました");
      renderMockExamScreen();
    }

    function mockRenderNoteCard(exam) {
      if (!exam) return "";
      const note = mockNoteFor(exam.id);
      return `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold text-slate-700">📝 振り返りメモ</p>
          <span class="text-[10px] text-slate-400">${note ? `更新 ${mockFormatDateTime(note.updated)}` : "未記入"}</span>
        </div>
        <p class="text-[10px] text-slate-400 leading-relaxed">次回に向けた反省や作戦を残せます（500字まで・この端末に保存）。</p>
        <textarea id="mock-note-input" maxlength="500" rows="3" placeholder="例: 時間配分は良かったが Part 3 の語彙が弱い。次は例文で覚え直す。" class="w-full p-2.5 border border-slate-300 rounded-xl text-[11px] leading-relaxed bg-white">${escapeHtml(note ? note.text : "")}</textarea>
        <div class="flex gap-2">
          <button type="button" onclick="saveMockNote('${escapeHtml(exam.id)}')" class="flex-1 py-2 bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">メモを保存</button>
          ${note ? `<button type="button" onclick="deleteMockNote('${escapeHtml(exam.id)}')" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-xl transition cursor-pointer">削除</button>` : ""}
        </div>
      </div>`;
    }

    // ---- 時間配分ログ（answers の sec から組み立てる） ----
    function mockFormatDuration(sec) {
      const s = Math.max(0, Math.round(Number(sec) || 0));
      if (s < 60) return `${s}秒`;
      return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`;
    }

    function mockBuildTimeAnalysis(exam, result) {
      const rows = mockAnswerWords(exam, result).filter(r => r.sec > 0);
      if (!rows.length) return null;
      const totalSec = rows.reduce((s, r) => s + r.sec, 0);
      const avg = totalSec / rows.length;
      const bySpeed = rows.slice().sort((a, b) => b.sec - a.sec);
      const third = Math.max(1, Math.ceil(rows.length / 3));
      const phases = [
        { label: "序盤", rows: rows.slice(0, third) },
        { label: "中盤", rows: rows.slice(third, third * 2) },
        { label: "終盤", rows: rows.slice(third * 2) }
      ].filter(p => p.rows.length).map(p => {
        const correct = p.rows.filter(r => r.correct).length;
        return {
          label: p.label,
          total: p.rows.length,
          correct: correct,
          rate: Math.round(correct / p.rows.length * 100),
          avg: Math.round(p.rows.reduce((s, r) => s + r.sec, 0) / p.rows.length)
        };
      });
      return {
        count: rows.length,
        totalSec: totalSec,
        avg: avg,
        slowest: bySpeed[0],
        fastest: bySpeed[bySpeed.length - 1],
        phases: phases,
        slowestRows: bySpeed.slice(0, 3)
      };
    }

    function mockRenderTimeCard(exam, result) {
      const t = mockBuildTimeAnalysis(exam, result);
      if (!t) return "";
      const phaseHtml = t.phases.map(p => `<div class="bg-slate-50 rounded-xl p-2 text-center">
        <p class="text-[10px] font-bold text-slate-400">${p.label}</p>
        <p class="text-base font-extrabold ${p.rate >= 80 ? "text-emerald-700" : p.rate >= 60 ? "text-amber-700" : "text-rose-700"} tabular-nums">${p.rate}<span class="text-[10px] text-slate-400">%</span></p>
        <p class="text-[9px] text-slate-400 tabular-nums">平均 ${mockFormatDuration(p.avg)}</p>
      </div>`).join("");
      const slowHtml = t.slowestRows.map(r => `<div class="flex items-center justify-between gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
        <span class="min-w-0 truncate"><span class="font-bold text-slate-700">${escapeHtml(r.word.word)}</span> <span class="text-slate-400">${escapeHtml(mockPartLabel(exam, r.word.part))}</span></span>
        <span class="shrink-0 tabular-nums ${r.correct ? "text-emerald-700" : "text-rose-700"} font-bold">${mockFormatDuration(r.sec)} ${r.correct ? "正解" : "誤答"}</span>
      </div>`).join("");
      return `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold text-slate-700">⏱ 時間配分ログ</p>
          <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50 border-slate-300">解答合計 ${mockFormatDuration(t.totalSec)}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-600 tabular-nums">
          <p class="bg-slate-50 rounded-lg px-2.5 py-1.5">1問あたり平均 <span class="font-extrabold text-slate-800">${mockFormatDuration(t.avg)}</span></p>
          <p class="bg-slate-50 rounded-lg px-2.5 py-1.5">最速 ${mockFormatDuration(t.fastest.sec)} ／ 最遅 ${mockFormatDuration(t.slowest.sec)}</p>
        </div>
        <div class="grid grid-cols-3 gap-2">${phaseHtml}</div>
        <div class="space-y-1.5">
          <p class="text-[10px] font-bold text-slate-500">時間がかかった問題</p>
          ${slowHtml}
        </div>
        <p class="text-[10px] text-slate-400 leading-relaxed">前半で時間を使いすぎると終盤の正答率が下がる傾向があります。制限時間 ${Math.round((Number(exam && exam.duration_sec) || 1500) / 60)} 分に対する余裕も意識しましょう。</p>
      </div>`;
    }

    // Supabase 未設定・通信不可でも模試を体験できるよう、端末内の単語から練習模試を作る
    function mockBuildOfflineExam() {
      const source = (currentSubject === "kobun") ? (KOBUN_SOURCE || []) : (LEAP_SOURCE || []);
      const ids = [];
      const count = 30;
      if (source.length) {
        const step = Math.max(1, Math.floor(source.length / count));
        for (let i = 0; i < count && i * step < source.length; i++) {
          const w = source[i * step];
          if (w && Number.isFinite(Number(w.id))) ids.push(Number(w.id));
        }
      }
      const now = Date.now();
      return {
        id: MOCK_OFFLINE_EXAM_ID,
        title: "オフライン練習模試",
        subject: currentSubject,
        range_label: "端末内の全範囲から30問",
        question_ids: ids,
        question_count: ids.length,
        expected_rates: [],
        start_at: new Date(now - 86400000).toISOString(),
        end_at: new Date(now + 86400000 * 365).toISOString(),
        duration_sec: 1200,
        offline: true
      };
    }

    // 端末内採点用の簡易レポート（全国集計は行わない）
    function mockBuildOfflineReport(result) {
      return {
        ok: true, local: true, offline: true, stats: null,
        me: { result: result, rank: null, percentile: null, deviation: null, provisional: true },
        groups: [], allGroups: []
      };
    }
    function mockGroupDef(gid) { return (MOCK_UNIV_GROUPS || {})[gid] || null; }
    function mockTierLabel(tier) { return (MOCK_TIER_LABELS || {})[Number(tier)] || ""; }

    function mockPhase(exam) {
      if (!exam) return "closed";
      const now = Date.now();
      const start = Date.parse(exam.start_at);
      const end = Date.parse(exam.end_at);
      if (Number.isFinite(start) && now < start) return "before";
      if (Number.isFinite(end) && now > end) return "closed";
      return "open";
    }

    function mockFormatDateTime(value) {
      const d = new Date(value);
      if (isNaN(d.getTime())) return "-";
      return `${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    function mockFormatCountdown(ms) {
      const total = Math.max(0, Math.floor(ms / 1000));
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      return d > 0 ? `${d}日 ${hms}` : hms;
    }

    function mockSaveDraft() {
      try { localStorage.setItem(MOCK_DRAFT_KEY, JSON.stringify({ examId: mockSelectedExamId, choices: mockEntryChoices })); } catch (e) {}
    }

    function mockLoadDraft(examId) {
      try {
        const raw = JSON.parse(localStorage.getItem(MOCK_DRAFT_KEY) || "null");
        if (raw && raw.examId === examId && Array.isArray(raw.choices)) {
          return raw.choices.filter(c => c && c.facultyId && c.groupId);
        }
      } catch (e) {}
      return [];
    }

    function mockChoiceFromFaculty(f) {
      const g = mockGroupDef(f.groupId) || {};
      return {
        facultyId: f.id, faculty: f.faculty, univ: f.univ, groupId: f.groupId,
        groupName: g.name || `${f.univ}（${f.faculty}）`,
        tier: String(g.tier || ""), category: g.category || ""
      };
    }

    function mockTheoryMeanForExam(exam) {
      const ids = Array.isArray(exam && exam.question_ids) ? exam.question_ids : [];
      const rates = Array.isArray(exam && exam.expected_rates) ? exam.expected_rates : [];
      if (!ids.length) return 50 * 0.55;
      let sum = 0;
      ids.forEach((id, i) => {
        let r = Number(rates[i]);
        if (!Number.isFinite(r) || r <= 0 || r > 1) {
          const st = (userData.wordStats || {})[id];
          if (st && Number(st.total) > 0) r = Math.min(0.95, Math.max(0.2, Number(st.correct) / Number(st.total)));
          else r = 0.55;
        }
        sum += r;
      });
      return sum;
    }

    // RPC が使えないときのフォールバック（理論平均だけを使った参考値）
    function mockBuildLocalReport(exam, result) {
      const total = Math.max(1, Number(result && result.total) || 1);
      const score = Number(result && result.score) || 0;
      const theory = mockTheoryMeanForExam(exam);
      const p = Math.min(0.95, Math.max(0.05, theory / total));
      const sd = Math.max(Math.sqrt(total * p * (1 - p)), Math.max(total * 0.06, 2));
      const dev = Math.round(Math.min(75, Math.max(25, 50 + 10 * (score - theory) / sd)) * 10) / 10;
      return {
        ok: true, local: true,
        stats: {
          n: 1, n_all: 1, n_late: result && result.is_late ? 1 : 0, mean: score,
          trimmed_mean: score, theory_mean: Math.round(theory * 10) / 10,
          hybrid_mean: Math.round(theory * 10) / 10, sd_sample: 0,
          sd_effective: Math.round(sd * 100) / 100, provisional: true
        },
        me: { result: result, rank: null, percentile: null, deviation: dev, provisional: true },
        groups: [], allGroups: []
      };
    }

    // ---- 読み込み（ログイン不要） ----
    // 1) 未ログインでも読める公開スケジュール RPC（問題IDは受験時間内だけ返る）
    // 2) RPC 未適用ならログイン時のみ mock_exams を直接 SELECT
    // 3) どちらも無理なら端末内の練習模試を出す
    async function loadMockExams() {
      mockBusy = true;
      mockExamsError = "";
      mockScheduleNote = "";
      let rows = null;
      if (supabaseClient) {
        try {
          const rpc = await supabaseClient.rpc("get_mock_exam_schedule");
          if (!rpc.error && Array.isArray(rpc.data)) {
            rows = rpc.data;
          } else if (rpc.error && rpc.error.code === "PGRST202") {
            if (mockIsReady()) {
              const { data, error } = await supabaseClient.from("mock_exams")
                .select("*").order("start_at", { ascending: false }).limit(30);
              if (error) throw error;
              rows = Array.isArray(data) ? data : [];
            } else {
              mockScheduleNote = "公開スケジュール用 RPC が未適用のため、端末内の練習模試を表示しています（supabase/migration_mock_public.sql を実行すると全国模試が表示されます）。";
            }
          } else if (rpc.error) {
            throw rpc.error;
          }
        } catch (e) {
          console.warn("[mock] load exams", e);
          mockScheduleNote = (e && (e.code === "42P01" || /does not exist/i.test(String(e.message || ""))))
            ? "Supabase に模試スキーマがまだ適用されていません（supabase/schema.sql を実行してください）。端末内の練習模試を表示しています。"
            : "模試の開催予定を取得できませんでした（通信状況を確認してください）。端末内の練習模試を表示しています。";
        }
      }
      const real = Array.isArray(rows) ? rows : [];
      const practice = mockBuildOfflineExam();
      mockExamsCache = (practice.question_ids || []).length ? real.concat([practice]) : real;
      if (!real.length && !mockScheduleNote) {
        mockScheduleNote = supabaseClient
          ? "今は公開中の全国模試がないため、端末内の練習模試を表示しています。"
          : "Supabase 未設定のため、端末内の練習模試を表示しています。全国模試はオンライン時に表示されます。";
      }
      mockExamsLoaded = true;
      mockBusy = false;
      renderMockExamScreen();
    }

    // ---- 共有リンク（?mock=<examId>） ----
    let pendingMockExamId = "";

    function buildMockExamUrl(examId) {
      return `${window.location.origin}${window.location.pathname}?mock=${encodeURIComponent(examId)}`;
    }

    async function shareMockExamLink(examId) {
      const id = examId || (mockCurrentExam() && mockCurrentExam().id);
      if (!id) return;
      const exam = mockExamsCache.find(e => e.id === id);
      const url = buildMockExamUrl(id);
      const title = exam ? `LEAP 全国一斉模試「${exam.title}」` : "LEAP 全国一斉模試";
      if (navigator.share) {
        try {
          await navigator.share({ title: "LEAP 全国一斉模試", text: `${title}に挑戦しよう！`, url });
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          window.prompt("このリンクを共有してください", url);
          return;
        }
        showToast("模試リンクをコピーしました");
      } catch (e) {
        window.prompt("このリンクを共有してください", url);
      }
    }

    // 共有リンクで開かれたときは、ログイン状態が整うまで少し待ってから模試を開く
    function checkMockExamLink() {
      let params;
      try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
      const id = params.get("mock");
      if (!id) return;
      pendingMockExamId = id;
      // 再読み込みで再実行されないよう URL からは取り除く
      try {
        params.delete("mock");
        const q = params.toString();
        history.replaceState(history.state, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
      } catch (e) {}
    }

    // 共有リンクはログイン不要で開く（Supabase のクライアント初期化だけ待つ）
    function scheduleLinkedMockExam(attempt) {
      const n = attempt || 0;
      if (!pendingMockExamId) return;
      if (typeof supabaseClient !== "undefined" && supabaseClient) {
        openLinkedMockExam();
        return;
      }
      if (n < 8) {
        setTimeout(() => scheduleLinkedMockExam(n + 1), 700);
      } else {
        showToast("模試ページを開きます（端末内の練習模試を表示します）");
        pendingMockExamId = "";
        navigate("screen-mock-exam");
      }
    }

    async function openLinkedMockExam() {
      const id = pendingMockExamId;
      if (!id) return;
      pendingMockExamId = "";
      navigate("screen-mock-exam");
      try { await loadMockExams(); } catch (e) {}
      if (!mockExamsCache.some(e => e.id === id)) {
        showToast("この模試は終了したか、公開されていません");
        return;
      }
      await selectMockExam(id);
    }

    async function selectMockExam(id) {
      mockSelectedExamId = id;
      mockReport = null;
      mockReportError = "";
      mockMyResult = null;
      mockLocalReport = null;
      mockSubmitNote = "";
      mockEntryChoices = mockLoadDraft(id);
      const exam = mockCurrentExam();
      const local = mockLocalResult(id);
      if (local) {
        // 未ログイン・オフラインで保存した記録（ログイン中はクラウド結果を優先）
        mockMyResult = local;
        mockLocalReport = mockBuildOfflineReport(local);
      }
      renderMockExamScreen();
      if (!exam || exam.offline || !mockIsReady()) {
        if (local && exam && !exam.offline) {
          mockSubmitNote = "この端末に保存された記録です。ログインすると全国集計に提出できます。";
          renderMockExamScreen();
        }
        return;
      }
      try {
        const uid = cloudState.user.id;
        const [entryRes, resultRes] = await Promise.all([
          supabaseClient.from("mock_exam_entries").select("*").eq("exam_id", id).eq("user_id", uid).maybeSingle(),
          supabaseClient.from("mock_exam_results").select("*").eq("exam_id", id).eq("user_id", uid).maybeSingle()
        ]);
        if (entryRes.data && Array.isArray(entryRes.data.choices)) mockEntryChoices = entryRes.data.choices;
        if (resultRes.data) {
          mockMyResult = resultRes.data;
          mockLocalReport = null;
          mockClearLocalResult(id);
        } else if (local) {
          mockMyResult = local;
          mockLocalReport = mockBuildOfflineReport(local);
          mockSubmitNote = "端末に保存された記録があります。下の「全国集計に提出する」から提出できます。";
        } else {
          mockMyResult = null;
          mockLocalReport = null;
        }
      } catch (e) {
        console.warn("[mock] select exam", e);
      }
      await refreshMockReport(id);
      renderMockExamScreen();
    }

    async function refreshMockReport(id) {
      if (!mockIsReady()) return;
      try {
        const { data, error } = await supabaseClient.rpc("get_mock_exam_report", { p_exam_id: id });
        if (error) throw error;
        const rep = typeof data === "string" ? JSON.parse(data) : data;
        if (!rep || rep.ok === false) throw new Error((rep && rep.error) || "report_failed");
        mockReport = rep;
        mockReportError = "";
        mockLocalReport = null;
        if (rep.me && rep.me.result) mockMyResult = rep.me.result;
        if (Array.isArray(rep.me && rep.me.choices) && rep.me.choices.length) {
          mockEntryChoices = rep.me.choices;
          mockSaveDraft();
        }
      } catch (e) {
        console.warn("[mock] report", e);
        mockReport = null;
        mockReportError = "サーバー集計を取得できませんでした（schema.sql の RPC 適用を確認してください）。";
        const exam = mockCurrentExam();
        if (exam && mockMyResult && !(mockLocalReport && mockLocalReport.offline)) mockLocalReport = mockBuildLocalReport(exam, mockMyResult);
      }
    }

    // ---- エントリー操作 ----
    function mockSchoolCategories() {
      const list = [];
      (MOCK_FACULTIES || []).forEach(f => {
        const g = mockGroupDef(f.groupId) || {};
        if (g.category && !list.includes(g.category)) list.push(g.category);
      });
      return list;
    }

    function mockSchoolFilterMatch(f) {
      const g = mockGroupDef(f.groupId) || {};
      const flt = mockSchoolFilter || {};
      if (flt.category && g.category !== flt.category) return false;
      if (flt.tier && String(g.tier) !== String(flt.tier)) return false;
      const q = String(flt.query || "").trim().toLowerCase();
      if (q) {
        const hay = `${f.univ} ${f.faculty} ${g.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }

    function mockSchoolFilteredFaculties() {
      return (MOCK_FACULTIES || []).filter(mockSchoolFilterMatch);
    }

    function mockSchoolUnivs(facs) {
      const list = [];
      (facs || []).forEach(f => { if (!list.includes(f.univ)) list.push(f.univ); });
      return list;
    }

    function mockFacultyOptions(facs) {
      return facs.map(f => {
        const g = mockGroupDef(f.groupId) || {};
        return `<option value="${escapeHtml(f.id)}">${escapeHtml(f.faculty)}（${escapeHtml(g.name || "")}）</option>`;
      }).join("");
    }

    // 絞り込み条件に合わせて「大学」「学部」セレクトを作り直す
    function renderMockSchoolSelectors(keepUniv) {
      const univSel = document.getElementById("mock-univ-select");
      const facSel = document.getElementById("mock-faculty-select");
      if (!univSel || !facSel) return;
      const facs = mockSchoolFilteredFaculties();
      const univs = mockSchoolUnivs(facs);
      const countEl = document.getElementById("mock-filter-count");
      if (countEl) countEl.textContent = `${univs.length}大学 ・ ${facs.length}学部`;
      if (!univs.length) {
        univSel.innerHTML = `<option value="">条件に合う大学がありません</option>`;
        facSel.innerHTML = `<option value="">絞り込み条件を変えてください</option>`;
        return;
      }
      const prev = keepUniv || univSel.value;
      const selected = univs.includes(prev) ? prev : univs[0];
      univSel.innerHTML = univs.map(u => `<option value="${escapeHtml(u)}"${u === selected ? " selected" : ""}>${escapeHtml(u)}</option>`).join("");
      facSel.innerHTML = mockFacultyOptions(facs.filter(f => f.univ === selected));
    }

    function renderMockFacultySelect() {
      const univSel = document.getElementById("mock-univ-select");
      const facSel = document.getElementById("mock-faculty-select");
      if (!univSel || !facSel) return;
      facSel.innerHTML = mockFacultyOptions(mockSchoolFilteredFaculties().filter(f => f.univ === univSel.value));
    }

    function onMockSchoolFilterChange() {
      const cat = document.getElementById("mock-filter-category");
      const tier = document.getElementById("mock-filter-tier");
      const q = document.getElementById("mock-filter-query");
      mockSchoolFilter = {
        category: cat ? cat.value : "",
        tier: tier ? tier.value : "",
        query: q ? q.value : ""
      };
      renderMockSchoolSelectors();
    }

    function clearMockSchoolFilter() {
      mockSchoolFilter = { category: "", tier: "", query: "" };
      const cat = document.getElementById("mock-filter-category");
      const tier = document.getElementById("mock-filter-tier");
      const q = document.getElementById("mock-filter-query");
      if (cat) cat.value = "";
      if (tier) tier.value = "";
      if (q) q.value = "";
      renderMockSchoolSelectors();
    }

    function addMockChoice() {
      const univSel = document.getElementById("mock-univ-select");
      const facSel = document.getElementById("mock-faculty-select");
      if (!univSel || !facSel) return;
      const faculty = (MOCK_FACULTIES || []).find(f => f.id === facSel.value);
      if (!faculty) return;
      if (mockEntryChoices.length >= 5) { showToast("志望校は5つまでです"); return; }
      if (mockEntryChoices.some(c => c.facultyId === faculty.id)) { showToast("同じ学部がすでに登録されています"); return; }
      mockEntryChoices.push(mockChoiceFromFaculty(faculty));
      mockSaveDraft();
      renderMockExamScreen();
    }

    function removeMockChoice(index) {
      mockEntryChoices = mockEntryChoices.filter((_, i) => i !== index);
      mockSaveDraft();
      renderMockExamScreen();
    }

    async function saveMockEntry() {
      const exam = mockCurrentExam();
      if (!exam) return;
      if (mockEntryChoices.length === 0) {
        showAlert({ title: "志望校を選んでください", message: "第1志望から1つ以上登録してください。", icon: "🏫" });
        return;
      }
      mockSaveDraft();
      if (!mockIsReady() || exam.offline) {
        showToast(exam.offline ? "🎯 練習模試では志望校エントリーは不要です" : "📝 志望校をこの端末に保存しました（ログインで全国集計へ）");
        renderMockExamScreen();
        return;
      }
      mockBusy = true;
      try {
        const { error } = await supabaseClient.from("mock_exam_entries").upsert({
          exam_id: exam.id,
          user_id: cloudState.user.id,
          choices: mockEntryChoices,
          updated_at: new Date().toISOString()
        }, { onConflict: "exam_id,user_id" });
        if (error) throw error;
        mockSaveDraft();
        showToast("📝 志望校をエントリーしました");
        await refreshMockReport(exam.id);
      } catch (e) {
        console.warn("[mock] save entry", e);
        showAlert({
          title: "エントリーできませんでした",
          message: "通信状況を確認するか、supabase/schema.sql の模試テーブルが適用されているか確認してください。",
          icon: "☁️"
        });
      } finally {
        mockBusy = false;
        renderMockExamScreen();
      }
    }

    // ---- 受験 ----
    function mockPoolForExam(exam) {
      const source = (exam && exam.subject === "kobun") ? KOBUN_SOURCE : LEAP_SOURCE;
      const map = new Map(source.map(w => [Number(w.id), w]));
      return ((exam && exam.question_ids) || []).map(id => map.get(Number(id))).filter(Boolean);
    }

    // ---- 弱点分析（解答ログから Part 別正答率・誤答を組み立てる） ----
    function mockPartLabel(exam, part) {
      const n = Number(part);
      if (!Number.isFinite(n)) return "その他";
      if ((exam && exam.subject === "kobun") || n >= 100) return `${n - 100}章`;
      return `Part ${n}`;
    }

    // answers（[{ id, correct, sec }]）を単語データへ引き直す。全国集計・端末保存のどちらでも使える
    function mockAnswerWords(exam, result) {
      const source = (exam && exam.subject === "kobun") ? (KOBUN_SOURCE || []) : (LEAP_SOURCE || []);
      const map = new Map(source.map(w => [Number(w.id), w]));
      return ((result && Array.isArray(result.answers)) ? result.answers : [])
        .map(a => {
          const w = map.get(Number(a && a.id));
          if (!w) return null;
          return { word: w, correct: !!(a && a.correct), sec: Math.max(0, Number(a && a.sec) || 0) };
        })
        .filter(Boolean);
    }

    function mockBuildWeaknessAnalysis(exam, result) {
      const rows = mockAnswerWords(exam, result);
      if (!rows.length) return null;
      const partMap = new Map();
      rows.forEach(r => {
        const key = String(r.word.part == null ? "?" : r.word.part);
        if (!partMap.has(key)) partMap.set(key, { part: r.word.part, total: 0, correct: 0 });
        const p = partMap.get(key);
        p.total++;
        if (r.correct) p.correct++;
      });
      const partRows = Array.from(partMap.values())
        .map(p => Object.assign({}, p, { rate: Math.round(p.correct / p.total * 100) }))
        .sort((a, b) => a.rate - b.rate || b.total - a.total);
      const missed = rows.filter(r => !r.correct);
      return {
        rows: rows,
        partRows: partRows,
        missed: missed,
        accuracy: Math.round((rows.length - missed.length) / rows.length * 100)
      };
    }

    function mockRenderWeaknessCard(exam, result) {
      const an = mockBuildWeaknessAnalysis(exam, result);
      if (!an) return "";
      const barColor = (rate) => rate >= 80 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-400" : "bg-rose-500";
      const partHtml = an.partRows.map(p => `<div class="space-y-0.5">
        <div class="flex items-center justify-between text-[10px] font-bold text-slate-600">
          <span>${escapeHtml(mockPartLabel(exam, p.part))}</span>
          <span class="tabular-nums">${p.correct}/${p.total} ・ ${p.rate}%</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <span class="block h-1.5 rounded-full ${barColor(p.rate)}" style="width:${Math.max(4, Math.min(100, p.rate))}%"></span>
        </div>
      </div>`).join("");
      const missHtml = an.missed.slice(0, 12).map(r => `<div class="flex items-start justify-between gap-2 bg-rose-50/60 border border-rose-100 rounded-lg px-2.5 py-1.5">
        <div class="min-w-0">
          <p class="text-[11px] font-extrabold text-slate-800 truncate">${escapeHtml(r.word.word)}<span class="text-[9px] text-slate-400 ml-1">#${r.word.id}</span></p>
          <p class="text-[10px] text-slate-500 truncate">${escapeHtml(r.word.meaning || "")}</p>
        </div>
        <span class="shrink-0 text-[9px] font-bold text-rose-700">${escapeHtml(mockPartLabel(exam, r.word.part))}</span>
      </div>`).join("");
      const weakest = an.partRows[0];
      const advice = weakest
        ? `${mockPartLabel(exam, weakest.part)} が最も弱い領域です（${weakest.correct}/${weakest.total}問正解）。この範囲を重点的に復習しましょう。`
        : "";
      return `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold text-slate-700">🔍 弱点分析レポート</p>
          <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50 border-slate-300">解答 ${an.rows.length}問</span>
        </div>
        <p class="text-[11px] text-slate-600 font-bold">${an.missed.length ? `誤答 ${an.missed.length}問 ・ 分野別の正答率は下記のとおりです。` : "全問正解です。弱点は見つかりませんでした。"}</p>
        ${an.partRows.length > 1 ? `<div class="space-y-2">${partHtml}</div>` : `<div class="space-y-2">${partHtml}</div>`}
        ${advice ? `<p class="text-[11px] text-slate-700 font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 leading-relaxed">💡 ${escapeHtml(advice)}</p>` : ""}
        ${an.missed.length ? `<div class="space-y-1.5">
          <p class="text-[10px] font-bold text-slate-500">間違えた単語（${an.missed.length}問${an.missed.length > 12 ? "・先頭12件" : ""}）</p>
          ${missHtml}
          ${an.missed.length > 12 ? `<p class="text-[10px] text-slate-400">ほか ${an.missed.length - 12} 語は「🔥 間違いを復習」から確認できます。</p>` : ""}
        </div>` : ""}
      </div>`;
    }

    async function startMockExam() {
      let exam = mockCurrentExam();
      if (!exam) return;
      if (mockPhase(exam) !== "open") {
        showAlert({ title: "受験時間外です", message: "受験できるのは開始時刻から終了時刻までです。", icon: "⏰" });
        return;
      }
      // 公開スケジュール RPC は開始前 question_ids を返さないため、受験開始時に取り直す
      if (!exam.offline && !(Array.isArray(exam.question_ids) && exam.question_ids.length) && supabaseClient && !mockBusy) {
        await loadMockExams();
        exam = mockCurrentExam() || exam;
      }
      // 受験済みチェックは全国集計の回だけ（練習模試は何度でも挑戦可）
      if (mockMyResult && !exam.offline && mockIsReady()) {
        showAlert({ title: "この回は受験済みです", message: "1人1回までの受験です。成績表を確認してください。", icon: "✅" });
        return;
      }
      if (mockIsReady() && !exam.offline && mockEntryChoices.length === 0) {
        showAlert({ title: "志望校が未登録です", message: "先に第1志望を登録してエントリーしてください。", icon: "🏫" });
        return;
      }
      // 未保存のまま受験しても志望校別集計に入るよう、開始前にエントリーを確定する（ログイン時のみ）
      if (mockIsReady() && !exam.offline) {
        try {
          await supabaseClient.from("mock_exam_entries").upsert({
            exam_id: exam.id,
            user_id: cloudState.user.id,
            choices: mockEntryChoices,
            updated_at: new Date().toISOString()
          }, { onConflict: "exam_id,user_id" });
        } catch (e) {
          console.warn("[mock] pre-start entry save", e);
        }
      }
      const pool = mockPoolForExam(exam);
      if (!pool.length) {
        showAlert({ title: "問題が見つかりません", message: "この回の問題IDに対応する単語データがありません。", icon: "🔍" });
        return;
      }
      const minutes = Math.round((Number(exam.duration_sec) || 1500) / 60);
      const ok = await showConfirm({
        title: "模試を開始しますか？",
        message: `${exam.title}\n${pool.length}問 ・ 制限時間 ${minutes}分。\n開始するとタイマーは止まりません。終了時刻を過ぎた提出は参考記録になります。\n${mockIsReady() && !exam.offline ? "結果は全国集計に提出されます。" : "ログインしていないため、結果はこの端末に保存されます（全国順位・偏差値は出ません）。"}`,
        okText: "開始する",
        cancelText: "やめる",
        icon: "🏫",
        danger: false
      });
      if (!ok) return;
      if (exam.subject && exam.subject !== currentSubject) applySubject(exam.subject, { silent: true });
      mockExamCurrent = exam;
      mockExamStartedAt = Date.now();
      mockLastMistakes = [];
      mockLocalReport = null;
      mockSubmitNote = "";
      startQuizWithPool(pool, {
        mockExam: true,
        forceNormalStyle: true,
        durationSec: Number(exam.duration_sec) || 1500,
        mockQuestionCount: pool.length
      });
    }

    async function submitMockExamResult(exam, score, total, elapsedSec, answers, isLate) {
      if (!exam) return;
      mockSubmitNote = "";
      const payload = {
        score: Math.max(0, Math.round(Number(score) || 0)),
        total: Math.max(1, Math.round(Number(total) || 1)),
        elapsed_sec: Math.max(0, Math.round(Number(elapsedSec) || 0)),
        answers: Array.isArray(answers) ? answers : [],
        is_late: !!isLate,
        submitted_at: new Date().toISOString()
      };
      // 未ログイン・オフライン・練習模試は端末に保存する
      if (!mockIsReady() || exam.offline) {
        mockSaveLocalResult(exam.id, payload);
        mockMyResult = payload;
        mockLocalReport = mockBuildOfflineReport(payload);
        mockSubmitNote = exam.offline
          ? "練習模試の結果をこの端末に保存しました。"
          : "結果をこの端末に保存しました。ログインすると全国集計に提出できます。";
        renderMockExamScreen();
        return;
      }
      try {
        const { error } = await supabaseClient.from("mock_exam_results").insert({
          exam_id: exam.id,
          user_id: cloudState.user.id,
          score: payload.score,
          total: payload.total,
          elapsed_sec: payload.elapsed_sec,
          answers: payload.answers,
          is_late: payload.is_late
        });
        if (error) {
          if (error.code === "23505") {
            mockSubmitNote = "この回はすでに受験済みのため、今回の記録は保存されていません（参考記録）。";
          } else {
            throw error;
          }
        } else {
          mockSubmitNote = isLate ? "終了時刻を過ぎた提出のため、参考記録（is_late）として保存しました。" : "";
          mockMyResult = payload;
          mockLocalReport = null;
          mockClearLocalResult(exam.id);
          showToast("📮 模試の成績を提出しました");
        }
      } catch (e) {
        console.warn("[mock] submit", e);
        mockSaveLocalResult(exam.id, payload);
        mockMyResult = payload;
        mockLocalReport = mockBuildOfflineReport(payload);
        mockSubmitNote = "成績を提出できませんでした（通信エラー）。結果をこの端末に保存しました。";
      }
      await refreshMockReport(exam.id);
      renderMockExamScreen();
    }

    // 未ログイン時に端末へ保存した記録を、ログイン後に全国集計へ提出する
    async function resubmitLocalMockResult() {
      const exam = mockCurrentExam();
      if (!exam || exam.offline) { showToast("提出できる記録がありません"); return; }
      const local = mockLocalResult(exam.id);
      if (!local) { showToast("提出できる記録がありません"); return; }
      if (!mockIsReady()) { showToast("ログインすると提出できます"); navigate("screen-social"); return; }
      mockSubmitNote = "";
      await submitMockExamResult(exam, local.score, local.total, local.elapsed_sec, local.answers, local.is_late);
    }

    function reviewMockMistakes() {
      const pool = (mockLastMistakes || []).filter(w => w && w.word);
      if (!pool.length) { showToast("復習する誤答はありません"); return; }
      startQuizWithPool(pool, { forceNormalMode: true, forceNormalStyle: true, questionCount: pool.length });
    }

    // ---- 表示 ----
    function mockRenderExamList() {
      const wrap = document.getElementById("mock-exam-list");
      if (!wrap) return;
      const note = mockScheduleNote
        ? `<p class="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-relaxed">${escapeHtml(mockScheduleNote)}</p>`
        : "";
      const practice = mockExamsCache.find(e => e && e.offline);
      const practiceHtml = practice
        ? `<button type="button" onclick="selectMockExam('${practice.id}')" class="w-full text-left border rounded-xl px-3 py-2.5 transition cursor-pointer ${practice.id === mockSelectedExamId ? "border-indigo-400 bg-indigo-50" : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"}">
            <span class="flex items-center justify-between gap-2">
              <span class="text-[12px] font-extrabold text-emerald-900 truncate">🎯 ${escapeHtml(practice.title)}</span>
              <span class="shrink-0 text-[9px] font-extrabold border rounded-full px-1.5 py-0.5 text-emerald-800 bg-white border-emerald-300">ログイン不要</span>
            </span>
            <span class="block text-[10px] text-emerald-700 mt-0.5 truncate">${escapeHtml(practice.range_label || "")} ・ ${mockQuestionCount(practice)}問 ・ いつでも受験可</span>
            <span class="block text-[10px] text-emerald-600/80 mt-0.5">結果はこの端末に保存（全国集計なし）</span>
          </button>`
        : "";
      if (mockExamsError) {
        wrap.innerHTML = note + practiceHtml + `<p class="text-[11px] text-rose-600 leading-relaxed">${escapeHtml(mockExamsError)}</p>`;
        return;
      }
      const others = mockExamsCache.filter(e => e && !e.offline);
      if (!others.length) {
        wrap.innerHTML = note + practiceHtml + `<p class="text-[11px] text-slate-400">${mockBusy ? "読み込み中..." : "開催予定の全国模試はありません。"}</p>`;
        return;
      }
      const now = Date.now();
      const upcoming = others.filter(e => Date.parse(e.end_at) >= now)
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
      const past = others.filter(e => Date.parse(e.end_at) < now)
        .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at));
      wrap.innerHTML = note + practiceHtml + upcoming.concat(past).slice(0, 7).map(e => {
        const phase = mockPhase(e);
        const badge = phase === "open"
          ? ["受験受付中", "text-rose-800 bg-rose-50 border-rose-300"]
          : phase === "before"
            ? ["開催前", "text-amber-800 bg-amber-50 border-amber-300"]
            : ["終了", "text-slate-600 bg-slate-100 border-slate-300"];
        const on = e.id === mockSelectedExamId;
        return `<button type="button" onclick="selectMockExam('${e.id}')" class="w-full text-left border rounded-xl px-3 py-2.5 transition cursor-pointer ${on ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-white"}">
          <span class="flex items-center justify-between gap-2">
            <span class="text-[12px] font-extrabold text-slate-800 truncate">${escapeHtml(e.title)}</span>
            <span class="shrink-0 text-[9px] font-extrabold border rounded-full px-1.5 py-0.5 ${badge[1]}">${badge[0]}</span>
          </span>
          <span class="block text-[10px] text-slate-500 mt-0.5 truncate">${escapeHtml(e.range_label || "")} ・ ${mockQuestionCount(e)}問</span>
          <span class="block text-[10px] text-slate-400 mt-0.5">${mockFormatDateTime(e.start_at)} 〜 ${mockFormatDateTime(e.end_at)}${mockReminderFor(e.id) ? ` ・ <span class="text-amber-700 font-bold">⏰ リマインド設定済み</span>` : ""}</span>
        </button>`;
      }).join("");
    }

    function mockRenderStatus(exam) {
      const status = document.getElementById("mock-exam-status");
      if (!status) return;
      const phase = mockPhase(exam);
      const badge = phase === "open"
        ? ["受験受付中", "text-rose-800 bg-rose-50 border-rose-300"]
        : phase === "before"
          ? ["開催前", "text-amber-800 bg-amber-50 border-amber-300"]
          : ["終了", "text-slate-600 bg-slate-100 border-slate-300"];
      const minutes = Math.round((Number(exam.duration_sec) || 1500) / 60);
      status.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-extrabold text-slate-900">${escapeHtml(exam.title)}</p>
            <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(exam.range_label || "")} ・ ${mockQuestionCount(exam)}問 ・ ${minutes}分</p>
          </div>
          <span class="shrink-0 text-[10px] font-extrabold border rounded-full px-2 py-0.5 ${badge[1]}">${badge[0]}</span>
        </div>
        <p class="text-[11px] text-slate-500">${mockFormatDateTime(exam.start_at)} 〜 ${mockFormatDateTime(exam.end_at)}</p>
        <p id="mock-countdown" class="text-xs font-extrabold text-slate-800 tabular-nums">-</p>
        <p class="text-[10px] text-slate-400 leading-relaxed">開始前はカウントダウンと志望校登録。期間内は${minutes}分の制限時間で受験できます。終了時刻を過ぎた提出は参考記録（is_late）になります。</p>
        ${mockIsReady() ? "" : `<p class="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 leading-relaxed">ログインなしでも受験できます。${exam.offline ? "この練習模試の結果は端末に保存されます。" : "結果は端末に保存され、ログインすると全国集計に提出できます。"}</p>`}
        ${exam.offline ? "" : `<div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="shareMockExamLink('${exam.id}')" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer">🔗 この模試のリンクを共有</button>
          <button type="button" onclick="toggleMockReminder('${exam.id}')" class="inline-flex items-center gap-1 px-3 py-1.5 ${mockReminderFor(exam.id) ? "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800" : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"} border text-[11px] font-bold rounded-lg transition cursor-pointer">${mockReminderFor(exam.id) ? "⏰ リマインド解除" : "⏰ リマインド設定"}</button>
        </div>`}
      </div>`;
    }

    function mockRenderEntrySection(exam) {
      const wrap = document.getElementById("mock-entry-section");
      if (!wrap) return;
      if (exam && exam.offline) {
        wrap.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p class="text-xs font-bold text-slate-700">🎯 練習模試について</p>
          <p class="text-[11px] text-slate-500 leading-relaxed">端末内の単語から30問を出題します。志望校エントリーや全国順位はありません。結果はこの端末に保存されます。</p>
        </div>`;
        return;
      }
      const signedIn = mockIsReady();
      const facs = Array.isArray(MOCK_FACULTIES) ? MOCK_FACULTIES : [];
      if (!facs.length) {
        wrap.innerHTML = `<p class="text-[11px] text-rose-600">志望校マスタが読み込まれていません（mock_schools_data.js）。</p>`;
        return;
      }
      const locked = mockPhase(exam) === "closed";
      const lastUniv = mockEntryChoices.length ? mockEntryChoices[mockEntryChoices.length - 1].univ : "";
      const catOpts = mockSchoolCategories().map(c => `<option value="${escapeHtml(c)}"${mockSchoolFilter.category === c ? " selected" : ""}>${escapeHtml(c)}</option>`).join("");
      const tierOpts = [1, 2, 3, 4].map(t => `<option value="${t}"${String(mockSchoolFilter.tier) === String(t) ? " selected" : ""}>${escapeHtml(mockTierLabel(t))}</option>`).join("");
      const rows = mockEntryChoices.map((c, i) => `<div class="flex items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
        <span class="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">${i + 1}</span>
        <span class="min-w-0 flex-1 truncate"><span class="font-bold text-slate-800">${escapeHtml(c.univ)}</span> ${escapeHtml(c.faculty)}</span>
        <span class="text-[9px] text-slate-400 shrink-0">${escapeHtml(c.groupName || "")}</span>
        ${locked ? "" : `<button type="button" onclick="removeMockChoice(${i})" class="text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer">✕</button>`}
      </div>`).join("");
      wrap.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold text-slate-700">志望校エントリー（第1〜第5志望）</p>
          <span class="text-[10px] font-bold text-slate-500">${mockEntryChoices.length}/5</span>
        </div>
        ${locked ? "" : `<div class="space-y-2">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
            <p class="text-[10px] font-bold text-slate-500">🔎 大学を絞り込む</p>
            <input id="mock-filter-query" type="search" value="${escapeHtml(mockSchoolFilter.query)}" oninput="onMockSchoolFilterChange()" placeholder="大学名・学部名で検索（例: 工芸繊維）" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] font-bold bg-white placeholder:font-normal">
            <div class="grid grid-cols-2 gap-2">
              <select id="mock-filter-category" onchange="onMockSchoolFilterChange()" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] font-bold bg-white cursor-pointer">
                <option value="">すべてのカテゴリ</option>${catOpts}
              </select>
              <select id="mock-filter-tier" onchange="onMockSchoolFilterChange()" class="w-full p-2 border border-slate-300 rounded-lg text-[11px] font-bold bg-white cursor-pointer">
                <option value="">すべての難易度</option>${tierOpts}
              </select>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span id="mock-filter-count" class="text-[10px] text-slate-400 tabular-nums"></span>
              <button type="button" onclick="clearMockSchoolFilter()" class="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer shrink-0">条件をクリア</button>
            </div>
          </div>
          <select id="mock-univ-select" onchange="renderMockFacultySelect()" class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white cursor-pointer"></select>
          <select id="mock-faculty-select" class="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white cursor-pointer"></select>
          <button type="button" onclick="addMockChoice()" class="w-full py-2 bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">＋ 志望校に追加</button>
        </div>`}
        <div class="space-y-1.5">${rows || `<p class="text-[11px] text-slate-400">まだ登録がありません。第1志望から追加してください。</p>`}</div>
        ${signedIn ? "" : `<p class="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 leading-relaxed">ログインなしでもエントリーと受験ができます（この端末に保存）。ログインすると全国集計の判定対象になります。</p>`}
        ${locked ? `<p class="text-[10px] text-slate-400">エントリーの受付は終了しました。</p>` : `<button type="button" onclick="saveMockEntry()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">${signedIn ? "この内容でエントリーする" : "この端末に保存する"}</button>`}
        <p class="text-[10px] text-slate-400 leading-relaxed">集計・判定は「大学×文理（groupId）」単位。第1〜第5志望まで登録できます。</p>
      </div>`;
      if (!locked) renderMockSchoolSelectors(lastUniv);
    }

    function mockRenderActionSection(exam) {
      const wrap = document.getElementById("mock-action-section");
      if (!wrap) return;
      const phase = mockPhase(exam);
      const result = mockMyResult || (mockReport && mockReport.me && mockReport.me.result) || null;
      const minutes = Math.round((Number(exam.duration_sec) || 1500) / 60);
      const signedIn = mockIsReady();
      const offline = !!exam.offline;
      let html = "";
      if (result && !offline) {
        html = `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
          <p class="text-xs font-extrabold text-emerald-900">✅ この回は受験済みです</p>
          <p class="text-[11px] text-emerald-700">${result.is_late ? "参考記録（終了時刻超過）" : "正規受験"} ・ 得点 ${Number(result.score) || 0}/${Number(result.total) || 0}</p>
          <p class="text-[10px] text-emerald-600">${signedIn ? "成績表は下に表示しています。" : "端末に保存した記録です。ログイン後に「全国集計に提出する」から提出できます。"}</p>
        </div>`;
      } else if (phase === "before") {
        html = `<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <p class="text-xs font-bold text-slate-700">開始前です</p>
          <p class="text-[11px] text-slate-500 leading-relaxed">志望校（第1〜第5）を登録して待ちましょう。開始時刻になると受験ボタンが有効になります。</p>
        </div>`;
      } else if (phase === "open") {
        const needsEntry = signedIn && !offline && mockEntryChoices.length === 0;
        const disabled = mockBusy || needsEntry;
        html = `<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <p class="text-xs font-bold text-slate-700">受験受付中</p>
          <p class="text-[11px] text-slate-500 leading-relaxed">${mockQuestionCount(exam)}問 ／ 制限時間 ${minutes}分。途中退出しても制限時間は進みます。</p>
          ${needsEntry ? `<p class="text-[11px] font-bold text-rose-600">先に志望校を1つ以上登録してください。</p>` : ""}
          ${signedIn ? "" : `<p class="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 leading-relaxed">ログインなしで受験できます。${offline ? "採点結果はこの端末に保存されます。" : "結果は端末に保存され、あとでログインすると全国集計に提出できます。"}</p>`}
          <button type="button" onclick="startMockExam()" ${disabled ? "disabled" : ""} class="w-full py-3.5 ${disabled ? "bg-slate-300 text-white cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"} font-bold rounded-xl transition">🏫 模試を開始する</button>
        </div>`;
      } else {
        html = `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4"><p class="text-xs font-bold text-slate-600">この回の受験期間は終了しました</p><p class="text-[11px] text-slate-400 mt-1">結果の集計は終了後に確定します。</p></div>`;
      }
      wrap.innerHTML = html;
    }

    function mockJudgeFor(group, rep) {
      const stats = (rep && rep.stats) || {};
      const dev = rep && rep.me ? Number(rep.me.deviation) : NaN;
      const provisional = !!stats.provisional || !!(group && group.provisional) || !!(rep && rep.local);
      if (!Number.isFinite(dev)) {
        return { label: "判定保留", cls: "text-slate-700 bg-slate-50 border-slate-300", note: "偏差値を算出できませんでした" };
      }
      if (provisional) {
        return {
          label: "判定保留（暫定）",
          cls: "text-amber-800 bg-amber-50 border-amber-300",
          note: `受験者数 N=${Number(stats.n) || 0}（5未満）のため参考値。データが増えると判定が安定します。`
        };
      }
      const tier = Number(group && group.tier) || 3;
      const th = MOCK_JUDGE_THRESHOLDS[tier] || MOCK_JUDGE_THRESHOLDS[3];
      let idx = dev >= th[0] ? 0 : dev >= th[1] ? 1 : dev >= th[2] ? 2 : 3;
      const within = Number(group && group.percentileWithin);
      if (Number.isFinite(within) && group.percentileWithin !== null) {
        if (within <= 25 && idx > 0) idx -= 1;
        else if (within >= 80 && idx < 3) idx += 1;
      }
      const labels = ["A（合格圏）", "B（挑戦圏）", "C（要強化）", "D（基礎固め）"];
      const classes = [
        "text-emerald-800 bg-emerald-50 border-emerald-300",
        "text-sky-800 bg-sky-50 border-sky-300",
        "text-amber-800 bg-amber-50 border-amber-300",
        "text-rose-800 bg-rose-50 border-rose-300"
      ];
      return {
        label: labels[idx], cls: classes[idx],
        note: `tier ${tier}${mockTierLabel(tier) ? `（${mockTierLabel(tier)}）` : ""}基準 ／ 偏差値 ${dev}`
      };
    }

    function mockRenderReportSection(exam) {
      const wrap = document.getElementById("mock-report-section");
      if (!wrap) return;
      const rep = mockReport || mockLocalReport;
      const result = mockMyResult || (rep && rep.me && rep.me.result) || null;
      const parts = [];

      // 端末内採点（未ログイン・オフライン・練習模試）
      if (rep && rep.offline && rep.me && rep.me.result) {
        const r = rep.me.result;
        const offTotal = Math.max(1, Number(r.total) || 1);
        const offScore = Number(r.score) || 0;
        const offAcc = Math.round(offScore / offTotal * 100);
        const offSec = Math.max(0, Number(r.elapsed_sec) || 0);
        const offMin = Math.floor(offSec / 60);
        const offRest = String(offSec % 60).padStart(2, "0");
        wrap.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-bold text-slate-700">📝 端末内の採点結果</p>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50 border-slate-300">オフライン記録</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">得点</p><p class="text-xl font-extrabold text-slate-900 tabular-nums">${offScore}<span class="text-[11px] text-slate-400">/${offTotal}</span></p></div>
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">正答率</p><p class="text-xl font-extrabold text-emerald-700 tabular-nums">${offAcc}<span class="text-[11px] text-slate-400">%</span></p></div>
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">所要時間</p><p class="text-xl font-extrabold text-indigo-700 tabular-nums">${offMin}<span class="text-[11px] text-slate-400">分${offRest}秒</span></p></div>
          </div>
          ${mockRenderWeaknessCard(exam, r)}
          ${mockRenderTimeCard(exam, r)}
          ${mockRenderNoteCard(exam)}
          ${r.is_late ? `<p class="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">終了時刻を過ぎた提出のため参考記録です。</p>` : ""}
          <p class="text-[10px] text-slate-400 leading-relaxed">${exam && exam.offline ? "練習模試のため、全国順位・偏差値・志望校判定はありません。" : "ログインすると全国集計に提出でき、偏差値・順位・志望校判定が表示されます。"}</p>
          ${mockSubmitNote ? `<p class="text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">${escapeHtml(mockSubmitNote)}</p>` : ""}
          ${(mockIsReady() && exam && !exam.offline) ? `<button type="button" onclick="resubmitLocalMockResult()" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">☁️ 全国集計に提出する</button>` : ""}
          <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="downloadMockResultImage()" class="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-xl transition cursor-pointer">📸 結果カードを保存</button>
            <button type="button" onclick="reviewMockMistakes()" class="py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">🔥 間違いを復習</button>
          </div>
        </div>`;
        return;
      }

      if (result) {
        const stats = (rep && rep.stats) || {};
        const my = (rep && rep.me) || {};
        const provisional = !!stats.provisional || !!(rep && rep.local);
        const dev = (my.deviation === null || my.deviation === undefined) ? "-" : my.deviation;
        const total = Math.max(1, Number(result.total) || 1);
        const score = Number(result.score) || 0;
        const pct = (my.percentile === null || my.percentile === undefined) ? "-" : my.percentile;
        const rank = (my.rank === null || my.rank === undefined) ? "-" : my.rank;
        const n = Number(stats.n) || 0;
        const pctileText = pct === "-" ? "-" : Math.max(0, Math.round(100 - Number(pct)));
        parts.push(`<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-bold text-slate-700">📊 成績表</p>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${provisional ? "text-amber-800 bg-amber-50 border-amber-300" : "text-emerald-800 bg-emerald-50 border-emerald-300"}">${provisional ? "暫定（データ不足・参考値）" : "確定集計"}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">偏差値</p><p class="text-2xl font-extrabold text-indigo-700 tabular-nums">${dev}</p></div>
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">順位</p><p class="text-2xl font-extrabold text-slate-900 tabular-nums">${rank}<span class="text-xs font-bold text-slate-400">位</span></p><p class="text-[10px] text-slate-400">/ ${n}人</p></div>
            <div class="bg-slate-50 rounded-xl p-2"><p class="text-[10px] font-bold text-slate-400">上位</p><p class="text-2xl font-extrabold text-emerald-700 tabular-nums">${pctileText}<span class="text-xs font-bold text-slate-400">%</span></p></div>
          </div>
          <div class="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            <span>得点 ${score} / ${total}（${Math.round(score / total * 100)}%）</span>
            <span>${result.is_late ? "参考記録（is_late）" : "正規受験"}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 leading-relaxed">
            <p>受験者数 N=<span class="font-bold text-slate-700">${n}</span>${Number(stats.n_late) ? `（参考記録 ${stats.n_late}件を除く）` : ""}</p>
            <p>集計単位: 全体</p>
            <p>平均 ${stats.mean} ／ トリム平均 ${stats.trimmed_mean}</p>
            <p>理論平均 ${stats.theory_mean} ／ 実効SD ${stats.sd_effective}</p>
          </div>
          ${mockSubmitNote ? `<p class="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">${escapeHtml(mockSubmitNote)}</p>` : ""}
          ${rep && rep.local ? `<p class="text-[10px] text-rose-600">サーバー集計に接続できないため、理論平均だけを使った参考値を表示しています。</p>` : ""}
          <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="downloadMockResultImage()" class="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-xl transition cursor-pointer">📸 結果カードを保存</button>
            <button type="button" onclick="reviewMockMistakes()" class="py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">🔥 間違いを復習</button>
          </div>
          <button type="button" onclick="openMockFeedback()" class="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl transition cursor-pointer">📮 この模試の感想を送る</button>
        </div>`);
      } else {
        parts.push(`<div class="bg-white p-4 rounded-xl border border-dashed border-slate-300 text-center"><p class="text-2xl">🗓️</p><p class="text-xs font-bold text-slate-600 mt-1">まだ受験結果がありません</p><p class="text-[11px] text-slate-400 mt-0.5">受験期間内に挑戦すると、偏差値・順位・志望校判定が表示されます。</p></div>`);
      }

      if (result) parts.push(mockRenderWeaknessCard(exam, result));
      if (result) parts.push(mockRenderTimeCard(exam, result));
      if (result) parts.push(mockRenderNoteCard(exam));

      if (mockReportError && !result) {
        parts.push(`<p class="text-[11px] text-rose-600">${escapeHtml(mockReportError)}</p>`);
      }

      const groups = (rep && rep.groups) || [];
      if (groups.length) {
        parts.push(`<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <p class="text-xs font-bold text-slate-700">🎯 志望校判定</p>
          ${groups.map(g => {
            const j = mockJudgeFor(g, rep);
            return `<div class="border rounded-xl p-3 space-y-1 ${j.cls}">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] font-extrabold truncate">${escapeHtml(g.groupName || g.groupId)}</p>
                <span class="shrink-0 text-[11px] font-extrabold border rounded-md px-1.5 py-0.5 bg-white/70">${j.label}</span>
              </div>
              <p class="text-[10px] font-bold">集計単位: ${escapeHtml(g.unitLabel || "全体")} ／ 受験者数 N=${Number(g.applicants) || 0}</p>
              <p class="text-[10px]">志望者平均 ${g.avgScore === null || g.avgScore === undefined ? "-" : g.avgScore} ／ 志望者内 ${g.myRank === null || g.myRank === undefined ? "-" : g.myRank}位${g.percentileWithin === null || g.percentileWithin === undefined ? "" : `（上位${Math.max(0, Math.round(100 - Number(g.percentileWithin)))}%）`}</p>
              <p class="text-[10px] opacity-80">${j.note}</p>
            </div>`;
          }).join("")}
          <p class="text-[10px] text-slate-400 leading-relaxed">判定は偏差値・志望者内順位・大学tierの組み合わせ。N&lt;5 は「判定保留（暫定）」です。</p>
        </div>`);
      }

      const all = (rep && rep.allGroups) || [];
      if (all.length) {
        parts.push(`<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <p class="text-xs font-bold text-slate-700">🏫 全大学×文理群の目安一覧（${all.length}群）</p>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            ${all.map((g, i) => {
              const cat = (mockGroupDef(g.groupId) || {}).category || g.category || "その他";
              const prevDef = i > 0 ? (mockGroupDef(all[i - 1].groupId) || {}) : {};
              const prevCat = i > 0 ? (prevDef.category || all[i - 1].category || "その他") : "";
              const head = cat !== prevCat ? `<p class="text-[10px] font-extrabold text-slate-500 pt-1">${escapeHtml(cat)}</p>` : "";
              return head + `<div class="flex items-center justify-between gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              <span class="min-w-0 truncate font-bold text-slate-700">${escapeHtml(g.groupName || g.groupId)}</span>
              <span class="shrink-0 text-slate-500 tabular-nums">志望 ${Number(g.applicants) || 0}人 ／ 平均 ${g.avgScore === null || g.avgScore === undefined ? "-" : g.avgScore}${g.provisional ? "（参考）" : ""}</span>
            </div>`;
            }).join("")}
          </div>
        </div>`);
      }

      wrap.innerHTML = parts.join("");
    }

    function startMockCountdown(exam) {
      stopMockCountdown();
      const tick = () => {
        const el = document.getElementById("mock-countdown");
        if (!el) return;
        const phase = mockPhase(exam);
        if (phase === "before") el.textContent = `⏳ 開始まで ${mockFormatCountdown(Date.parse(exam.start_at) - Date.now())}`;
        else if (phase === "open") el.textContent = `🔴 終了まで ${mockFormatCountdown(Date.parse(exam.end_at) - Date.now())}`;
        else el.textContent = "受付終了";
        if (mockCountdownPhase && phase !== mockCountdownPhase) {
          mockCountdownPhase = phase;
          renderMockExamScreen();
        } else {
          mockCountdownPhase = phase;
        }
      };
      tick();
      mockCountdownTimer = setInterval(tick, 1000);
    }

    function stopMockCountdown() {
      if (mockCountdownTimer) { clearInterval(mockCountdownTimer); mockCountdownTimer = null; }
    }

    function renderMockExamScreen() {
      const notice = document.getElementById("mock-auth-notice");
      const main = document.getElementById("mock-main");
      if (!notice || !main) return;
      // ログインしていなくても受験できる（全国集計への提出だけがログイン限定）
      notice.className = "";
      main.classList.remove("hidden");
      if (mockIsReady()) {
        notice.innerHTML = `<p class="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 leading-relaxed">✅ ログイン中：結果は全国集計に提出され、偏差値・順位・志望校判定が確定します。</p>`;
      } else if (supabaseClient) {
        notice.innerHTML = `<div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
          <p class="text-sm font-bold text-indigo-900">🚀 ログインなしで受験できます</p>
          <p class="text-[11px] text-indigo-800 leading-relaxed">模試の受験・採点・復習はこのまま使えます。ログインすると結果が全国集計に提出され、偏差値・順位・志望校判定が表示されます。</p>
          <button type="button" onclick="navigate('screen-social')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer">ログインして全国集計に参加</button>
        </div>`;
      } else {
        notice.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
          <p class="text-sm font-bold text-amber-900">🎯 オフライン練習模試</p>
          <p class="text-[11px] text-amber-800 leading-relaxed">この端末では Supabase が未設定のため全国集計は使えませんが、端末内の単語から作った練習模試（30問・20分）を受験できます。結果はこの端末に保存されます。</p>
        </div>`;
      }
      if (!mockExamsLoaded && !mockBusy) loadMockExams();
      mockRenderExamList();
      const exam = mockCurrentExam();
      const detail = document.getElementById("mock-exam-detail");
      if (!exam) {
        if (detail) detail.classList.add("hidden");
        return;
      }
      if (detail) detail.classList.remove("hidden");
      mockRenderStatus(exam);
      mockRenderEntrySection(exam);
      mockRenderActionSection(exam);
      mockRenderReportSection(exam);
      startMockCountdown(exam);
    }

    // 結果カード（html2canvas）に模試成績を流し込んで保存する
    async function downloadMockResultImage() {
      const exam = mockCurrentExam();
      const rep = mockReport || mockLocalReport;
      if (!exam || !rep || !rep.me || !rep.me.result) { showToast("成績表がまだありません"); return; }
      const card = document.getElementById("result-share-card");
      if (!card || typeof html2canvas !== "function") { showToast("この端末では画像生成に対応していません"); return; }
      const result = rep.me.result;
      const total = Math.max(1, Number(result.total) || 1);
      const score = Number(result.score) || 0;
      const accuracy = Math.round(score / total * 100);
      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setText("shc-kicker", "MOCK EXAM RESULT");
      setText("shc-title", getFullTitle());
      setText("shc-title-note", exam.title || "全国一斉模試");
      setText("shc-level", `Lv.${userData.level}`);
      setText("shc-player-title", getFullTitle());
      setText("shc-exp", `偏差値 ${rep.me.deviation === null || rep.me.deviation === undefined ? "-" : rep.me.deviation}`);
      setText("shc-rate", String(accuracy));
      setText("shc-rate-small", String(accuracy));
      setText("shc-score", String(score));
      setText("shc-score-total", `/${total}`);
      setText("shc-combo", "-");
      setText("shc-coins", result.is_late ? "参考記録" : "正規受験");
      setText("shc-range", `${exam.range_label || exam.title || ""}${rep.stats ? `・N=${rep.stats.n || 0}` : ""}`);
      setText("shc-date", getTodayString().replace(/-/g, "."));
      const avatar = document.getElementById("shc-avatar");
      if (avatar) applyFrameStyle(avatar, userData.equippedFrame, "shc-avatar-tile");
      const delta = document.getElementById("shc-delta");
      if (delta) delta.className = "shc-delta shc-hidden";
      const streak = document.getElementById("shc-streak");
      if (streak) streak.classList.add("shc-hidden");
      const list = document.getElementById("shc-mistakes");
      if (list) list.innerHTML = "";
      const mistakes = (mockLastMistakes || []).slice(0, 6);
      const wrap = document.getElementById("shc-mistakes-wrap");
      if (wrap) wrap.classList.toggle("shc-hidden", mistakes.length === 0);
      setText("shc-mistakes-count", mistakes.length ? `${mockLastMistakes.length} 語` : "");
      mistakes.forEach(w => {
        if (!list) return;
        const li = document.createElement("li");
        li.className = "shc-mistake";
        li.innerHTML = `<span class="shc-mistake-word">${escapeHtml(w.word)}<span class="shc-mistake-id">#${w.id}</span></span>`
          + `<span class="shc-mistake-meaning">${escapeHtml(w.meaning || "")}</span>`;
        list.appendChild(li);
      });
      showToast("スクリーンショットを生成中...");
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const canvas = await html2canvas(card, {
          scale: 2, backgroundColor: null, logging: false, useCORS: true,
          width: 440, height: card.offsetHeight, windowWidth: 440, windowHeight: card.offsetHeight
        });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        if (!blob) { showToast("結果カードを生成できませんでした"); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `LEAP_Mock_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("画像を保存しました！");
      } catch (err) {
        console.error(err);
        showToast("画像の生成に失敗しました");
      }
    }
