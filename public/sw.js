// Train: сайт открывается и без связи. Страница — сначала из сети, без сети — из кэша;
// скрипты, стили, шрифты и картинки — из кэша (у них в имени хэш или они не меняются). Запросы к базе не трогаем.
const CACHE = "train-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("/", cp)); return r; })
      .catch(() => caches.match("/")));
    return;
  }
  if (/^\/(assets|img|ex|fonts)\//.test(url.pathname) || url.pathname === "/icon.svg") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
