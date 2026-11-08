/* RGCE service worker - v3
   Network-first for the app files, so a new index.html always shows after upload.
   Cache is used only as an offline fallback. Firebase / Google / CDN calls are never touched.
   v3 changes:
   - always answers with a real Response (fixes "Failed to convert value to 'Response'" when offline / on a failed request)
   - offline deep links (e.g. /sites/customers/summary-report) open the cached app instead of failing
   - the app page and the three Bangla font files are saved at install, so the font also works offline */
const CACHE = 'rgce-cache-v3';
const SCOPE = self.registration.scope;          // e.g. https://farhanshiyam.github.io/sites/
const SHELL = [
  './', './index.html', './manifest.json',
  './fonts/noto-sans-bengali-bengali-wght-normal.woff2',
  './fonts/noto-sans-bengali-latin-wght-normal.woff2',
  './fonts/noto-sans-bengali-latin-ext-wght-normal.woff2'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((p) => c.add(new Request(new URL(p, SCOPE).href, { cache: 'reload' })).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function handle(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = (await caches.match(new URL('./', SCOPE).href)) || (await caches.match(new URL('./index.html', SCOPE).href));
      if (shell) return shell;
    }
    return new Response('', { status: 504, statusText: 'Offline' });   // never return undefined
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never intercept Firebase, Google, CDN requests
  event.respondWith(handle(req));
});
