/* 国际邮轮行业资料库 — Service Worker
 * 策略：
 *  - 导航请求（打开页面）采用 network-first → 每次联网都拉取最新 index.html，实现「网页改了，APP 自动更新」
 *  - 同源静态资源（图标/manifest）采用 cache-first，首次缓存后离线可用
 *  - 离线且无网络时，导航回退到已缓存的 index.html
 *  - 监听到新版本安装完成后，提示用户刷新（skipWaiting）
 */
const CACHE = 'cruise-db-v1';
const SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => true)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域资源（维基图片等）不拦截，直连

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', cp));
          return res;
        })
        .catch(() => caches.match('./index.html').then((m) => m || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((m) => {
      if (m) return m;
      return fetch(req).then((res) => {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
