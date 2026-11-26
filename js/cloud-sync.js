/* provides: Supabase 認証・クラウド同期・フレンド（設定・OAuth ログイン・クラウド同期・共有・招待・フレンド比較）
   requires: core.js（currentSubject / LEAP_SOURCE / KOBUN_SOURCE / navigate / showToast / showAlert / showConfirm）
             supabase_config.js と Supabase JS v2 CDN（任意。未設定ならローカルのみで動作）
             mock-exam.js（scheduleLinkedMockExam）、index.html の userData / quizState / startQuizWithPool 等。
             いずれも呼び出し時の参照のみで、読み込み順には依存しない。
   note: index.html のインライン JS から Stage 2 として切り出し（コードは無改変）。 */
    // ============================================================
    // ☁️ Supabase: 認証・クラウド同期・フレンド
    // ============================================================
    // ▼▼ 設定: Supabase ダッシュボード → Project Settings → API の値をここへ ▼▼
    // 設定は supabase_config.js に集約（admin.html と共有）
    const SUPABASE_CONFIG = window.LEAP_SUPABASE_CONFIG || { url: "", anonKey: "" };
    // ▲▲ 未設定でもエラーにならず、従来のローカルモードで動作する ▲▲

    // プロバイダを増やすときはこの配列に追加するだけでログインボタンが増える。
    // LINE は Supabase の組み込みプロバイダではなく、Custom OAuth Provider「custom:line」として設定する。
    const OAUTH_PROVIDERS = [
      { id: "google", label: "Google でログイン", icon: "🔵", className: "bg-slate-900 hover:bg-slate-800 text-white" },
      { id: "custom:line", label: "LINE でログイン", icon: "💬", className: "bg-[#06C755] hover:bg-[#05b34c] text-white" }
    ];

    const CLOUD_META_KEY = "LEAP_CLOUD_META_V1";
    const CLOUD_SHARE_KEY = "LEAP_CLOUD_SHARE_DETAILS_V1";
    const CLOUD_NAME_KEY = "LEAP_CLOUD_DISPLAY_NAME_V1";
    const CLOUD_INVITE_KEY = "LEAP_PENDING_INVITE_V1";
    const FRIEND_CODE_RE = /^LEAP-[A-Z0-9]{4}$/;

    let supabaseClient = null;
    const SUPABASE_READY = !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey
      && window.supabase && typeof window.supabase.createClient === "function");
    if (SUPABASE_READY) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
        });
      } catch (e) {
        console.warn("[cloud] Supabase の初期化に失敗しました", e);
        supabaseClient = null;
      }
    }
    const CLOUD_ENABLED = !!supabaseClient;

    const cloudState = {
      user: null,
      profile: null,
      shareDetailedLogs: true,
      viewingSelf: false,
      syncing: false,
      pendingPush: false,
      lastSyncedAt: "",
      socialTab: "friends",
      friends: [],
      incoming: [],
      outgoing: [],
      progressMap: {},
      profileMap: {},
      activeFriendId: null,
      bootstrapFor: null,
      pendingInvite: ""
    };
    let cloudConflictResolver = null;
    let cloudPushTimer = null;

    function cloudNum(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
    // escapeHtml は js/core.js に集約（重複を解消）
    function getLocalDisplayName() { try { return (localStorage.getItem(CLOUD_NAME_KEY) || "").trim(); } catch (e) { return ""; } }
    function cloudDisplayName() {
      const custom = getLocalDisplayName();
      if (custom) return custom.slice(0, 40);
      return (((userData && userData.prefix) || "") + ((userData && userData.suffix) || "")).slice(0, 40);
    }
    function formatCloudTime(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    // PostgREST は timestamptz を "...+00:00" で返し、保存値は "...Z" 形式になる。
    // 文字列比較では必ず不一致になるため、時刻として許容誤差つきで比較する。
    function sameCloudInstant(a, b) {
      const ta = Date.parse(a || "");
      const tb = Date.parse(b || "");
      if (isNaN(ta) || isNaN(tb)) return String(a || "") === String(b || "");
      return Math.abs(ta - tb) < 2000;
    }
    function savePendingInvite(code) {
      if (!code) return;
      try { localStorage.setItem(CLOUD_INVITE_KEY, String(code).toUpperCase()); } catch (e) {}
    }
    function takePendingInvite() {
      try {
        const code = localStorage.getItem(CLOUD_INVITE_KEY) || "";
        if (code) localStorage.removeItem(CLOUD_INVITE_KEY);
        return code;
      } catch (e) { return ""; }
    }
    function clearPendingInvite() {
      try { localStorage.removeItem(CLOUD_INVITE_KEY); } catch (e) {}
    }
    function readCloudMeta() { try { const m = JSON.parse(localStorage.getItem(CLOUD_META_KEY) || "null"); return (m && typeof m === "object") ? m : {}; } catch (e) { return {}; } }
    function writeCloudMeta(uid, at) { try { localStorage.setItem(CLOUD_META_KEY, JSON.stringify({ userId: uid, lastPushedAt: at })); } catch (e) {} }
    function persistShareFlag() { try { localStorage.setItem(CLOUD_SHARE_KEY, cloudState.shareDetailedLogs ? "1" : "0"); } catch (e) {} }
    function generateFriendCode() {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = "";
      for (let i = 0; i < 4; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
      return "LEAP-" + out;
    }

    // ---- 集計（自分・フレンド共通） ----
    function tallyWordIds(ids, stats) {
      const map = stats || {};
      let unlearned = 0, weak = 0, learning = 0, mastered = 0, answered = 0, correct = 0;
      (ids || []).forEach((id) => {
        const s = map[id];
        if (!s || !cloudNum(s.total)) { unlearned += 1; return; }
        const total = cloudNum(s.total);
        const cor = cloudNum(s.correct);
        answered += total;
        correct += cor;
        const pct = total ? Math.round((cor / total) * 100) : 0;
        if (cor >= 3 && pct >= 90) mastered += 1;
        else if (pct < 50) weak += 1;
        else learning += 1;
      });
      const total = (ids || []).length;
      return {
        total, unlearned, weak, learning, mastered, answered, correct,
        rate: total ? Math.round((mastered / total) * 100) : 0,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0
      };
    }

    function computeProgressSummary(data) {
      const d = data || {};
      const stats = d.wordStats || {};
      const leap = tallyWordIds(LEAP_SOURCE.map(w => w.id), stats);
      const kobun = tallyWordIds(KOBUN_SOURCE.map(w => w.id), stats);
      const answered = leap.answered + kobun.answered;
      const correct = leap.correct + kobun.correct;
      const total = leap.total + kobun.total;
      return {
        leap, kobun, answered, correct,
        total,
        masterRate: total ? Math.round(((leap.mastered + kobun.mastered) / total) * 100) : 0,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0
      };
    }

    function buildCloudQuickStats(data, ach) {
      const d = data || {};
      const summary = computeProgressSummary(d);
      const prefixCount = Array.isArray(d.purchasedPrefixes) ? d.purchasedPrefixes.length : 0;
      const suffixCount = Array.isArray(d.purchasedSuffixes) ? d.purchasedSuffixes.length : 0;
      const frameCount = Array.isArray(d.ownedFrames) ? d.ownedFrames.length : 0;
      const avatarCount = Array.isArray(d.ownedAvatars) ? d.ownedAvatars.length : 0;
      const itemsTotal = PREFIX_TITLES.length + SUFFIX_TITLES.length + FRAME_ITEMS.length + AVATAR_ITEMS.length;
      const itemsOwned = prefixCount + suffixCount + frameCount + avatarCount;
      const achievements = Array.isArray(ach) ? ach.length : 0;
      return {
        level: getLevelState(cloudNum(d.exp)).level,
        streak: cloudNum(d.streak),
        masterRate: summary.masterRate,
        masterRateLeap: summary.leap.rate,
        masterRateKobun: summary.kobun.rate,
        accuracy: summary.accuracy,
        answered: summary.answered,
        correct: summary.correct,
        maxCombo: cloudNum(d.maxComboEver),
        totalQuizzes: cloudNum(d.totalQuizzes),
        achievements,
        achievementsTotal: ACHIEVEMENTS.length,
        achievementRate: ACHIEVEMENTS.length ? Math.round((achievements / ACHIEVEMENTS.length) * 100) : 0,
        items: itemsOwned,
        itemsTotal,
        itemRate: itemsTotal ? Math.round((itemsOwned / itemsTotal) * 100) : 0,
        coins: cloudNum(d.coins),
        updatedAt: new Date().toISOString()
      };
    }

    function localHasProgress() {
      const stats = (userData && userData.wordStats) || {};
      return Object.keys(stats).length > 0 || cloudNum(userData.totalQuizzes) > 0
        || cloudNum(userData.coins) > 0 || (Array.isArray(unlockedAchievements) && unlockedAchievements.length > 0);
    }

    function progressHasData(data) {
      if (!data || typeof data !== "object") return false;
      const stats = data.wordStats || {};
      return Object.keys(stats).length > 0 || cloudNum(data.totalQuizzes) > 0 || cloudNum(data.coins) > 0;
    }

    // ---- プロフィール ----
    async function ensureCloudProfile() {
      const uid = cloudState.user.id;
      const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) throw error;
      if (data) return data;
      let lastError = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateFriendCode();
        const { data: created, error: insertError } = await supabaseClient.from("profiles").insert({
          id: uid,
          friend_code: code,
          display_name: cloudDisplayName(),
          equipped_avatar: userData.equippedAvatar || "",
          equipped_frame: userData.equippedFrame || "",
          prefix: userData.prefix || "",
          suffix: userData.suffix || "",
          quick_stats: buildCloudQuickStats(userData, unlockedAchievements)
        }).select("*").single();
        if (!insertError && created) return created;
        lastError = insertError;
        // トリガー等で既に作成済みの場合は再取得
        const retry = await supabaseClient.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (retry.data) return retry.data;
      }
      throw lastError || new Error("プロフィールを作成できませんでした");
    }

    // ---- クラウド読み書き ----
    async function cloudFetchProgress(uid) {
      const { data, error } = await supabaseClient.from("user_progress").select("*").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      return data || null;
    }

    function applyCloudProgress(row) {
      if (!row || !row.user_data || typeof row.user_data !== "object") return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(row.user_data));
        unlockedAchievements = Array.isArray(row.achievements) ? row.achievements.slice() : [];
        saveAchievements();
        loadUserData();
        sanitizeAchievements();
        updateUserUI();
        updateAchievementCount();
        cloudState.shareDetailedLogs = row.share_detailed_logs !== false;
        persistShareFlag();
        showToast("☁️ クラウドの学習データを復元しました");
      } catch (e) { console.warn("[cloud] apply", e); }
    }

    function mergeProgressData(localData, cloudData, localAch, cloudAch) {
      const a = (localData && typeof localData === "object") ? localData : {};
      const b = (cloudData && typeof cloudData === "object") ? cloudData : {};
      const merged = Object.assign({}, a);
      ["coins", "exp", "totalQuizzes", "maxComboEver", "dailyClears", "reviewClears", "streak", "readerRuns"].forEach((k) => {
        merged[k] = Math.max(cloudNum(a[k]), cloudNum(b[k]));
      });
      ["lastPlayDate", "lastDailyDate"].forEach((k) => {
        merged[k] = String(a[k] || "") > String(b[k] || "") ? a[k] : b[k];
      });
      merged.voiceEnabled = a.voiceEnabled !== undefined ? a.voiceEnabled : b.voiceEnabled;
      merged.prefix = a.prefix || b.prefix;
      merged.suffix = a.suffix || b.suffix;
      ["purchasedPrefixes", "purchasedSuffixes", "ownedFrames", "ownedAvatars"].forEach((k) => {
        merged[k] = Array.from(new Set([...(Array.isArray(a[k]) ? a[k] : []), ...(Array.isArray(b[k]) ? b[k] : [])]));
      });
      merged.equippedFrame = a.equippedFrame || b.equippedFrame;
      merged.equippedAvatar = a.equippedAvatar || b.equippedAvatar;

      const as = a.wordStats || {}, bs = b.wordStats || {};
      const wordStats = {};
      new Set([...Object.keys(as), ...Object.keys(bs)]).forEach((id) => {
        const x = as[id] || { correct: 0, total: 0 };
        const y = bs[id] || { correct: 0, total: 0 };
        const useY = cloudNum(y.total) > cloudNum(x.total)
          || (cloudNum(y.total) === cloudNum(x.total) && cloudNum(y.correct) > cloudNum(x.correct));
        wordStats[id] = useY
          ? { correct: cloudNum(y.correct), total: cloudNum(y.total) }
          : { correct: cloudNum(x.correct), total: cloudNum(x.total) };
      });
      merged.wordStats = wordStats;

      const aw = a.weakWords || {}, bw = b.weakWords || {};
      const weakWords = {};
      new Set([...Object.keys(aw), ...Object.keys(bw)]).forEach((id) => {
        const x = aw[id], y = bw[id];
        if (!x) { weakWords[id] = y; return; }
        if (!y) { weakWords[id] = x; return; }
        const pick = cloudNum(y.count) > cloudNum(x.count) ? y : x;
        weakWords[id] = Object.assign({}, pick, {
          nextReview: String(x.nextReview || "") < String(y.nextReview || "") ? x.nextReview : y.nextReview,
          source: (pick && pick.source) || "quiz"
        });
      });
      merged.weakWords = weakWords;

      const al = a.dailyLog || {}, bl = b.dailyLog || {};
      const dailyLog = {};
      new Set([...Object.keys(al), ...Object.keys(bl)]).forEach((k) => {
        dailyLog[k] = Math.max(cloudNum(al[k]), cloudNum(bl[k]));
      });
      merged.dailyLog = dailyLog;

      const exams = [...(Array.isArray(a.examHistory) ? a.examHistory : []), ...(Array.isArray(b.examHistory) ? b.examHistory : [])];
      const seenExams = new Set();
      merged.examHistory = exams.filter((x) => {
        const key = [x && x.subject, x && x.range, x && x.date, x && x.correct, x && x.total].join("|");
        if (seenExams.has(key)) return false;
        seenExams.add(key);
        return true;
      }).slice(0, 20);

      const hist = [...(Array.isArray(a.scoreHistory) ? a.scoreHistory : []), ...(Array.isArray(b.scoreHistory) ? b.scoreHistory : [])];
      const seen = new Set();
      merged.scoreHistory = hist.filter((h) => {
        const key = [h && h.date, h && h.score, h && h.total, h && h.range].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);

      const az = a.affixStats || {}, bz = b.affixStats || {};
      const affixStats = { rushBest: {}, memoryBest: {} };
      ["prefix", "suffix"].forEach((k) => {
        affixStats.rushBest[k] = Math.max(cloudNum((az.rushBest || {})[k]), cloudNum((bz.rushBest || {})[k]));
        const am = (az.memoryBest || {})[k];
        const bm = (bz.memoryBest || {})[k];
        const score = (m) => (!m || !cloudNum(m.moves)) ? Infinity : cloudNum(m.moves) * 10000 + cloudNum(m.seconds);
        affixStats.memoryBest[k] = score(am) <= score(bm) ? (am || { moves: 0, seconds: 0 }) : (bm || { moves: 0, seconds: 0 });
      });
      merged.affixStats = affixStats;

      const shared = [...(Array.isArray(a.sharedResults) ? a.sharedResults : []), ...(Array.isArray(b.sharedResults) ? b.sharedResults : [])];
      const seenShares = new Set();
      merged.sharedResults = shared.filter((s) => {
        if (!s || !s.id || seenShares.has(s.id)) return false;
        seenShares.add(s.id);
        return true;
      }).sort((x, y) => String(y.at || "").localeCompare(String(x.at || ""))).slice(0, 20);
      merged.level = getLevelState(merged.exp).level;

      const achievements = Array.from(new Set([
        ...(Array.isArray(localAch) ? localAch : []),
        ...(Array.isArray(cloudAch) ? cloudAch : [])
      ]));
      return { userData: merged, achievements };
    }

    function applyMergedProgress(row) {
      const merged = mergeProgressData(userData, row.user_data, unlockedAchievements, row.achievements);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.userData));
        unlockedAchievements = merged.achievements;
        saveAchievements();
        loadUserData();
        sanitizeAchievements();
        updateUserUI();
        updateAchievementCount();
        cloudState.shareDetailedLogs = row.share_detailed_logs !== false;
        persistShareFlag();
        showToast("🔀 端末とクラウドの学習データを統合しました");
      } catch (e) { console.warn("[cloud] merge", e); }
    }

    async function cloudPush(reason) {
      if (!supabaseClient || !cloudState.user) return false;
      if (cloudState.syncing) { cloudState.pendingPush = true; return false; }
      cloudState.syncing = true;
      cloudState.lastSyncedAt = "";
      renderCloudAccount();
      const uid = cloudState.user.id;
      const clientUpdatedAt = new Date().toISOString();
      try {
        const quick = buildCloudQuickStats(userData, unlockedAchievements);
        const code = (cloudState.profile && cloudState.profile.friend_code) || generateFriendCode();
        // トリガー未実行などでプロフィール行が無い場合でも落ちないよう upsert する
        const { error: profileError } = await supabaseClient.from("profiles").upsert({
          id: uid,
          friend_code: code,
          display_name: cloudDisplayName(),
          equipped_avatar: userData.equippedAvatar || "",
          equipped_frame: userData.equippedFrame || "",
          prefix: userData.prefix || "",
          suffix: userData.suffix || "",
          quick_stats: quick,
          updated_at: clientUpdatedAt
        }, { onConflict: "id" });
        if (profileError) throw profileError;

        const { error: progressError } = await supabaseClient.from("user_progress").upsert({
          user_id: uid,
          user_data: userData,
          achievements: unlockedAchievements,
          share_detailed_logs: cloudState.shareDetailedLogs,
          client_updated_at: clientUpdatedAt
        }, { onConflict: "user_id" });
        if (progressError) throw progressError;

        writeCloudMeta(uid, clientUpdatedAt);
        cloudState.lastSyncedAt = clientUpdatedAt;
        if (cloudState.profile) {
          cloudState.profile.friend_code = code;
          cloudState.profile.quick_stats = quick;
          cloudState.profile.display_name = cloudDisplayName();
        }
        if (reason === "manual") showToast("☁️ クラウドへ同期しました");
        return true;
      } catch (e) {
        console.warn("[cloud] push", e);
        if (reason === "manual") {
          showAlert({ title: "同期できませんでした", message: "通信状況と Supabase の設定を確認して、もう一度お試しください。\n（端末の学習データは失われていません）", icon: "☁️" });
        }
        return false;
      } finally {
        cloudState.syncing = false;
        renderCloudAccount();
        if (cloudState.pendingPush) {
          cloudState.pendingPush = false;
          setTimeout(() => cloudPush("auto"), 800);
        }
      }
    }

    function cloudPushSoon(reason) {
      if (!supabaseClient || !cloudState.user) return;
      clearTimeout(cloudPushTimer);
      cloudPushTimer = setTimeout(() => cloudPush(reason || "auto"), 600);
    }

    // ---- 競合解決 ----
    function showCloudConflictDialog() {
      return new Promise((resolve) => {
        const modal = document.getElementById("cloud-conflict-modal");
        if (!modal) { resolve("merge"); return; }
        cloudConflictResolver = resolve;
        modal.classList.remove("hidden");
        modal.classList.add("flex");
      });
    }
    function resolveCloudConflict(choice) {
      const modal = document.getElementById("cloud-conflict-modal");
      if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
      const resolve = cloudConflictResolver;
      cloudConflictResolver = null;
      if (resolve) resolve(choice || "merge");
    }

    // ---- 認証 ----
    async function bootstrapCloudUser() {
      if (!supabaseClient || !cloudState.user) return;
      const uid = cloudState.user.id;
      if (cloudState.bootstrapFor === uid) return;
      cloudState.bootstrapFor = uid;
      try {
        cloudState.profile = await ensureCloudProfile();
        const row = await cloudFetchProgress(uid);
        const meta = readCloudMeta();
        const alreadySynced = !!(row && meta.userId === uid && meta.lastPushedAt && sameCloudInstant(meta.lastPushedAt, row.client_updated_at));
        if (row) {
          cloudState.shareDetailedLogs = row.share_detailed_logs !== false;
          persistShareFlag();
        }
        const cloudHas = !!(row && progressHasData(row.user_data));
        if (cloudHas && localHasProgress() && !alreadySynced) {
          const choice = await showCloudConflictDialog();
          if (choice === "cloud") applyCloudProgress(row);
          else if (choice === "merge") applyMergedProgress(row);
        } else if (cloudHas) {
          applyCloudProgress(row);
        }
        await cloudPush("login");
        await loadSocialData();
        cleanAuthCallbackUrl();
        showToast("☁️ ログインしました。学習データを同期します");
        // OAuth リダイレクトを挟むと ?friend= が消えるため、保存しておいた招待を復元する
        if (!cloudState.pendingInvite) cloudState.pendingInvite = takePendingInvite();
        if (cloudState.pendingInvite) {
          const input = document.getElementById("friend-code-input");
          if (input && !input.value) input.value = cloudState.pendingInvite;
          cloudState.pendingInvite = "";
          clearPendingInvite();
          openAccount();
        }
      } catch (e) {
        console.warn("[cloud] bootstrap", e);
        // 次回の手動同期や再ログインで再試行できるようにガードを解放する
        cloudState.bootstrapFor = null;
        showToast("☁️ 同期の準備に失敗しました（ローカルデータはそのままです）");
      }
      renderCloudAccount();
      renderSocial();
    }

    async function cloudSignIn(provider) {
      if (!supabaseClient) {
        showAlert({ title: "クラウド未設定", message: "このアプリでは Supabase が未設定のため、ログインは利用できません。\n学習データは端末内に保存され、これまで通り遊べます。", icon: "☁️" });
        return;
      }
      const redirectTo = window.location.origin + window.location.pathname;
      const providerId = provider || "google";
      if (cloudState.pendingInvite) savePendingInvite(cloudState.pendingInvite);
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: providerId,
        options: { redirectTo }
      });
      if (error) {
        const hint = providerId === "custom:line"
          ? "\n\nLINE ログインは Supabase の Authentication → Sign In / Providers → Custom OAuth Providers で「custom:line」を作成すると使えます（docs/SUPABASE_SETUP.md 参照）。"
          : "";
        showAlert({ title: "ログインできませんでした", message: "時間をおいて再度お試しください。\n" + (error.message || "") + hint, icon: "⚠️" });
      }
    }

    async function cloudSignOut() {
      if (!supabaseClient) return;
      const ok = await showConfirm({
        title: "ログアウトしますか？",
        message: "この端末の学習データは残ります。次回ログイン時に同期できます。",
        okText: "ログアウト",
        cancelText: "キャンセル",
        icon: "🚪"
      });
      if (!ok) return;
      try { await supabaseClient.auth.signOut(); } catch (e) {}
      cloudState.user = null;
      cloudState.profile = null;
      cloudState.bootstrapFor = null;
      cloudState.friends = [];
      cloudState.incoming = [];
      cloudState.outgoing = [];
      cloudState.progressMap = {};
      cloudState.profileMap = {};
      cloudState.lastSyncedAt = "";
      renderCloudAccount();
      renderSocial();
      showToast("ログアウトしました");
    }

    async function cloudSyncNow() {
      if (!supabaseClient || !cloudState.user) {
        showToast("ログインするとクラウド同期を使えます");
        openAccount();
        return;
      }
      await cloudPush("manual");
      await loadSocialData();
      renderCloudAccount();
      renderSocial();
    }

    // OAuth 失敗時（プロバイダ未設定・redirect URL 不一致など）は URL のエラーを画面で知らせる
    function checkAuthErrorParam() {
      try {
        const url = new URL(window.location.href);
        let desc = url.searchParams.get("error_description") || url.searchParams.get("error") || "";
        if (!desc && url.hash && url.hash.length > 1) {
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
          desc = hashParams.get("error_description") || hashParams.get("error") || "";
        }
        if (!desc) return;
        let readable = String(desc).replace(/\+/g, " ");
        try { readable = decodeURIComponent(readable); } catch (e) {}
        showAlert({
          title: "ログインできませんでした",
          message: readable + "\n\nSupabase と各プロバイダーの設定は docs/SUPABASE_SETUP.md を確認してください。",
          icon: "⚠️"
        });
        ["error", "error_code", "error_description"].forEach(k => url.searchParams.delete(k));
        url.hash = "";
        history.replaceState(history.state, "", url.pathname + (url.search ? url.search : ""));
      } catch (e) {}
    }

    function cleanAuthCallbackUrl() {
      try {
        const url = new URL(window.location.href);
        let changed = false;
        if (url.searchParams.has("code")) { url.searchParams.delete("code"); changed = true; }
        if (url.hash && url.hash.indexOf("access_token") >= 0) { url.hash = ""; changed = true; }
        if (changed) history.replaceState(history.state, "", url.pathname + (url.search ? url.search : ""));
      } catch (e) {}
    }

    // ---- 招待・コピー ----
    function copyTextToClipboard(text) {
      return new Promise((resolve) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => resolve(fallbackCopyText(text)));
        } else {
          resolve(fallbackCopyText(text));
        }
      });
    }
    function fallbackCopyText(text) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e) { return false; }
    }
    async function copyFriendCode() {
      const code = cloudState.profile && cloudState.profile.friend_code;
      if (!code) { showToast("フレンドコードを取得中です"); return; }
      await copyTextToClipboard(code);
      showToast("フレンドコードをコピーしました");
    }
    async function shareFriendInvite() {
      const code = cloudState.profile && cloudState.profile.friend_code;
      if (!code) { showToast("フレンドコードを取得中です"); return; }
      const url = window.location.origin + window.location.pathname + "?friend=" + encodeURIComponent(code);
      if (navigator.share) {
        try {
          await navigator.share({ title: "LEAP Quiz フレンド招待", text: `フレンドコード ${code} で申請してね！`, url });
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
      await copyTextToClipboard(url);
      showToast("招待リンクをコピーしました");
    }

    function checkFriendInviteParam() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("friend") || params.get("f");
        if (!code) return;
        cloudState.pendingInvite = String(code).toUpperCase();
        const input = document.getElementById("friend-code-input");
        if (input) input.value = cloudState.pendingInvite;
        if (cloudState.user) openAccount();
        else showToast("☁️ フレンド招待を開きました。ログインすると申請できます");
      } catch (e) {}
    }

    function openAccount() {
      navigate("screen-social");
      renderCloudAccount();
      renderSocial();
      if (supabaseClient && cloudState.user) {
        loadSocialData().then(() => { renderCloudAccount(); renderSocial(); }).catch(() => {});
      }
    }
    function refreshSocial() {
      if (!supabaseClient || !cloudState.user) return;
      loadSocialData().then(() => { renderCloudAccount(); renderSocial(); showToast("最新の情報に更新しました"); }).catch(() => {
        showToast("更新できませんでした");
      });
    }
    function openLocalPrivacySettings() {
      showAlert({
        title: "公開範囲の初期設定",
        message: "公開範囲はログイン後の「設定」タブで変更できます。\n初期値は「詳細ログも公開」です。",
        icon: "⚙️"
      });
    }

    // ---- フレンド取得 ----
    async function loadSocialData() {
      if (!supabaseClient || !cloudState.user) return;
      const uid = cloudState.user.id;
      const { data: rows, error } = await supabaseClient.from("friendships").select("*");
      if (error) throw error;
      const all = Array.isArray(rows) ? rows : [];
      const accepted = all.filter(r => r.status === "accepted");
      const incoming = all.filter(r => r.status === "pending" && r.addressee_id === uid);
      const outgoing = all.filter(r => r.status === "pending" && r.requester_id === uid);
      const friendIds = Array.from(new Set(accepted.map(r => r.requester_id === uid ? r.addressee_id : r.requester_id)));
      const profileIds = Array.from(new Set([...friendIds, ...incoming.map(r => r.requester_id), ...outgoing.map(r => r.addressee_id)]));

      let profiles = [];
      if (profileIds.length) {
        const res = await supabaseClient.from("profiles").select("*").in("id", profileIds);
        if (!res.error) profiles = res.data || [];
      }
      let progress = [];
      if (friendIds.length) {
        const res = await supabaseClient.from("user_progress").select("*").in("user_id", friendIds);
        if (!res.error) progress = res.data || [];
      }

      cloudState.profileMap = {};
      profiles.forEach(p => { cloudState.profileMap[p.id] = p; });
      cloudState.progressMap = {};
      progress.forEach(r => { cloudState.progressMap[r.user_id] = r; });
      const make = (row, otherId) => ({
        id: row.id,
        userId: otherId,
        profile: cloudState.profileMap[otherId] || null,
        progress: cloudState.progressMap[otherId] || null
      });
      cloudState.friends = accepted.map(r => make(r, r.requester_id === uid ? r.addressee_id : r.requester_id));
      cloudState.incoming = incoming.map(r => make(r, r.requester_id));
      cloudState.outgoing = outgoing.map(r => make(r, r.addressee_id));
    }

    // ---- 表示 ----
    function renderCloudAccount() {
      const signedIn = !!(cloudState.user && supabaseClient);
      const outEl = document.getElementById("cloud-signed-out");
      const inEl = document.getElementById("cloud-signed-in");
      if (outEl) outEl.classList.toggle("hidden", signedIn);
      if (inEl) inEl.classList.toggle("hidden", !signedIn);

      const btnState = document.getElementById("account-btn-state");
      if (btnState) {
        if (!CLOUD_ENABLED) btnState.textContent = "ローカルのみ";
        else if (signedIn) btnState.textContent = cloudState.syncing ? "同期中…" : "ログイン中";
        else btnState.textContent = "未ログイン";
        btnState.className = "text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 " +
          (signedIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500");
      }

      const note = document.getElementById("cloud-unavailable-note");
      if (note) {
        note.classList.toggle("hidden", CLOUD_ENABLED);
        note.textContent = "クラウド機能は未設定です。supabase_config.js に URL と anon key を設定すると有効になります。今の学習データは端末内に保存され、これまで通り遊べます。";
      }

      const wrap = document.getElementById("cloud-login-buttons");
      if (wrap && !wrap.dataset.rendered) {
        wrap.dataset.rendered = "1";
        wrap.innerHTML = OAUTH_PROVIDERS.map(p =>
          `<button type="button" onclick="cloudSignIn('${p.id}')" class="w-full py-3 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer ${p.className || "bg-slate-900 hover:bg-slate-800 text-white"}"><span>${p.icon}</span><span>${p.label}</span></button>`
        ).join("") + `<p class="text-[10px] text-slate-400 text-center leading-relaxed">ログイン情報は認証のみに使用します。学習データはあなたのアカウントにのみ保存されます。<br>LINE ログインは Supabase 側のカスタムプロバイダー設定が必要です。</p>`;
      }

      if (!signedIn) return;
      const emailEl = document.getElementById("cloud-account-email");
      if (emailEl) emailEl.textContent = cloudState.user.email || cloudState.user.id.slice(0, 8);
      const av = document.getElementById("cloud-account-avatar");
      if (av) applyFrameStyle(av, userData.equippedFrame, "w-12 h-12 text-2xl");
      const codeEl = document.getElementById("cloud-friend-code");
      if (codeEl) codeEl.textContent = (cloudState.profile && cloudState.profile.friend_code) || "----";
      const statusEl = document.getElementById("cloud-sync-status");
      if (statusEl) {
        if (cloudState.syncing) statusEl.textContent = "☁️ 同期中…";
        else if (cloudState.lastSyncedAt) statusEl.textContent = "✅ 同期済み（" + formatCloudTime(cloudState.lastSyncedAt) + "）";
        else statusEl.textContent = "☁️ 未同期";
      }
      const nameInput = document.getElementById("cloud-display-name-input");
      if (nameInput && document.activeElement !== nameInput) nameInput.value = getLocalDisplayName() || cloudDisplayName();
      renderPrivacyButtons();
    }

    function renderPrivacyButtons() {
      const full = document.getElementById("share-detail-btn-full");
      const summary = document.getElementById("share-detail-btn-summary");
      const active = "flex-1 py-2 text-[11px] font-bold rounded-lg bg-white shadow-sm text-slate-900 transition cursor-pointer";
      const idle = "flex-1 py-2 text-[11px] font-bold rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer";
      if (full) full.className = cloudState.shareDetailedLogs ? active : idle;
      if (summary) summary.className = cloudState.shareDetailedLogs ? idle : active;
    }

    function switchSocialTab(tab) {
      cloudState.socialTab = ["friends", "requests", "shares", "settings"].indexOf(tab) >= 0 ? tab : "friends";
      renderSocial();
    }

    function friendQuickStats(friend) {
      const qs = (friend && friend.profile && friend.profile.quick_stats) || {};
      if (qs && Object.keys(qs).length) return qs;
      return buildCloudQuickStats((friend && friend.progress && friend.progress.user_data) || {}, (friend && friend.progress && friend.progress.achievements) || []);
    }

    function friendTitle(profile) {
      if (!profile) return "学習者";
      const t = [profile.prefix, profile.suffix].filter(Boolean).join("");
      return t || profile.display_name || "学習者";
    }

    function friendAvatarHtml(profile, sizeClass) {
      const frame = getFrameItem(profile && profile.equipped_frame);
      const avatar = AVATAR_ITEMS.find(a => a.id === (profile && profile.equipped_avatar));
      const emoji = (avatar && avatar.emoji) || frame.emoji || "🦉";
      return `<div class="${sizeClass || "w-12 h-12"} rounded-2xl flex items-center justify-center text-2xl shrink-0 ${frame.box}">${emoji}</div>`;
    }

    function renderSocial() {
      const signedIn = !!cloudState.user;
      const tabs = { friends: "social-tab-friends", requests: "social-tab-requests", shares: "social-tab-shares", settings: "social-tab-settings" };
      const panels = { friends: "social-panel-friends", requests: "social-panel-requests", shares: "social-panel-shares", settings: "social-panel-settings" };
      const activeCls = "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition cursor-pointer";
      const idleCls = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer";
      Object.keys(tabs).forEach((k) => {
        const el = document.getElementById(tabs[k]);
        if (el) el.className = k === cloudState.socialTab ? activeCls : idleCls;
        const panel = document.getElementById(panels[k]);
        if (panel) panel.classList.toggle("hidden", k !== cloudState.socialTab);
      });
      const badge = document.getElementById("social-request-badge");
      if (badge) {
        badge.textContent = String(cloudState.incoming.length);
        badge.classList.toggle("hidden", cloudState.incoming.length === 0);
      }
      const shareRows = signedIn ? collectFriendShares() : [];
      // 「共有」タブを開いている間は既読扱いにする
      if (signedIn && cloudState.socialTab === "shares") {
        markSharesSeen(shareRows.map(r => r.entry.id));
      }
      const seenShareIds = new Set(getSeenShareIds());
      const unseenShares = shareRows.filter(r => !seenShareIds.has(r.entry.id)).length;
      const shareBadge = document.getElementById("social-share-badge");
      if (shareBadge) {
        shareBadge.textContent = String(unseenShares);
        shareBadge.classList.toggle("hidden", unseenShares === 0);
      }
      if (!signedIn) return;
      renderFriendList();
      renderRequestLists();
      renderSharedResults();
    }

    function renderFriendList() {
      const wrap = document.getElementById("social-friend-list");
      if (!wrap) return;
      if (!cloudState.friends.length) {
        wrap.innerHTML = `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center"><p class="text-2xl">👥</p><p class="text-xs font-bold text-slate-600 mt-2">まだフレンドがいません</p><p class="text-[11px] text-slate-400 mt-1">上のコード入力から申請してみましょう。</p></div>`;
        return;
      }
      wrap.innerHTML = cloudState.friends.map((f) => {
        const qs = friendQuickStats(f);
        return `<button type="button" onclick="openFriendDetail('${f.userId}')" class="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:bg-slate-50 transition cursor-pointer">
          <div class="flex items-center gap-3">
            ${friendAvatarHtml(f.profile)}
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-extrabold text-slate-900 truncate">${escapeHtml(friendTitle(f.profile))}</span>
                <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full shrink-0">Lv.${cloudNum(qs.level) || 1}</span>
              </div>
              <p class="text-[10px] text-slate-400 truncate mt-0.5">🔥 ${cloudNum(qs.streak)}日連続 ・ 📚 マスター ${cloudNum(qs.masterRate)}%</p>
              <p class="text-[10px] text-slate-400 truncate">🎯 正答率 ${cloudNum(qs.accuracy)}% ・ 🏆 実績 ${cloudNum(qs.achievements)}/${cloudNum(qs.achievementsTotal) || ACHIEVEMENTS.length}</p>
            </div>
            <span class="text-slate-300 text-sm shrink-0">›</span>
          </div>
        </button>`;
      }).join("");
    }

    function renderRequestLists() {
      const incomingWrap = document.getElementById("social-incoming-list");
      if (incomingWrap) {
        incomingWrap.innerHTML = cloudState.incoming.length ? cloudState.incoming.map((r) => `
          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
            ${friendAvatarHtml(r.profile, "w-10 h-10")}
            <div class="min-w-0 flex-1">
              <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(friendTitle(r.profile))}</p>
              <p class="text-[10px] text-slate-400">フレンド申請が届いています</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button type="button" onclick="respondFriendRequest('${r.id}', true)" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer">承認</button>
              <button type="button" onclick="respondFriendRequest('${r.id}', false)" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition cursor-pointer">拒否</button>
            </div>
          </div>`).join("") : `<p class="text-[11px] text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl p-4 text-center">受信した申請はありません。</p>`;
      }
      const outgoingWrap = document.getElementById("social-outgoing-list");
      if (outgoingWrap) {
        outgoingWrap.innerHTML = cloudState.outgoing.length ? cloudState.outgoing.map((r) => `
          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
            ${friendAvatarHtml(r.profile, "w-10 h-10")}
            <div class="min-w-0 flex-1">
              <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(friendTitle(r.profile))}</p>
              <p class="text-[10px] text-slate-400">承認待ち</p>
            </div>
            <button type="button" onclick="cancelFriendRequest('${r.id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition cursor-pointer shrink-0">取消</button>
          </div>`).join("") : `<p class="text-[11px] text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl p-4 text-center">送信した申請はありません。</p>`;
      }
    }

    // ---- フレンド操作 ----
    async function sendFriendRequest() {
      if (!supabaseClient || !cloudState.user) {
        showAlert({ title: "ログインが必要です", message: "フレンド機能を使うにはログインしてください。", icon: "☁️" });
        return;
      }
      const input = document.getElementById("friend-code-input");
      const raw = String(input ? input.value : "").trim().toUpperCase();
      const code = raw.indexOf("LEAP-") === 0 ? raw : "LEAP-" + raw;
      if (!FRIEND_CODE_RE.test(code)) {
        showAlert({ title: "コードの形式が違います", message: "「LEAP-XXXX」の形式で入力してください。", icon: "🔎" });
        return;
      }
      const uid = cloudState.user.id;
      if (cloudState.profile && cloudState.profile.friend_code === code) {
        showAlert({ title: "自分のコードです", message: "自分のフレンドコードには申請できません。", icon: "🙂" });
        return;
      }
      try {
        const foundRes = await supabaseClient.from("profiles").select("id, display_name, prefix, suffix, friend_code").eq("friend_code", code).maybeSingle();
        if (foundRes.error) throw foundRes.error;
        const found = foundRes.data;
        if (!found) {
          showAlert({ title: "見つかりません", message: `フレンドコード ${code} のユーザーが見つかりませんでした。コードを確認してください。`, icon: "🔎" });
          return;
        }
        const existingRes = await supabaseClient.from("friendships").select("*").or(`and(requester_id.eq.${uid},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${uid})`).maybeSingle();
        if (existingRes.error) throw existingRes.error;
        const existing = existingRes.data;
        if (existing) {
          if (existing.status === "accepted") {
            showAlert({ title: "すでにフレンドです", message: `${friendTitle(found)} さんとはフレンド関係にあります。`, icon: "🤝" });
            return;
          }
          if (existing.requester_id === found.id) {
            const ok = await showConfirm({ title: "申請が届いています", message: `${friendTitle(found)} さんから申請が届いています。承認しますか？`, okText: "承認する", icon: "📨", danger: false });
            if (ok) await respondFriendRequest(existing.id, true);
            return;
          }
          showAlert({ title: "申請済みです", message: "相手の承認待ちです。", icon: "⏳" });
          return;
        }
        const { error } = await supabaseClient.from("friendships").insert({ requester_id: uid, addressee_id: found.id, status: "pending" });
        if (error) throw error;
        if (input) input.value = "";
        showToast(`📨 ${friendTitle(found)} さんにフレンド申請を送りました`);
        await loadSocialData();
        renderSocial();
      } catch (e) {
        console.warn("[cloud] sendFriendRequest", e);
        showAlert({ title: "申請できませんでした", message: "通信状況を確認して、もう一度お試しください。", icon: "☁️" });
      }
    }

    async function respondFriendRequest(id, accept) {
      if (!supabaseClient || !cloudState.user) return;
      try {
        if (accept) {
          const { error } = await supabaseClient.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id).eq("addressee_id", cloudState.user.id);
          if (error) throw error;
          showToast("🤝 フレンドになりました");
        } else {
          const ok = await showConfirm({ title: "申請を拒否しますか？", message: "この申請は削除されます。", okText: "拒否する", icon: "🗑️" });
          if (!ok) return;
          const { error } = await supabaseClient.from("friendships").delete().eq("id", id);
          if (error) throw error;
          showToast("申請を削除しました");
        }
        await loadSocialData();
        renderCloudAccount();
        renderSocial();
      } catch (e) {
        console.warn("[cloud] respondFriendRequest", e);
        showAlert({ title: "操作できませんでした", message: "時間をおいて再度お試しください。", icon: "☁️" });
      }
    }

    async function cancelFriendRequest(id) {
      const ok = await showConfirm({ title: "申請を取り消しますか？", message: "送信したフレンド申請を削除します。", okText: "取り消す", icon: "↩️" });
      if (!ok) return;
      try {
        const { error } = await supabaseClient.from("friendships").delete().eq("id", id);
        if (error) throw error;
        showToast("申請を取り消しました");
        await loadSocialData();
        renderSocial();
      } catch (e) {
        showAlert({ title: "取り消せませんでした", message: "時間をおいて再度お試しください。", icon: "☁️" });
      }
    }

    async function removeActiveFriend() {
      const friend = cloudState.friends.find(f => f.userId === cloudState.activeFriendId);
      if (!friend) return;
      const ok = await showConfirm({ title: "フレンドを解除しますか？", message: "解除するとお互いの詳細ステータスは見られなくなります。", okText: "解除する", icon: "👋" });
      if (!ok) return;
      try {
        const { error } = await supabaseClient.from("friendships").delete().eq("id", friend.id);
        if (error) throw error;
        closeFriendDetail();
        showToast("フレンドを解除しました");
        await loadSocialData();
        renderSocial();
      } catch (e) {
        showAlert({ title: "解除できませんでした", message: "時間をおいて再度お試しください。", icon: "☁️" });
      }
    }

    async function saveDisplayName() {
      const input = document.getElementById("cloud-display-name-input");
      const name = String(input ? input.value : "").trim().slice(0, 20);
      try { localStorage.setItem(CLOUD_NAME_KEY, name); } catch (e) {}
      if (cloudState.profile) cloudState.profile.display_name = name || cloudDisplayName();
      renderCloudAccount();
      await cloudPush("profile");
      showToast("表示名を更新しました");
    }

    async function setShareDetailedLogs(value) {
      cloudState.shareDetailedLogs = !!value;
      persistShareFlag();
      renderPrivacyButtons();
      await cloudPush("privacy");
      showToast(cloudState.shareDetailedLogs ? "🔓 詳細ログをフレンドに公開します" : "🔒 集計とバッジのみ公開します");
    }

    // ---- フレンド詳細 ----
    function progressBarRow(label, t) {
      const pct = t.total ? Math.round((t.mastered / t.total) * 100) : 0;
      return `<div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] gap-2"><span class="font-bold text-slate-700 truncate">${escapeHtml(label)}</span><span class="text-slate-400 shrink-0 tabular-nums">マスター ${t.mastered}/${t.total} ・ ${pct}%</span></div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:${pct}%"></div></div>
        <div class="flex gap-3 text-[10px] text-slate-400"><span>未学習 ${t.unlearned}</span><span>学習中 ${t.learning}</span><span>苦手 ${t.weak}</span><span>マスター ${t.mastered}</span></div>
      </div>`;
    }

    function findWordById(id) {
      const n = Number(id);
      return LEAP_SOURCE.find(w => Number(w.id) === n) || KOBUN_SOURCE.find(w => Number(w.id) === n) || null;
    }

    function buildFriendWeakRanking(data) {
      const rows = [];
      const seen = new Set();
      const weakMap = (data && data.weakWords) || {};
      Object.keys(weakMap).forEach((id) => {
        const w = findWordById(id);
        if (!w) return;
        seen.add(String(id));
        const item = weakMap[id] || {};
        rows.push({ id: Number(id), word: w.word, meaning: w.meaning, count: cloudNum(item.count), accuracy: null });
      });
      const stats = (data && data.wordStats) || {};
      Object.keys(stats).forEach((id) => {
        if (seen.has(String(id))) return;
        const s = stats[id] || {};
        const total = cloudNum(s.total);
        if (total < 3) return;
        const pct = Math.round((cloudNum(s.correct) / total) * 100);
        if (pct >= 60) return;
        const w = findWordById(id);
        if (!w) return;
        rows.push({ id: Number(id), word: w.word, meaning: w.meaning, count: 0, accuracy: pct });
      });
      rows.sort((a, b) => (b.count - a.count) || ((a.accuracy === null ? 100 : a.accuracy) - (b.accuracy === null ? 100 : b.accuracy)));
      return rows.slice(0, 10);
    }

    function renderFriendDetail(friend) {
      const body = document.getElementById("friend-detail-body");
      if (!body) return;
      const p = friend.profile || {};
      const qs = friendQuickStats(friend);
      const progress = friend.progress || null;
      const data = (progress && progress.user_data) || {};
      const achIds = (progress && Array.isArray(progress.achievements)) ? progress.achievements : [];
      const summary = computeProgressSummary(data);
      const shared = !!progress && progress.share_detailed_logs !== false;

      const av = document.getElementById("friend-detail-avatar");
      if (av) {
        const frame = getFrameItem(p.equipped_frame);
        const avatar = AVATAR_ITEMS.find(a => a.id === p.equipped_avatar);
        av.className = "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 " + frame.box;
        av.textContent = (avatar && avatar.emoji) || frame.emoji || "🦉";
      }
      const titleEl = document.getElementById("friend-detail-title");
      if (titleEl) titleEl.textContent = friendTitle(p);
      const metaEl = document.getElementById("friend-detail-meta");
      if (metaEl) metaEl.textContent = `Lv.${cloudNum(qs.level) || 1} ・ 🔥 ${cloudNum(qs.streak)}日 ・ ${p.friend_code || ""}`;

      const parts = [];
      parts.push(`<div class="grid grid-cols-3 gap-2">
        <div class="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-center"><p class="text-[10px] text-emerald-600 font-bold">マスター率</p><p class="text-lg font-extrabold text-emerald-800">${cloudNum(qs.masterRate)}%</p></div>
        <div class="p-2.5 bg-sky-50 border border-sky-100 rounded-xl text-center"><p class="text-[10px] text-sky-600 font-bold">通算正答率</p><p class="text-lg font-extrabold text-sky-800">${cloudNum(qs.accuracy)}%</p></div>
        <div class="p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-center"><p class="text-[10px] text-amber-600 font-bold">最大コンボ</p><p class="text-lg font-extrabold text-amber-800">${cloudNum(qs.maxCombo)}</p></div>
      </div>
      <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div class="bg-white border border-slate-200 rounded-xl px-3 py-2">累計解答 <b class="text-slate-900">${cloudNum(qs.answered)}</b> 問</div>
        <div class="bg-white border border-slate-200 rounded-xl px-3 py-2">累計正解 <b class="text-slate-900">${cloudNum(qs.correct)}</b> 問</div>
        <div class="bg-white border border-slate-200 rounded-xl px-3 py-2">アイテム解放 <b class="text-slate-900">${cloudNum(qs.itemRate)}%</b></div>
        <div class="bg-white border border-slate-200 rounded-xl px-3 py-2">実績解放 <b class="text-slate-900">${cloudNum(qs.achievementRate)}%</b></div>
      </div>`);

      if (!progress) {
        parts.push(`<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">このフレンドはまだクラウドに学習データを同期していません。同期されると詳細な進捗が表示されます。</div>`);
        body.innerHTML = parts.join("");
        return;
      }

      const leapRows = LEAP_PARTS.map((part) => {
        const ids = LEAP_SOURCE.filter(w => Number(w.id) >= part.start && Number(w.id) <= part.end).map(w => w.id);
        return progressBarRow(part.name + "（" + part.desc + "）", tallyWordIds(ids, data.wordStats || {}));
      }).join("");
      const kobunRows = KOBUN_PARTS.map((part) => {
        const ids = KOBUN_SOURCE.filter(w => Number(w.id) >= part.start && Number(w.id) <= part.end).map(w => w.id);
        return progressBarRow(part.name, tallyWordIds(ids, data.wordStats || {}));
      }).join("");
      const allTally = tallyWordIds(LEAP_SOURCE.concat(KOBUN_SOURCE).map(w => w.id), data.wordStats || {});
      parts.push(`<div class="space-y-2">
        <p class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><span>📊</span>総合・ゾーン別・Part別の進捗</p>
        <div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-3">
          ${progressBarRow("LEAP 全体（" + LEAP_SOURCE.length + "語）", summary.leap)}
          ${progressBarRow("古文（裏世界・" + KOBUN_SOURCE.length + "語）", summary.kobun)}
          ${progressBarRow("全単語", allTally)}
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-3">
          <p class="text-[11px] font-bold text-slate-500">LEAP Part 別</p>
          ${leapRows}
          <p class="text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100">古文 章別</p>
          ${kobunRows}
        </div>
      </div>`);

      const ownedP = Array.isArray(data.purchasedPrefixes) ? data.purchasedPrefixes.length : 0;
      const ownedS = Array.isArray(data.purchasedSuffixes) ? data.purchasedSuffixes.length : 0;
      const ownedF = Array.isArray(data.ownedFrames) ? data.ownedFrames.length : 0;
      const ownedA = Array.isArray(data.ownedAvatars) ? data.ownedAvatars.length : 0;
      const badges = ACHIEVEMENTS.filter(a => achIds.indexOf(a.id) >= 0);
      parts.push(`<div class="space-y-2">
        <p class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><span>🎖️</span>コレクション・実績</p>
        <div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          ${[["前称号", ownedP, PREFIX_TITLES.length], ["後称号", ownedS, SUFFIX_TITLES.length], ["フレーム", ownedF, FRAME_ITEMS.length], ["アバター", ownedA, AVATAR_ITEMS.length], ["実績", badges.length, ACHIEVEMENTS.length]].map((row) => {
            const pct = row[2] ? Math.round((row[1] / row[2]) * 100) : 0;
            return `<div class="space-y-1">
              <div class="flex items-center justify-between text-[11px] gap-2"><span class="font-bold text-slate-600">${row[0]}</span><span class="text-slate-400 tabular-nums">${row[1]}/${row[2]} ・ ${pct}%</span></div>
              <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-400 rounded-full" style="width:${pct}%"></div></div>
            </div>`;
          }).join("")}
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl p-3">
          <p class="text-[11px] font-bold text-slate-500 mb-2">獲得済みバッジ</p>
          ${badges.length ? `<div class="flex flex-wrap gap-1.5">${badges.map(a => `<span class="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg">${a.icon} ${escapeHtml(a.name)}</span>`).join("")}</div>` : `<p class="text-[11px] text-slate-400">まだ実績がありません。</p>`}
        </div>
      </div>`);

      if (shared) {
        const hist = Array.isArray(data.scoreHistory) ? data.scoreHistory.slice(0, 5) : [];
        const histHtml = hist.length ? hist.map(h => `<div class="flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          <div class="min-w-0"><p class="font-bold text-slate-700 truncate">${escapeHtml(h.range || "クイズ")}</p><p class="text-[10px] text-slate-400">${escapeHtml(h.date || "")}${h.isDaily ? " ・ 🌟デイリー" : ""}</p></div>
          <div class="text-right shrink-0"><p class="font-bold text-slate-900 tabular-nums">${cloudNum(h.correct)}/${cloudNum(h.total)} ・ ${cloudNum(h.accuracy)}%</p><p class="text-[10px] text-slate-400">スコア ${cloudNum(h.score)} ・ ${cloudNum(h.combo)} コンボ</p></div>
        </div>`).join("") : `<p class="text-[11px] text-slate-400">プレイ履歴はまだありません。</p>`;
        parts.push(`<div class="space-y-2">
          <p class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><span>📜</span>直近のプレイ履歴</p>
          <div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-1.5">${histHtml}</div>
        </div>`);

        const weak = buildFriendWeakRanking(data);
        const weakHtml = weak.length ? weak.map((w, i) => `<div class="flex items-start gap-2 text-[11px] bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          <span class="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">${i + 1}</span>
          <div class="min-w-0 flex-1"><p class="font-bold text-slate-800 truncate">${escapeHtml(w.word)}</p><p class="text-[10px] text-slate-400 truncate">${escapeHtml(w.meaning || "")}</p></div>
          <span class="text-[10px] text-slate-400 shrink-0 tabular-nums">${w.count ? "ミス " + w.count : "正答率 " + w.accuracy + "%"}</span>
        </div>`).join("") : `<p class="text-[11px] text-slate-400">苦手単語の記録はありません。</p>`;
        parts.push(`<div class="space-y-2">
          <p class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><span>🔥</span>苦手単語ランキング TOP10</p>
          <div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-1.5">${weakHtml}</div>
          ${weak.length ? `<button type="button" onclick="startFriendWeakQuiz([${weak.map(w => w.id).join(",")}])" class="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">⚔️ この苦手単語セットで自分も挑戦する</button>` : ""}
        </div>`);

        const az = data.affixStats || {};
        const rushP = cloudNum((az.rushBest || {}).prefix);
        const rushS = cloudNum((az.rushBest || {}).suffix);
        const memP = (az.memoryBest || {}).prefix || {};
        const memS = (az.memoryBest || {}).suffix || {};
        parts.push(`<div class="space-y-2">
          <p class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><span>🧩</span>語源ラッシュ・接辞神経衰弱</p>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="bg-white border border-slate-200 rounded-xl px-3 py-2"><p class="text-[10px] text-slate-400 font-bold">ラッシュ 接頭辞</p><p class="text-base font-extrabold text-slate-900">${rushP}</p></div>
            <div class="bg-white border border-slate-200 rounded-xl px-3 py-2"><p class="text-[10px] text-slate-400 font-bold">ラッシュ 接尾辞</p><p class="text-base font-extrabold text-slate-900">${rushS}</p></div>
            <div class="bg-white border border-slate-200 rounded-xl px-3 py-2"><p class="text-[10px] text-slate-400 font-bold">神経衰弱 接頭辞</p><p class="text-sm font-bold text-slate-900">${cloudNum(memP.moves)}手 ・ ${cloudNum(memP.seconds)}秒</p></div>
            <div class="bg-white border border-slate-200 rounded-xl px-3 py-2"><p class="text-[10px] text-slate-400 font-bold">神経衰弱 接尾辞</p><p class="text-sm font-bold text-slate-900">${cloudNum(memS.moves)}手 ・ ${cloudNum(memS.seconds)}秒</p></div>
          </div>
        </div>`);
      } else {
        parts.push(`<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">🔒 このフレンドは詳細ログ（苦手単語・プレイ履歴）を非公開にしています。集計率とバッジのみ表示しています。</div>`);
      }
      body.innerHTML = parts.join("");
    }

    function openFriendDetail(uid) {
      const friend = cloudState.friends.find(f => f.userId === uid);
      if (!friend) return;
      cloudState.activeFriendId = uid;
      cloudState.viewingSelf = false;
      renderFriendDetail(friend);
      const removeBtn = document.getElementById("friend-detail-remove");
      if (removeBtn) removeBtn.classList.remove("hidden");
      const modal = document.getElementById("friend-detail-modal");
      if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
    }
    function closeFriendDetail() {
      const modal = document.getElementById("friend-detail-modal");
      if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
      cloudState.activeFriendId = null;
      cloudState.viewingSelf = false;
    }

    function startFriendWeakQuiz(ids) {
      closeFriendDetail();
      const idSet = new Set((ids || []).map(Number));
      const leapPool = LEAP_SOURCE.filter(w => idSet.has(Number(w.id)));
      const kobunPool = KOBUN_SOURCE.filter(w => idSet.has(Number(w.id)));
      const useKobun = leapPool.length === 0 && kobunPool.length > 0;
      const pool = useKobun ? kobunPool : leapPool;
      if (!pool.length) { showToast("挑戦できる単語がありません"); return; }
      if (useKobun && currentSubject !== "kobun") applySubject("kobun", { silent: true });
      if (!useKobun && currentSubject !== "leap") applySubject("leap", { silent: true });
      isDailyMode = false;
      isWeakMode = false;
      selectedRange = { start: 1, end: 1000, label: "フレンドの苦手単語セット" };
      questionLimit = Math.min(pool.length, 10);
      startQuizWithPool(pool, { forceNormalMode: true, forceNormalStyle: true });
    }

    function initCloud() {
      try { cloudState.shareDetailedLogs = localStorage.getItem(CLOUD_SHARE_KEY) !== "0"; } catch (e) {}
      renderCloudAccount();
      renderSocial();
      if (!supabaseClient) return;
      supabaseClient.auth.getSession().then((res) => {
        const session = res && res.data && res.data.session;
        if (session && session.user) {
          cloudState.user = session.user;
          setTimeout(bootstrapCloudUser, 0);
          setTimeout(() => scheduleLinkedMockExam(0), 1200);
        }
      }).catch(() => {});
      supabaseClient.auth.onAuthStateChange((event, session) => {
        const previous = cloudState.user ? cloudState.user.id : null;
        if (session && session.user) {
          cloudState.user = session.user;
          if (previous !== session.user.id) {
            setTimeout(bootstrapCloudUser, 0);
            // 共有リンクで開いていた模試があれば、ログイン後に自動で開く
            setTimeout(() => scheduleLinkedMockExam(0), 1500);
          }
        } else {
          cloudState.user = null;
          cloudState.profile = null;
          cloudState.bootstrapFor = null;
          cloudState.friends = [];
          cloudState.incoming = [];
          cloudState.outgoing = [];
          renderCloudAccount();
          renderSocial();
        }
      });
    }
