const CACHE = "leap-v51";
const ASSETS = [
  "./",
  "./index.html",
  "./assets/css/app.css",
  "./js/core.js",
  "./js/mock-exam.js",
  "./js/cloud-sync.js",
  "./js/quiz-engine.js",
  "./js/ui-stats-dict.js",
  "./supabase_config.js",
  "./words_data.js",
  "./examples_data.js",
  "./reference_data.js",
  "./affix_data.js",
  "./mock_schools_data.js",
  "./kobun/kobun_words_data.js",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./manifest.json"
];

// インストール時に即座に新しいServiceWorkerを適用
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
});

// 古いキャッシュをすべて破棄して即座にページを制御下に置く
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-First 戦略:
// HTML（画面の更新）は常にネットワーク最新を最優先で取得！
// オフライン時のみキャッシュから返すことで、更新が即座に反映される
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Supabase（API・認証・Realtime）と認証リダイレクトは絶対にキャッシュしない（Network-Only）。
  // 古い進捗やセッションがキャッシュから返ると、同期が破綻するため。
  const isSupabase = url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in");
  const isAuthCallback = url.searchParams.has("code") || url.searchParams.has("access_token") || (url.hash || "").indexOf("access_token") >= 0;
  if (isSupabase || isAuthCallback) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 管理画面（HTML と専用スクリプト）は常に最新を読み込む。
  // 古い js/admin.js が新しい admin.html と組み合わさると、新しく増えたタブの
  // クリックリスナーが無く「タブが押せない」状態になるため、Network-First にする。
  if (url.pathname.endsWith("/admin.html") || url.pathname.endsWith("/js/admin.js")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  const isNavigate = e.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");

  if (isNavigate) {
    // 画面遷移・HTML読み込みは Network-First
    e.respondWith(
      fetch(e.request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // 静的アセット（画像・単語データ等）は Cache-First + 裏で更新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.ok) {
          const copy = networkRes.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
