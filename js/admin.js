/* LEAP 管理ダッシュボード（admin.html 専用）
   - Supabase Auth（メール＋パスワード）でログインし、admin_users に登録された UID のみ操作できる
   - お知らせ（announcements）の作成・編集・削除
   - 意見箱（feedback）の一覧・状態変更・管理メモ
   - パスワードや service_role キーは扱わない（anon key + RLS） */

(function () {
  const cfg = window.LEAP_SUPABASE_CONFIG || {};
  const ready = !!(cfg.url && cfg.anonKey && window.supabase && typeof window.supabase.createClient === "function");
  let client = null;
  if (ready) {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (e) {
      console.warn("[admin] init failed", e);
      client = null;
    }
  }

  const $ = (id) => document.getElementById(id);
  const state = {
    session: null,
    announcements: [],
    feedback: [],
    mockExams: [],
    mockResults: [],
    mockEntries: [],
    editingAnnouncementId: null,
    editingMockId: null,
    tab: "announcements",
    busy: false
  };

  const CATEGORY_LABEL = {
    opinion: "💬 感想",
    request: "💡 要望",
    bug: "🐞 不具合",
    praise: "👏 称賛",
    other: "📝 その他"
  };
  const STATUS_LABEL = { new: "新規", reading: "確認中", done: "対応済み", archived: "アーカイブ" };
  const STATUS_CLASS = {
    new: "text-rose-700 bg-rose-50 border-rose-200",
    reading: "text-amber-800 bg-amber-50 border-amber-200",
    done: "text-emerald-800 bg-emerald-50 border-emerald-200",
    archived: "text-slate-600 bg-slate-100 border-slate-200"
  };
  const LEVEL_LABEL = { info: "通常", warning: "重要", success: "キャンペーン" };
  const LEVEL_CLASS = {
    info: "text-sky-800 bg-sky-50 border-sky-200",
    warning: "text-amber-800 bg-amber-50 border-amber-200",
    success: "text-emerald-800 bg-emerald-50 border-emerald-200"
  };

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function toast(message) {
    const el = $("admin-toast");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("opacity-0");
    el.classList.add("opacity-100");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      el.classList.add("opacity-0");
      el.classList.remove("opacity-100");
    }, 2200);
  }

  function confirmDialog(message, okText) {
    return new Promise((resolve) => {
      const modal = $("admin-confirm");
      const msg = $("admin-confirm-message");
      const ok = $("admin-confirm-ok");
      const cancel = $("admin-confirm-cancel");
      if (!modal || !msg || !ok || !cancel) { resolve(window.confirm(message)); return; }
      msg.textContent = message;
      ok.textContent = okText || "OK";
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      const done = (value) => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        ok.onclick = null;
        cancel.onclick = null;
        resolve(value);
      };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
    });
  }

  function setLoginMessage(text, isError) {
    const el = $("admin-login-message");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
    el.classList.toggle("text-rose-600", !!isError);
    el.classList.toggle("text-emerald-600", !isError && !!text);
  }

  function setGlobalMessage(text, isError) {
    const el = $("admin-global-message");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
    el.classList.remove("bg-rose-50", "text-rose-700", "bg-emerald-50", "text-emerald-700");
    if (text) {
      el.classList.add(isError ? "bg-rose-50" : "bg-emerald-50");
      el.classList.add(isError ? "text-rose-700" : "text-emerald-700");
    }
  }

  function schemaHint(error) {
    const code = error && error.code;
    const msg = String((error && error.message) || "");
    if (code === "42P01" || code === "PGRST205" || /does not exist|Could not find the table/i.test(msg)) {
      return "Supabase に管理用スキーマが未適用です。supabase/schema.sql の追記分を SQL Editor で実行してください。";
    }
    if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
      return "権限がありません。admin_users に自分の UID が登録されているか確認してください。";
    }
    return msg || "通信エラーが発生しました。";
  }

  function fmtDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function toLocalInput(value) {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function announcementState(a) {
    const now = Date.now();
    const published = Date.parse(a.published_at || "");
    const expires = a.expires_at ? Date.parse(a.expires_at) : null;
    if (Number.isFinite(published) && published > now) return { label: "公開予定", cls: "text-sky-800 bg-sky-50 border-sky-200" };
    if (expires && expires <= now) return { label: "掲載終了", cls: "text-slate-500 bg-slate-100 border-slate-200" };
    return { label: "公開中", cls: "text-emerald-800 bg-emerald-50 border-emerald-200" };
  }

  // ===== 認証 =====
  async function checkAdmin() {
    if (!client) return false;
    try {
      const { data, error } = await client.rpc("is_admin");
      if (error) throw error;
      return data === true;
    } catch (e) {
      console.warn("[admin] is_admin", e);
      setLoginMessage(schemaHint(e), true);
      return false;
    }
  }

  async function showApp(session) {
    state.session = session;
    const login = $("admin-login");
    const app = $("admin-app");
    if (login) login.classList.add("hidden");
    if (app) app.classList.remove("hidden");
    const user = $("admin-user");
    if (user) {
      user.textContent = session.user.email || session.user.id.slice(0, 8);
      user.classList.remove("hidden");
    }
    const logout = $("admin-logout");
    if (logout) logout.classList.remove("hidden");
    setLoginMessage("");
    await Promise.all([loadAnnouncements(), loadFeedback(), loadMockExams()]);
  }

  function showLogin() {
    state.session = null;
    const login = $("admin-login");
    const app = $("admin-app");
    if (login) login.classList.remove("hidden");
    if (app) app.classList.add("hidden");
    const user = $("admin-user");
    if (user) user.classList.add("hidden");
    const logout = $("admin-logout");
    if (logout) logout.classList.add("hidden");
  }

  async function tryRestoreSession() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    const session = data && data.session;
    if (!session) { showLogin(); return; }
    const ok = await checkAdmin();
    if (ok) await showApp(session);
    else {
      await client.auth.signOut();
      showLogin();
      setLoginMessage("このアカウントには管理者権限がありません。", true);
    }
  }

  function bindAuthUi() {
    const form = $("admin-login-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!client) { setLoginMessage("Supabase が設定されていません（supabase_config.js）。", true); return; }
        const email = String(($("admin-email") || {}).value || "").trim();
        const password = String(($("admin-password") || {}).value || "");
        const btn = $("admin-login-btn");
        if (!email || !password) { setLoginMessage("メールアドレスとパスワードを入力してください。", true); return; }
        if (btn) { btn.disabled = true; btn.textContent = "ログイン中…"; }
        setLoginMessage("");
        try {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          const ok = await checkAdmin();
          if (!ok) {
            await client.auth.signOut();
            throw new Error("このアカウントには管理者権限がありません。admin_users を確認してください。");
          }
          await showApp(data.session);
          toast("ログインしました");
        } catch (err) {
          console.warn("[admin] login", err);
          const msg = /Invalid login credentials/i.test(String(err.message || ""))
            ? "メールアドレスまたはパスワードが違います。"
            : schemaHint(err);
          setLoginMessage(msg, true);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = "ログイン"; }
        }
      });
    }
    const logout = $("admin-logout");
    if (logout) {
      logout.addEventListener("click", async () => {
        if (!client) return;
        await client.auth.signOut();
        showLogin();
        toast("ログアウトしました");
      });
    }
  }

  // ===== タブ =====
  function switchTab(tab) {
    state.tab = ["announcements", "feedback", "mock"].includes(tab) ? tab : "announcements";
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      const on = btn.dataset.adminTab === state.tab;
      btn.classList.toggle("is-active", on);
      btn.classList.toggle("text-slate-600", !on);
    });
    const ann = $("panel-announcements");
    const fb = $("panel-feedback");
    const mock = $("panel-mock");
    if (ann) ann.classList.toggle("hidden", state.tab !== "announcements");
    if (fb) fb.classList.toggle("hidden", state.tab !== "feedback");
    if (mock) mock.classList.toggle("hidden", state.tab !== "mock");
    if (state.tab === "mock" && (!state.mockExams || state.mockExams.length === 0)) {
      loadMockExams();
    }
  }

  // ===== お知らせ =====
  function resetAnnouncementForm() {
    state.editingAnnouncementId = null;
    ["ann-id", "ann-title", "ann-body", "ann-expires"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
    const level = $("ann-level");
    if (level) level.value = "info";
    const pinned = $("ann-pinned");
    if (pinned) pinned.checked = false;
    const published = $("ann-published");
    if (published) published.value = "";
    const title = $("ann-form-title");
    if (title) title.textContent = "お知らせを作成";
    const reset = $("ann-reset");
    if (reset) reset.classList.add("hidden");
    const msg = $("ann-message");
    if (msg) msg.textContent = "";
  }

  function fillAnnouncementForm(a) {
    state.editingAnnouncementId = a.id;
    const setv = (id, v) => { const el = $(id); if (el) el.value = v; };
    setv("ann-id", a.id);
    setv("ann-title", a.title || "");
    setv("ann-body", a.body || "");
    setv("ann-level", a.level || "info");
    setv("ann-published", a.published_at ? toLocalInput(a.published_at) : "");
    setv("ann-expires", a.expires_at ? toLocalInput(a.expires_at) : "");
    const pinned = $("ann-pinned");
    if (pinned) pinned.checked = !!a.pinned;
    const title = $("ann-form-title");
    if (title) title.textContent = "お知らせを編集";
    const reset = $("ann-reset");
    if (reset) reset.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadAnnouncements() {
    if (!client) return;
    const list = $("ann-list");
    if (list) list.innerHTML = `<p class="text-[11px] text-slate-400">読み込み中…</p>`;
    try {
      const { data, error } = await client.from("announcements").select("*")
        // 旧サービス（content 列を使用）のお知らせを LEAP の管理対象に混ぜない
        .not("body", "is", null)
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      state.announcements = Array.isArray(data) ? data : [];
      renderAnnouncements();
    } catch (e) {
      console.warn("[admin] announcements", e);
      if (list) list.innerHTML = `<p class="text-[11px] font-bold text-rose-600">${escapeHtml(schemaHint(e))}</p>`;
    }
  }

  function renderAnnouncements() {
    const list = $("ann-list");
    if (!list) return;
    if (!state.announcements.length) {
      list.innerHTML = `<p class="text-[11px] text-slate-400">まだお知らせがありません。上のフォームから作成してください。</p>`;
      return;
    }
    list.innerHTML = state.announcements.map((a) => {
      const st = announcementState(a);
      const preview = String(a.body || "").replace(/\s+/g, " ").slice(0, 120);
      return `<div class="border border-slate-200 rounded-xl p-3 space-y-1.5 bg-slate-50">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[12px] font-extrabold text-slate-900 break-words">${escapeHtml(a.title)}</p>
            <p class="text-[10px] text-slate-400">${fmtDateTime(a.published_at)}${a.expires_at ? ` 〜 ${fmtDateTime(a.expires_at)}` : ""}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${a.pinned ? `<span class="text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">📌</span>` : ""}
            <span class="text-[9px] font-extrabold border rounded-full px-1.5 py-0.5 ${st.cls}">${st.label}</span>
            <span class="text-[9px] font-extrabold border rounded-full px-1.5 py-0.5 ${LEVEL_CLASS[a.level] || LEVEL_CLASS.info}">${LEVEL_LABEL[a.level] || a.level}</span>
          </div>
        </div>
        <p class="text-[11px] text-slate-600 leading-relaxed">${escapeHtml(preview)}${String(a.body || "").length > 120 ? "…" : ""}</p>
        <div class="flex gap-2 pt-1">
          <button type="button" data-ann-edit="${a.id}" class="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer">編集</button>
          <button type="button" data-ann-delete="${a.id}" class="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 text-[10px] font-bold rounded-lg cursor-pointer">削除</button>
        </div>
      </div>`;
    }).join("");
  }

  async function saveAnnouncement() {
    if (!client || !state.session) return;
    const title = String(($("ann-title") || {}).value || "").trim();
    const body = String(($("ann-body") || {}).value || "").trim();
    const level = String(($("ann-level") || {}).value || "info");
    const msg = $("ann-message");
    if (!title || !body) {
      if (msg) msg.textContent = "タイトルと本文は必須です。";
      return;
    }
    if (body.length > 4000) {
      if (msg) msg.textContent = "本文は4000文字までです。";
      return;
    }
    const publishedRaw = String(($("ann-published") || {}).value || "");
    const expiresRaw = String(($("ann-expires") || {}).value || "");
    const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (isNaN(publishedAt.getTime())) { if (msg) msg.textContent = "公開日時の形式が正しくありません。"; return; }
    if (expiresAt && isNaN(expiresAt.getTime())) { if (msg) msg.textContent = "掲載終了日時の形式が正しくありません。"; return; }
    if (expiresAt && expiresAt.getTime() <= publishedAt.getTime()) { if (msg) msg.textContent = "掲載終了は公開日時より後にしてください。"; return; }
    if (msg) msg.textContent = "";
    const publishedIso = publishedAt.toISOString();
    const expiresIso = expiresAt ? expiresAt.toISOString() : null;
    const payload = {
      title: title.slice(0, 120),
      body: body.slice(0, 4000),
      level: ["info", "warning", "success"].includes(level) ? level : "info",
      pinned: !!($("ann-pinned") || {}).checked,
      published_at: publishedIso,
      expires_at: expiresIso
    };
    if (!state.editingAnnouncementId) payload.created_by = state.session.user.id;

    // 旧サービスとの共用テーブル（publish_start / content の NOT NULL 制約）対策
    const compatPayload = Object.assign({}, payload, {
      content: body.slice(0, 4000),
      publish_start: publishedIso,
      publish_end: expiresIso
    });

    const btn = $("ann-save");
    if (btn) { btn.disabled = true; btn.textContent = "保存中…"; }

    const executeSave = async (p) => {
      if (state.editingAnnouncementId) {
        return await client.from("announcements").update(p).eq("id", state.editingAnnouncementId);
      } else {
        return await client.from("announcements").insert(p);
      }
    };

    try {
      // まず互換カラム付き（publish_start / content）で試行
      let res = await executeSave(compatPayload);
      if (res.error) {
        const errMsg = String(res.error.message || "");
        // もしテーブルに publish_start カラムが存在しない新規環境なら基本 payload で再試行
        if (/does not exist|Could not find the.*column/i.test(errMsg)) {
          res = await executeSave(payload);
        }
      }
      if (res.error) throw res.error;

      toast(state.editingAnnouncementId ? "お知らせを更新しました" : "お知らせを作成しました");
      resetAnnouncementForm();
      await loadAnnouncements();
    } catch (e) {
      console.warn("[admin] save announcement", e);
      if (msg) msg.textContent = schemaHint(e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "保存する"; }
    }
  }

  async function deleteAnnouncement(id) {
    if (!client) return;
    const target = state.announcements.find((a) => a.id === id);
    const ok = await confirmDialog(`「${target ? target.title : "このお知らせ"}」を削除しますか？\nこの操作は取り消せません。`, "削除する");
    if (!ok) return;
    try {
      const { error } = await client.from("announcements").delete().eq("id", id);
      if (error) throw error;
      if (state.editingAnnouncementId === id) resetAnnouncementForm();
      toast("削除しました");
      await loadAnnouncements();
    } catch (e) {
      console.warn("[admin] delete announcement", e);
      toast(schemaHint(e));
    }
  }

  function bindAnnouncementUi() {
    const save = $("ann-save");
    if (save) save.addEventListener("click", saveAnnouncement);
    const reset = $("ann-reset");
    if (reset) reset.addEventListener("click", resetAnnouncementForm);
    const refresh = $("ann-refresh");
    if (refresh) refresh.addEventListener("click", loadAnnouncements);
    const list = $("ann-list");
    if (list) {
      list.addEventListener("click", (e) => {
        const edit = e.target.closest("[data-ann-edit]");
        if (edit) {
          const a = state.announcements.find((x) => x.id === edit.dataset.annEdit);
          if (a) fillAnnouncementForm(a);
          return;
        }
        const del = e.target.closest("[data-ann-delete]");
        if (del) deleteAnnouncement(del.dataset.annDelete);
      });
    }
  }

  // ===== 意見箱 =====
  async function loadFeedback() {
    if (!client) return;
    const list = $("fb-list");
    if (list) list.innerHTML = `<p class="text-[11px] text-slate-400">読み込み中…</p>`;
    try {
      const { data, error } = await client.from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      state.feedback = Array.isArray(data) ? data : [];
      renderFeedback();
    } catch (e) {
      console.warn("[admin] feedback", e);
      if (list) list.innerHTML = `<p class="text-[11px] font-bold text-rose-600">${escapeHtml(schemaHint(e))}</p>`;
    }
  }

  function filteredFeedback() {
    const cat = String(($("fb-category") || {}).value || "");
    const status = String(($("fb-status") || {}).value || "");
    const q = String(($("fb-q") || {}).value || "").trim().toLowerCase();
    return state.feedback.filter((f) => {
      if (cat && f.category !== cat) return false;
      if (status && f.status !== status) return false;
      if (q) {
        const hay = `${f.body || ""} ${f.contact || ""} ${f.page || ""} ${f.admin_note || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderFeedback() {
    const list = $("fb-list");
    if (!list) return;
    const rows = filteredFeedback();
    const count = $("fb-count");
    if (count) count.textContent = `${rows.length} 件 / 全 ${state.feedback.length} 件（新しい順・最大300件）`;
    if (!rows.length) {
      list.innerHTML = `<p class="text-[11px] text-slate-400">該当する意見はありません。</p>`;
      return;
    }
    list.innerHTML = rows.map((f) => {
      const status = STATUS_LABEL[f.status] ? f.status : "new";
      const stars = f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "";
      return `<div class="border border-slate-200 rounded-xl p-3 space-y-2 bg-white" data-fb-card="${f.id}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[11px] font-extrabold text-slate-800">${CATEGORY_LABEL[f.category] || f.category}
              ${stars ? `<span class="text-amber-500 ml-1">${stars}</span>` : ""}
            </p>
            <p class="text-[10px] text-slate-400">${fmtDateTime(f.created_at)}${f.page ? ` ・ ${escapeHtml(f.page)}` : ""}${f.subject ? ` ・ ${escapeHtml(f.subject)}` : ""}</p>
          </div>
          <span class="shrink-0 text-[9px] font-extrabold border rounded-full px-1.5 py-0.5 ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>
        </div>
        <p class="pre-wrap text-[12px] text-slate-700 leading-relaxed">${escapeHtml(f.body || "")}</p>
        ${f.contact ? `<p class="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 break-all">連絡先: ${escapeHtml(f.contact)}</p>` : ""}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <select data-fb-select="${f.id}" class="p-2 border border-slate-300 rounded-lg bg-white text-[11px] font-bold">
            <option value="new"${status === "new" ? " selected" : ""}>新規</option>
            <option value="reading"${status === "reading" ? " selected" : ""}>確認中</option>
            <option value="done"${status === "done" ? " selected" : ""}>対応済み</option>
            <option value="archived"${status === "archived" ? " selected" : ""}>アーカイブ</option>
          </select>
          <textarea data-fb-note="${f.id}" rows="2" placeholder="管理メモ（ユーザーには表示されません）" class="sm:col-span-2 p-2 border border-slate-300 rounded-lg text-[11px]">${escapeHtml(f.admin_note || "")}</textarea>
        </div>
        <div class="flex justify-end">
          <button type="button" data-fb-save="${f.id}" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg cursor-pointer">保存</button>
        </div>
      </div>`;
    }).join("");
  }

  async function saveFeedback(id) {
    if (!client) return;
    const select = document.querySelector(`[data-fb-select="${id}"]`);
    const note = document.querySelector(`[data-fb-note="${id}"]`);
    const status = select ? select.value : "new";
    const adminNote = note ? note.value.slice(0, 2000) : "";
    try {
      const { error } = await client.from("feedback").update({ status, admin_note: adminNote }).eq("id", id);
      if (error) throw error;
      const row = state.feedback.find((f) => f.id === id);
      if (row) { row.status = status; row.admin_note = adminNote; }
      renderFeedback();
      toast("意見を更新しました");
    } catch (e) {
      console.warn("[admin] save feedback", e);
      toast(schemaHint(e));
    }
  }

  function bindFeedbackUi() {
    ["fb-category", "fb-status"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("change", renderFeedback);
    });
    const q = $("fb-q");
    if (q) q.addEventListener("input", renderFeedback);
    const refresh = $("fb-refresh");
    if (refresh) refresh.addEventListener("click", loadFeedback);
    const list = $("fb-list");
    if (list) {
      list.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-fb-save]");
        if (btn) saveFeedback(btn.dataset.fbSave);
      });
    }
  }

  // ===== 模試管理 =====
  function formatIsoForInput(date) {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function resetMockForm() {
    state.editingMockId = null;
    const idEl = $("mock-id");
    const titleEl = $("mock-title");
    const subEl = $("mock-subject");
    const durEl = $("mock-duration");
    const startEl = $("mock-start");
    const endEl = $("mock-end");
    const qidsEl = $("mock-qids");
    const msgEl = $("mock-message");
    const formTitle = $("mock-form-title");
    const saveBtn = $("mock-save");
    const resetBtn = $("mock-reset");
    const qBadge = $("mock-qcount-badge");

    if (idEl) idEl.value = "";
    if (titleEl) titleEl.value = "";
    if (subEl) subEl.value = "leap";
    if (durEl) durEl.value = "1500";
    if (qidsEl) qidsEl.value = "";
    if (msgEl) msgEl.textContent = "";
    if (formTitle) formTitle.textContent = "新規模試の作成";
    if (saveBtn) saveBtn.textContent = "模試を保存・公開する";
    if (resetBtn) resetBtn.classList.add("hidden");
    if (qBadge) qBadge.textContent = "0 問選択中";

    // 既定の開始日時（明日の9:00）と終了日時（14日後の23:59）
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 23, 59);
    if (startEl) startEl.value = formatIsoForInput(start);
    if (endEl) endEl.value = formatIsoForInput(end);
  }

  function generateMockQuestions() {
    const rangeVal = $("mock-preset-range") ? $("mock-preset-range").value : "all";
    const countVal = $("mock-preset-count") ? parseInt($("mock-preset-count").value, 10) : 50;
    const subVal = $("mock-subject") ? $("mock-subject").value : "leap";

    let pool = [];
    if (subVal === "kobun") {
      for (let i = 10001; i <= 10150; i++) pool.push(i);
    } else {
      let minId = 1, maxId = 2000;
      if (rangeVal === "part1") { minId = 1; maxId = 400; }
      else if (rangeVal === "part2") { minId = 401; maxId = 1000; }
      else if (rangeVal === "part3") { minId = 1001; maxId = 1400; }
      else if (rangeVal === "part4") { minId = 1401; maxId = 2000; }
      else if (rangeVal === "part1_2") { minId = 1; maxId = 1000; }
      else if (rangeVal === "part3_4") { minId = 1001; maxId = 2000; }
      else { minId = 1; maxId = 2000; }

      for (let i = minId; i <= maxId; i++) pool.push(i);
    }

    // シャッフル
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = pool.slice(0, Math.min(countVal, pool.length)).sort((a, b) => a - b);
    const qidsEl = $("mock-qids");
    if (qidsEl) qidsEl.value = selected.join(", ");
    const qBadge = $("mock-qcount-badge");
    if (qBadge) qBadge.textContent = `${selected.length} 問選択中`;
    toast(`${selected.length} 問の単語を自動抽出しました`);
  }

  async function loadMockExams() {
    if (!client) return;
    const list = $("mock-exams-list");
    if (list) list.innerHTML = `<p class="text-[11px] text-slate-400">模試データと成績を集約中…</p>`;

    try {
      // 1. 模試一覧
      const { data: exams, error: examsErr } = await client
        .from("mock_exams")
        .select("*")
        .order("start_at", { ascending: false });
      if (examsErr) throw examsErr;

      // 2. 受験結果
      let results = [];
      try {
        const { data: rData, error: rErr } = await client
          .from("mock_exam_results")
          .select("id, exam_id, user_id, score, total, elapsed_sec, is_late, submitted_at, profiles:user_id(display_name, friend_code)");
        if (!rErr && rData) results = rData;
      } catch (e) {
        console.warn("[admin] load mock results", e);
      }

      // 3. エントリー一覧
      let entries = [];
      try {
        const { data: eData, error: eErr } = await client
          .from("mock_exam_entries")
          .select("id, exam_id, user_id");
        if (!eErr && eData) entries = eData;
      } catch (e) {
        console.warn("[admin] load mock entries", e);
      }

      state.mockExams = exams || [];
      state.mockResults = results;
      state.mockEntries = entries;
      renderMockExams();
    } catch (e) {
      console.warn("[admin] load mock exams", e);
      if (list) list.innerHTML = `<p class="text-[11px] text-rose-600 font-bold">${escapeHtml(schemaHint(e))}</p>`;
    }
  }

  function renderMockExams() {
    const list = $("mock-exams-list");
    if (!list) return;

    if (!state.mockExams || state.mockExams.length === 0) {
      list.innerHTML = `<div class="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">登録されている模試がありません。「新規模試の作成」フォームから作成してください。</div>`;
      return;
    }

    const now = Date.now();

    list.innerHTML = state.mockExams.map((exam) => {
      const startMs = new Date(exam.start_at).getTime();
      const endMs = new Date(exam.end_at).getTime();
      let statusBadge = "";
      if (now < startMs) {
        statusBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">開催前（エントリー受付中）</span>`;
      } else if (now <= endMs) {
        statusBadge = `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse">● 開催中（本番実施中）</span>`;
      } else {
        statusBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">終了（成績確定）</span>`;
      }

      const qids = Array.isArray(exam.question_ids) ? exam.question_ids : [];
      const examResults = (state.mockResults || []).filter((r) => r.exam_id === exam.id);
      const examEntries = (state.mockEntries || []).filter((e) => e.exam_id === exam.id);

      const entryCount = examEntries.length;
      const totalSubmitted = examResults.length;
      const regularResults = examResults.filter((r) => !r.is_late);
      const lateCount = examResults.filter((r) => r.is_late).length;

      // 成績集約
      let avgScore = 0;
      let avgPct = 0;
      let maxScore = 0;
      let minScore = 0;
      let avgSec = 0;

      if (regularResults.length > 0) {
        const scores = regularResults.map((r) => r.score);
        avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        const totalQ = regularResults[0].total || qids.length || 50;
        avgPct = Math.round((avgScore / totalQ) * 100);
        maxScore = Math.max(...scores);
        minScore = Math.min(...scores);
        avgSec = Math.round(regularResults.reduce((a, b) => a + (b.elapsed_sec || 0), 0) / regularResults.length);
      }

      const durMin = Math.round((exam.duration_sec || 1500) / 60);

      // 受験者一覧テーブルの行
      const userRows = examResults.map((r, idx) => {
        const prof = r.profiles || {};
        const name = prof.display_name || "名無し受験生";
        const code = prof.friend_code ? `#${prof.friend_code}` : "";
        const m = Math.floor((r.elapsed_sec || 0) / 60);
        const s = (r.elapsed_sec || 0) % 60;
        const timeStr = `${m}分${s}秒`;
        const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
        const subDate = r.submitted_at ? new Date(r.submitted_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/80 text-[11px]">
            <td class="py-1.5 px-2 font-mono text-slate-400 text-center">${idx + 1}</td>
            <td class="py-1.5 px-2 font-bold text-slate-800">
              <span>${escapeHtml(name)}</span>
              <span class="text-[9px] font-normal text-slate-400 font-mono ml-1">${escapeHtml(code)}</span>
            </td>
            <td class="py-1.5 px-2 text-center font-black text-indigo-600">${r.score} / ${r.total}</td>
            <td class="py-1.5 px-2 text-center font-bold text-emerald-600">${pct}%</td>
            <td class="py-1.5 px-2 text-center text-slate-500 font-mono">${timeStr}</td>
            <td class="py-1.5 px-2 text-center text-[10px] text-slate-400">${escapeHtml(subDate)}</td>
            <td class="py-1.5 px-2 text-center">
              ${r.is_late
                ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">遅延提出</span>`
                : `<span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">正規</span>`}
            </td>
          </tr>
        `;
      }).join("");

      return `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${statusBadge}
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${exam.subject === 'kobun' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}">
                  ${exam.subject === 'kobun' ? '古文' : 'LEAP 英単語'}
                </span>
                <span class="text-[10px] text-slate-400">${qids.length}問 / 制限${durMin}分</span>
              </div>
              <h3 class="text-sm font-extrabold text-slate-900">${escapeHtml(exam.title)}</h3>
              <p class="text-[11px] text-slate-500 font-mono">
                📅 ${new Date(exam.start_at).toLocaleString("ja-JP")} 〜 ${new Date(exam.end_at).toLocaleString("ja-JP")}
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" data-mock-edit="${exam.id}" class="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">編集</button>
              <button type="button" data-mock-delete="${exam.id}" class="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer">削除</button>
            </div>
          </div>

          <!-- 集約成績カード -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <span class="text-[9px] text-slate-400 block">エントリー数</span>
              <span class="text-sm font-black text-slate-800">${entryCount}名</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block">総受験者数</span>
              <span class="text-sm font-black text-indigo-600">${totalSubmitted}名</span>
              <span class="text-[9px] text-slate-400 block">(正規${regularResults.length} / 遅延${lateCount})</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block">平均点 (正答率)</span>
              <span class="text-sm font-black text-emerald-600">${regularResults.length ? avgScore : '---'}点</span>
              <span class="text-[9px] text-slate-400 block">${regularResults.length ? '(' + avgPct + '%)' : ''}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block">最高点 / 最低点</span>
              <span class="text-sm font-black text-slate-800">${regularResults.length ? maxScore + ' / ' + minScore : '---'}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block">平均所要時間</span>
              <span class="text-sm font-black text-slate-700">${regularResults.length ? Math.floor(avgSec / 60) + '分' + (avgSec % 60) + '秒' : '---'}</span>
            </div>
          </div>

          <!-- 受験者詳細アコーディオン -->
          <div class="pt-1">
            <button type="button" data-mock-toggle-users="${exam.id}" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer">
              <span>👥 受験者一覧・成績詳細 (${examResults.length}名)</span>
              <span class="text-[10px]">▼</span>
            </button>
            <div id="mock-users-wrap-${exam.id}" class="hidden mt-2 border border-slate-200 rounded-xl overflow-hidden">
              ${examResults.length === 0
                ? `<div class="p-4 text-center text-slate-400 text-xs">まだ受験したユーザーはいません。</div>`
                : `
                  <div class="overflow-x-auto max-h-60 overflow-y-auto">
                    <table class="w-full text-left border-collapse">
                      <thead class="bg-slate-100 text-[10px] text-slate-500 font-bold sticky top-0">
                        <tr>
                          <th class="py-1.5 px-2 text-center">#</th>
                          <th class="py-1.5 px-2">ユーザー</th>
                          <th class="py-1.5 px-2 text-center">得点</th>
                          <th class="py-1.5 px-2 text-center">正答率</th>
                          <th class="py-1.5 px-2 text-center">所要時間</th>
                          <th class="py-1.5 px-2 text-center">提出日時</th>
                          <th class="py-1.5 px-2 text-center">区分</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${userRows}
                      </tbody>
                    </table>
                  </div>
                `}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function editMockExam(id) {
    const exam = state.mockExams.find((e) => e.id === id);
    if (!exam) return;
    state.editingMockId = id;

    const idEl = $("mock-id");
    const titleEl = $("mock-title");
    const subEl = $("mock-subject");
    const durEl = $("mock-duration");
    const startEl = $("mock-start");
    const endEl = $("mock-end");
    const qidsEl = $("mock-qids");
    const formTitle = $("mock-form-title");
    const saveBtn = $("mock-save");
    const resetBtn = $("mock-reset");
    const qBadge = $("mock-qcount-badge");

    if (idEl) idEl.value = exam.id;
    if (titleEl) titleEl.value = exam.title;
    if (subEl) subEl.value = exam.subject || "leap";
    if (durEl) durEl.value = String(exam.duration_sec || 1500);
    if (startEl) startEl.value = formatIsoForInput(exam.start_at);
    if (endEl) endEl.value = formatIsoForInput(exam.end_at);
    const qids = Array.isArray(exam.question_ids) ? exam.question_ids : [];
    if (qidsEl) qidsEl.value = qids.join(", ");
    if (qBadge) qBadge.textContent = `${qids.length} 問選択中`;

    if (formTitle) formTitle.textContent = "模試を編集";
    if (saveBtn) saveBtn.textContent = "模試の変更を保存する";
    if (resetBtn) resetBtn.classList.remove("hidden");

    const form = $("panel-mock");
    if (form) form.scrollIntoView({ behavior: "smooth" });
  }

  async function saveMockExam() {
    if (!client) return;
    const msg = $("mock-message");
    if (msg) msg.textContent = "";

    const title = $("mock-title")?.value.trim();
    const subject = $("mock-subject")?.value || "leap";
    const durationSec = parseInt($("mock-duration")?.value, 10) || 1500;
    const startVal = $("mock-start")?.value;
    const endVal = $("mock-end")?.value;
    const qidsRaw = $("mock-qids")?.value.trim() || "";

    if (!title) {
      if (msg) msg.textContent = "タイトルを入力してください。";
      return;
    }
    if (!startVal || !endVal) {
      if (msg) msg.textContent = "開始日時と終了日時を指定してください。";
      return;
    }
    const startAt = new Date(startVal).toISOString();
    const endAt = new Date(endVal).toISOString();
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      if (msg) msg.textContent = "終了日時は開始日時より後に設定してください。";
      return;
    }

    const qids = qidsRaw.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n > 0);
    if (qids.length < 5) {
      if (msg) msg.textContent = "出題単語IDを最低5語（推奨50問）入力してください。";
      return;
    }

    // 想定正答率（expected_rates）を自動計算
    const expectedRates = qids.map((_, i) => Math.round((0.45 + 0.35 * (i / Math.max(qids.length - 1, 1))) * 1000) / 1000);
    const rangeLabel = `${subject === 'kobun' ? '古文' : 'LEAP'}（${qids.length}問）`;

    const payload = {
      title,
      subject,
      range_label: rangeLabel,
      question_ids: qids,
      expected_rates: expectedRates,
      start_at: startAt,
      end_at: endAt,
      duration_sec: durationSec
    };

    const btn = $("mock-save");
    if (btn) { btn.disabled = true; btn.textContent = "保存中…"; }

    try {
      if (state.editingMockId) {
        const { error } = await client.from("mock_exams").update(payload).eq("id", state.editingMockId);
        if (error) throw error;
        toast("模試を更新しました！");
      } else {
        const { error } = await client.from("mock_exams").insert(payload);
        if (error) throw error;
        toast("新規模試を登録・公開しました！");
      }
      resetMockForm();
      await loadMockExams();
    } catch (e) {
      console.warn("[admin] save mock exam", e);
      if (msg) msg.textContent = schemaHint(e);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.editingMockId ? "模試の変更を保存する" : "模試を保存・公開する";
      }
    }
  }

  async function deleteMockExam(id) {
    if (!client) return;
    const exam = state.mockExams.find((e) => e.id === id);
    const title = exam ? exam.title : "この模試";
    const ok = await confirmDialog(`「${title}」を削除しますか？\n※ 関連する受験者エントリーや提出結果もすべて削除されます。`, "削除する");
    if (!ok) return;

    try {
      const { error } = await client.from("mock_exams").delete().eq("id", id);
      if (error) throw error;
      toast("模試を削除しました");
      if (state.editingMockId === id) resetMockForm();
      await loadMockExams();
    } catch (e) {
      console.warn("[admin] delete mock exam", e);
      toast(schemaHint(e));
    }
  }

  function bindMockUi() {
    const genBtn = $("mock-generate-btn");
    if (genBtn) genBtn.addEventListener("click", generateMockQuestions);

    const saveBtn = $("mock-save");
    if (saveBtn) saveBtn.addEventListener("click", saveMockExam);

    const resetBtn = $("mock-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetMockForm);

    const refreshBtn = $("mock-refresh");
    if (refreshBtn) refreshBtn.addEventListener("click", loadMockExams);

    const qidsEl = $("mock-qids");
    if (qidsEl) {
      qidsEl.addEventListener("input", () => {
        const qids = qidsEl.value.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n > 0);
        const qBadge = $("mock-qcount-badge");
        if (qBadge) qBadge.textContent = `${qids.length} 問選択中`;
      });
    }

    const list = $("mock-exams-list");
    if (list) {
      list.addEventListener("click", (e) => {
        const editBtn = e.target.closest("[data-mock-edit]");
        if (editBtn) {
          editMockExam(editBtn.dataset.mockEdit);
          return;
        }
        const delBtn = e.target.closest("[data-mock-delete]");
        if (delBtn) {
          deleteMockExam(delBtn.dataset.mockDelete);
          return;
        }
        const toggleUsersBtn = e.target.closest("[data-mock-toggle-users]");
        if (toggleUsersBtn) {
          const examId = toggleUsersBtn.dataset.mockToggleUsers;
          const wrap = $(`mock-users-wrap-${examId}`);
          if (wrap) wrap.classList.toggle("hidden");
        }
      });
    }
  }

  // ===== 初期化 =====
  function init() {
    bindAuthUi();
    bindAnnouncementUi();
    bindFeedbackUi();
    bindMockUi();
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.adminTab));
    });
    resetAnnouncementForm();
    resetMockForm();

    if (!ready || !client) {
      setLoginMessage("Supabase が未設定です。supabase_config.js に URL と anon key を設定してください。", true);
      const btn = $("admin-login-btn");
      if (btn) btn.disabled = true;
      return;
    }
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") showLogin();
    });
    tryRestoreSession().catch((e) => {
      console.warn("[admin] restore", e);
      showLogin();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
