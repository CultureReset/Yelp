/**
 * Offline shell. Business owners open this in car parks and basements, so a
 * dead signal must not produce a browser error page.
 *
 * Strategy:
 *   - Navigations: network first, fall back to the cached offline page.
 *   - Static build assets: cache first, they are content-hashed.
 *   - Everything else (API, server actions): network only, never cached.
 *     Caching a POST or a dashboard payload would show stale money numbers.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, '/icon.svg'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ?? fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(request, copy));
          return res;
        }),
      ),
    );
  }
});

// Push notifications: a new review or lead should reach the phone.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag,
    data: { href: payload.href ?? '/dashboard' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(href) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(href);
    }),
  );
});
