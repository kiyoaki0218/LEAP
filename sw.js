const CACHE = "leap-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./words_data.js",
  "./examples_data.js",
  "./reference_data.js",
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

  // 静的アセット（画像・単語データ等）は Stale-While-Revalidate または Cache-First
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
