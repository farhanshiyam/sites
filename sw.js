/* RGCE service worker - v4
   Network-first for the app files, so a new index.html always shows after upload.
   Cache is used only as an offline fallback. Firebase / Google / CDN calls are never touched.
   v3 changes:
   - always answers with a real Response (fixes "Failed to convert value to 'Response'" when offline / on a failed request)
   - offline deep links (e.g. /sites/customers/summary-report) open the cached app instead of failing
   - the app page and the three Bangla font files are saved at install, so the font also works offline
   v4: a clean address such as /sites/customers/summary-report (no real file on GitHub Pages, so the server says 404)
       is answered with the app page itself (status 200), so the browser console stays free of that 404 */
const CACHE = 'rgce-cache-v4';
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

async function appShell() {                       // the app page: fresh from the network when possible, otherwise the saved copy
  const url = new URL('./', SCOPE).href;
  try {
    const r = await fetch(url);
    if (r && r.ok && !r.redirected) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(url, copy)).catch(() => {}); return r; }
  } catch (e) {}
  return (await caches.match(url)) || (await caches.match(new URL('./index.html', SCOPE).href)) || null;
}

async function handle(req) {
  try {
    const res = await fetch(req);
    if (req.mode === 'navigate' && res && res.status === 404) {   // clean address with no real file: open the app instead of an error page
      const shell = await appShell();
      if (shell) return shell;
    }
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
