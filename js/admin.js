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
    editingAnnouncementId: null,
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
    await Promise.all([loadAnnouncements(), loadFeedback()]);
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
    state.tab = tab === "feedback" ? "feedback" : "announcements";
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      const on = btn.dataset.adminTab === state.tab;
      btn.classList.toggle("is-active", on);
      btn.classList.toggle("text-slate-600", !on);
    });
    const ann = $("panel-announcements");
    const fb = $("panel-feedback");
    if (ann) ann.classList.toggle("hidden", state.tab !== "announcements");
    if (fb) fb.classList.toggle("hidden", state.tab !== "feedback");
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
    const payload = {
      title: title.slice(0, 120),
      body: body.slice(0, 4000),
      level: ["info", "warning", "success"].includes(level) ? level : "info",
      pinned: !!($("ann-pinned") || {}).checked,
      published_at: publishedAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null
    };
    if (!state.editingAnnouncementId) payload.created_by = state.session.user.id;
    const btn = $("ann-save");
    if (btn) { btn.disabled = true; btn.textContent = "保存中…"; }
    try {
      if (state.editingAnnouncementId) {
        const { error } = await client.from("announcements").update(payload).eq("id", state.editingAnnouncementId);
        if (error) throw error;
        toast("お知らせを更新しました");
      } else {
        const { error } = await client.from("announcements").insert(payload);
        if (error) throw error;
        toast("お知らせを作成しました");
      }
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

  // ===== 初期化 =====
  function init() {
    bindAuthUi();
    bindAnnouncementUi();
    bindFeedbackUi();
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.adminTab));
    });
    resetAnnouncementForm();

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
