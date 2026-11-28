// ============================================================
// js/notification.js - LEAP 学習リマインダー通知モジュール
// Web Notification API と Service Worker によるブラウザ通知
// ============================================================

(function(global) {
  "use strict";

  const STORAGE_KEYS = {
    ENABLED: "LEAP_NOTIF_ENABLED",
    TIME: "LEAP_NOTIF_TIME",
    REVIEW: "LEAP_NOTIF_REVIEW",
    STREAK: "LEAP_NOTIF_STREAK",
    LAST_DATE: "LEAP_NOTIF_LAST_DATE"
  };

  const DEFAULT_CONFIG = {
    enabled: false,
    time: "20:00",
    review: true,
    streak: true
  };

  /**
   * ブラウザがNotification APIに対応しているか
   */
  function isSupported() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /**
   * 現在の通知パーミッションを取得
   * @returns {"granted" | "denied" | "default" | "unsupported"}
   */
  function getPermission() {
    if (!isSupported()) return "unsupported";
    return Notification.permission;
  }

  /**
   * 通知設定を取得
   */
  function getConfig() {
    try {
      const enabled = localStorage.getItem(STORAGE_KEYS.ENABLED) === "true";
      const time = localStorage.getItem(STORAGE_KEYS.TIME) || DEFAULT_CONFIG.time;
      const review = localStorage.getItem(STORAGE_KEYS.REVIEW) !== "false"; // default true
      const streak = localStorage.getItem(STORAGE_KEYS.STREAK) !== "false"; // default true
      return { enabled, time, review, streak };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 通知設定を保存
   */
  function saveConfig(cfg) {
    try {
      if (typeof cfg.enabled === "boolean") {
        localStorage.setItem(STORAGE_KEYS.ENABLED, String(cfg.enabled));
      }
      if (typeof cfg.time === "string" && /^\d{2}:\d{2}$/.test(cfg.time)) {
        localStorage.setItem(STORAGE_KEYS.TIME, cfg.time);
      }
      if (typeof cfg.review === "boolean") {
        localStorage.setItem(STORAGE_KEYS.REVIEW, String(cfg.review));
      }
      if (typeof cfg.streak === "boolean") {
        localStorage.setItem(STORAGE_KEYS.STREAK, String(cfg.streak));
      }
    } catch (e) {
      console.warn("[notification] Failed to save config:", e);
    }
  }

  /**
   * 権限リクエスト
   */
  async function requestPermission() {
    if (!isSupported()) return "unsupported";
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn("[notification] Permission request failed:", e);
      return Notification.permission;
    }
  }

  /**
   * 今日の日付文字列 (YYYY-MM-DD)
   */
  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * 通知の文面を構築
   */
  function buildReminderContent(options = {}) {
    const { dueReviewCount = 0, streakDays = 0 } = options;

    let title = "📖 今日のLEAP単語学習の時間です！";
    let body = "少しずつ継続して、着実にボキャブラリーを増やしましょう。";

    if (dueReviewCount > 0 && options.includeReview !== false) {
      title = `🧠 忘却曲線の復習が ${dueReviewCount} 語待っています！`;
      body = "覚えた単語を記憶に定着させるベストタイミングです。サクッと確認しよう！";
    } else if (streakDays > 0 && options.includeStreak !== false) {
      title = `🔥 連続学習 ${streakDays} 日目！今日も続けよう`;
      body = "今日のクイズを1回解いて、ストリークをさらに伸ばしましょう！";
    }

    return {
      title,
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "leap-study-reminder",
      renotify: true,
      data: {
        url: "./",
        type: "reminder",
        timestamp: Date.now()
      }
    };
  }

  /**
   * 実際に通知を表示する
   */
  async function showNotification(title, options = {}) {
    if (getPermission() !== "granted") {
      console.warn("[notification] Notification permission not granted");
      return false;
    }

    const notifOptions = {
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      ...options
    };

    // ServiceWorker registration 経由で出す（バックグラウンドやPWAでも安定動作）
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === "function") {
          await reg.showNotification(title, notifOptions);
          return true;
        }
      }
    } catch (swErr) {
      console.warn("[notification] ServiceWorker showNotification failed, fallback to new Notification:", swErr);
    }

    // フォールバック: 通常の Notification コンストラクタ
    try {
      const notif = new Notification(title, notifOptions);
      notif.onclick = function() {
        window.focus();
        if (options.data && options.data.url) {
          location.href = options.data.url;
        }
        notif.close();
      };
      return true;
    } catch (e) {
      console.error("[notification] Fallback Notification failed:", e);
      return false;
    }
  }

  /**
   * テスト通知を送信
   */
  async function sendTestNotification() {
    if (getPermission() !== "granted") {
      const res = await requestPermission();
      if (res !== "granted") {
        return { success: false, reason: "permission_denied" };
      }
    }

    const success = await showNotification("🎉 【LEAP】通知テスト成功！", {
      body: "通知は正常に機能しています。設定した時刻に学習リマインダーをお届けします！",
      tag: "leap-test-notification",
      renotify: true
    });

    return { success, reason: success ? null : "send_failed" };
  }

  /**
   * 現在時刻と設定時刻が一致するか判定
   */
  function isTimeToNotify(targetTimeStr, now = new Date()) {
    if (!targetTimeStr || !/^\d{2}:\d{2}$/.test(targetTimeStr)) return false;
    const [th, tm] = targetTimeStr.split(":").map(Number);
    const ch = now.getHours();
    const cm = now.getMinutes();
    return ch === th && cm === tm;
  }

  /**
   * 学習状況コンテキスト（復習単語数、ストリーク）を取得
   */
  function getStudyContext() {
    let dueReviewCount = 0;
    let streakDays = 0;

    try {
      // 復習待ち単語数の取得
      if (typeof getDueReviewWords === "function") {
        const due = getDueReviewWords();
        if (Array.isArray(due)) dueReviewCount = due.length;
      } else {
        const rawWeak = localStorage.getItem("LEAP_WEAK_WORDS");
        if (rawWeak) {
          const weak = JSON.parse(rawWeak);
          const today = getTodayString();
          dueReviewCount = Object.values(weak).filter(w => w && w.nextReview && w.nextReview <= today && !w.overcome).length;
        }
      }
    } catch (e) {}

    try {
      // 連続日数の取得
      if (typeof getStreakDays === "function") {
        streakDays = getStreakDays();
      } else {
        const rawStreak = localStorage.getItem("LEAP_STREAK");
        if (rawStreak) {
          const s = JSON.parse(rawStreak);
          streakDays = s.count || 0;
        }
      }
    } catch (e) {}

    return { dueReviewCount, streakDays };
  }

  /**
   * リマインダーの定期チェック＆発信
   */
  async function checkAndTriggerReminder(force = false) {
    const cfg = getConfig();
    if (!cfg.enabled && !force) return false;
    if (getPermission() !== "granted") return false;

    const today = getTodayString();
    const lastNotified = localStorage.getItem(STORAGE_KEYS.LAST_DATE);

    if (!force) {
      if (lastNotified === today) {
        // 本日すでに通知済み
        return false;
      }
      if (!isTimeToNotify(cfg.time)) {
        // まだその時間ではない
        return false;
      }
    }

    const ctx = getStudyContext();
    const payload = buildReminderContent({
      dueReviewCount: ctx.dueReviewCount,
      streakDays: ctx.streakDays,
      includeReview: cfg.review,
      includeStreak: cfg.streak
    });

    const sent = await showNotification(payload.title, payload);
    if (sent) {
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_DATE, today);
      } catch (e) {}
    }
    return sent;
  }

  // タイマー初期化
  let checkIntervalId = null;
  function startReminderTimer() {
    if (checkIntervalId) clearInterval(checkIntervalId);
    // 初回起動時チェック（10秒後）
    setTimeout(() => {
      checkAndTriggerReminder(false);
    }, 10000);
    // 1分ごとにチェック
    checkIntervalId = setInterval(() => {
      checkAndTriggerReminder(false);
    }, 60000);
  }

  // ============================================================
  // UI 連携
  // ============================================================

  function refreshNotificationModalUI() {
    const modal = document.getElementById("notification-modal");
    if (!modal) return;

    const perm = getPermission();
    const cfg = getConfig();

    // 権限バッジ
    const badgeEl = document.getElementById("notif-perm-badge");
    const guideEl = document.getElementById("notif-perm-guide");
    const reqBtn = document.getElementById("notif-request-btn");

    if (badgeEl) {
      if (perm === "granted") {
        badgeEl.className = "text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
        badgeEl.textContent = "✓ 許可されています";
        if (reqBtn) reqBtn.classList.add("hidden");
        if (guideEl) guideEl.classList.add("hidden");
      } else if (perm === "denied") {
        badgeEl.className = "text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700";
        badgeEl.textContent = "✕ ブラウザでブロック中";
        if (reqBtn) reqBtn.classList.add("hidden");
        if (guideEl) {
          guideEl.classList.remove("hidden");
          guideEl.textContent = "ブラウザのURL欄左の鍵アイコン（またはサイト設定）から「通知」を許可に切り替えてください。";
        }
      } else if (perm === "unsupported") {
        badgeEl.className = "text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600";
        badgeEl.textContent = "お使いの環境では非対応";
        if (reqBtn) reqBtn.classList.add("hidden");
        if (guideEl) {
          guideEl.classList.remove("hidden");
          guideEl.textContent = "※ iOSの場合は「ホーム画面に追加」したPWAから通知を受信できます。";
        }
      } else {
        badgeEl.className = "text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800";
        badgeEl.textContent = "！ 未許可";
        if (reqBtn) reqBtn.classList.remove("hidden");
        if (guideEl) guideEl.classList.add("hidden");
      }
    }

    // 設定入力欄の同期
    const enableToggle = document.getElementById("notif-toggle-enabled");
    const timeInput = document.getElementById("notif-time-input");
    const reviewToggle = document.getElementById("notif-toggle-review");
    const streakToggle = document.getElementById("notif-toggle-streak");
    const optionsSection = document.getElementById("notif-options-section");

    if (enableToggle) enableToggle.checked = cfg.enabled && perm === "granted";
    if (timeInput) timeInput.value = cfg.time;
    if (reviewToggle) reviewToggle.checked = cfg.review;
    if (streakToggle) streakToggle.checked = cfg.streak;

    if (optionsSection) {
      if (cfg.enabled && perm === "granted") {
        optionsSection.classList.remove("opacity-50", "pointer-events-none");
      } else {
        optionsSection.classList.add("opacity-50", "pointer-events-none");
      }
    }
  }

  function openNotificationModal() {
    const modal = document.getElementById("notification-modal");
    if (!modal) return;
    refreshNotificationModalUI();
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function closeNotificationModal() {
    const modal = document.getElementById("notification-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  async function handleRequestPermissionClick() {
    const perm = await requestPermission();
    if (perm === "granted") {
      const cfg = getConfig();
      cfg.enabled = true;
      saveConfig(cfg);
    }
    refreshNotificationModalUI();
  }

  async function handleToggleEnabled(checked) {
    if (checked) {
      const perm = getPermission();
      if (perm !== "granted") {
        const res = await requestPermission();
        if (res !== "granted") {
          refreshNotificationModalUI();
          return;
        }
      }
      saveConfig({ enabled: true });
    } else {
      saveConfig({ enabled: false });
    }
    refreshNotificationModalUI();
  }

  function handleTimeChange(val) {
    if (/^\d{2}:\d{2}$/.test(val)) {
      saveConfig({ time: val });
    }
  }

  function handleReviewToggle(checked) {
    saveConfig({ review: checked });
  }

  function handleStreakToggle(checked) {
    saveConfig({ streak: checked });
  }

  async function handleTestNotificationClick() {
    const btn = document.getElementById("notif-test-btn");
    const msgEl = document.getElementById("notif-test-msg");
    if (btn) btn.disabled = true;
    if (msgEl) {
      msgEl.className = "text-[11px] text-slate-500 mt-1";
      msgEl.textContent = "通知を送信中...";
    }

    const res = await sendTestNotification();

    if (btn) btn.disabled = false;
    if (msgEl) {
      if (res.success) {
        msgEl.className = "text-[11px] text-emerald-600 font-bold mt-1";
        msgEl.textContent = "✓ テスト通知を送信しました！画面端または通知センターをご確認ください。";
      } else if (res.reason === "permission_denied") {
        msgEl.className = "text-[11px] text-rose-600 font-bold mt-1";
        msgEl.textContent = "✕ 通知が許可されていません。「通知を許可する」ボタンを押してください。";
      } else {
        msgEl.className = "text-[11px] text-rose-600 font-bold mt-1";
        msgEl.textContent = "✕ 通知の送信に失敗しました。";
      }
    }
    refreshNotificationModalUI();
  }

  /**
   * 通知が現在アクティブ（権限許可済み かつ 設定ON）か
   */
  function isNotificationActive() {
    if (!isSupported()) return false;
    const perm = getPermission();
    const cfg = getConfig();
    return perm === "granted" && cfg.enabled === true;
  }

  /**
   * ホーム画面の通知バナーを一時的に非表示にする
   */
  function dismissNotificationPrompt() {
    try {
      sessionStorage.setItem("LEAP_NOTIF_PROMPT_DISMISSED", "1");
    } catch (e) {}
    const banner = document.getElementById("home-notification-banner");
    if (banner) banner.classList.add("hidden");
  }

  /**
   * ホーム画面から通知をONにする
   */
  async function enableNotificationFromHome() {
    const perm = getPermission();
    if (perm === "unsupported") {
      if (typeof showToast === "function") {
        showToast("お使いの環境は通知に対応していません（※iOSはホーム画面に追加してご利用ください）");
      }
      return;
    }

    if (perm === "denied") {
      openNotificationModal();
      return;
    }

    if (perm === "granted") {
      saveConfig({ enabled: true });
      if (typeof showToast === "function") {
        showToast("🔔 学習リマインダー通知をONにしました！");
      }
      renderHomeNotificationBanner();
      refreshNotificationModalUI();
      return;
    }

    // default: ユーザーに通知許可をリクエスト
    const res = await requestPermission();
    if (res === "granted") {
      saveConfig({ enabled: true });
      if (typeof showToast === "function") {
        showToast("🔔 学習リマインダー通知をONにしました！");
      }
      renderHomeNotificationBanner();
      refreshNotificationModalUI();
      // 初回許可のお礼テスト通知を軽く送る
      try {
        showNotification("🎉 通知をONにしました！", {
          body: `毎日 ${getConfig().time} に学習リマインダーをお届けします。`,
          tag: "leap-notif-welcome"
        });
      } catch (e) {}
    } else if (res === "denied") {
      if (typeof showToast === "function") {
        showToast("通知が拒否されました");
      }
      renderHomeNotificationBanner();
      refreshNotificationModalUI();
    }
  }

  /**
   * ホーム画面の通知許可案内バナーの描画・更新
   */
  function renderHomeNotificationBanner() {
    const banner = document.getElementById("home-notification-banner");
    if (!banner) return;

    // すでに通知が有効（権限許可済み かつ enabled === true）の場合は非表示
    if (isNotificationActive()) {
      banner.classList.add("hidden");
      return;
    }

    // 非対応ブラウザの場合は非表示
    if (!isSupported()) {
      banner.classList.add("hidden");
      return;
    }

    // セッションで明示的に閉じられている場合は非表示
    try {
      if (sessionStorage.getItem("LEAP_NOTIF_PROMPT_DISMISSED") === "1") {
        banner.classList.add("hidden");
        return;
      }
    } catch (e) {}

    const perm = getPermission();
    const descEl = document.getElementById("home-notif-banner-desc");
    const btnLabel = document.getElementById("home-notif-enable-label");
    const btn = document.getElementById("home-notif-enable-btn");

    if (perm === "denied") {
      if (descEl) descEl.textContent = "ブラウザ設定で通知がブロックされています。タップして設定を確認してください。";
      if (btnLabel) btnLabel.textContent = "設定を確認する";
      if (btn) {
        btn.className = "px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer";
      }
    } else {
      if (descEl) descEl.textContent = "毎日の学習習慣づくりに！設定時刻にリマインダーをお届けします。";
      if (btnLabel) btnLabel.textContent = "通知をONにする";
      if (btn) {
        btn.className = "px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer";
      }
    }

    banner.classList.remove("hidden");
  }

  // エクスポート
  global.LEAP_NOTIFICATION = {
    STORAGE_KEYS,
    DEFAULT_CONFIG,
    isSupported,
    getPermission,
    getConfig,
    saveConfig,
    requestPermission,
    buildReminderContent,
    showNotification,
    sendTestNotification,
    isTimeToNotify,
    getStudyContext,
    checkAndTriggerReminder,
    startReminderTimer,
    isNotificationActive,
    dismissNotificationPrompt,
    enableNotificationFromHome,
    renderHomeNotificationBanner,
    openNotificationModal,
    closeNotificationModal,
    refreshNotificationModalUI,
    handleRequestPermissionClick,
    handleToggleEnabled,
    handleTimeChange,
    handleReviewToggle,
    handleStreakToggle,
    handleTestNotificationClick
  };

  // グローバル関数（インラインHTMLイベントハンドラ用）
  global.openNotificationModal = openNotificationModal;
  global.closeNotificationModal = closeNotificationModal;
  global.handleNotifRequestPermission = handleRequestPermissionClick;
  global.handleNotifToggleEnabled = handleToggleEnabled;
  global.handleNotifTimeChange = handleTimeChange;
  global.handleNotifReviewToggle = handleReviewToggle;
  global.handleNotifStreakToggle = handleStreakToggle;
  global.handleNotifTestClick = handleTestNotificationClick;
  global.enableNotificationFromHome = enableNotificationFromHome;
  global.dismissNotificationPrompt = dismissNotificationPrompt;
  global.renderHomeNotificationBanner = renderHomeNotificationBanner;

  // DOMロード時にタイマー起動＆ホームバナー描画
  if (typeof document !== "undefined") {
    const init = () => {
      startReminderTimer();
      renderHomeNotificationBanner();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

})(typeof window !== "undefined" ? window : globalThis);
