// The service worker of the page. Browsers start it only for a page opened over https or on
// localhost. With it the page can be installed as an app, it opens from the last visit while the
// hub cannot be reached, and the alerts' notifications show where the browser shows them only
// from a service worker, such as Chrome on Android.
//
// The page itself, index.html, comes from the hub first, so a new version shows at once. The
// scripts and styles named after their content come from the cache, which is emptied whenever
// index.html changes. The API is never cached: its values are live, or the page says they are not.
'use strict';

const CACHE = 'den-watcher';
const scope = new URL(self.registration.scope);
const api = new URL('api/', scope).pathname;
/** The files the build names after their content, such as main-7EIQR62F.js. */
const hashed = /\/[a-z0-9]+-[A-Z0-9]{8}\.(js|css)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname) ||
    url.pathname.startsWith(api)
  ) {
    return;
  }
  const page = url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`;
  if (request.mode === 'navigate' && page) {
    event.respondWith(openPage(event));
  } else if (hashed.test(url.pathname)) {
    event.respondWith(fromCache(event));
  } else {
    event.respondWith(fromNetwork(event));
  }
});

// A click on an alert's notification brings the page to the front, or opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((pages) => {
      const open = pages.find((p) => p.url.startsWith(scope.href));
      return open ? open.focus() : self.clients.openWindow(scope.href);
    }),
  );
});

/** The page from the hub, kept for when the hub cannot be reached; else the page kept last. */
async function openPage(event) {
  try {
    const response = await fetch(event.request);
    if (response.ok && !response.redirected) {
      event.waitUntil(keepPage(response.clone()));
    }
    return response;
  } catch (error) {
    const kept = await caches.match(scope.href);
    if (kept) {
      return kept;
    }
    throw error;
  }
}

/** Keeps the page; a page that changed is a new version, whose scripts have other names. */
async function keepPage(response) {
  const cache = await caches.open(CACHE);
  const text = await response.clone().text();
  const kept = await cache.match(scope.href);
  if (!kept || (await kept.text()) !== text) {
    const keys = await cache.keys();
    await Promise.all(keys.map((key) => cache.delete(key)));
  }
  await cache.put(scope.href, response);
}

/** A file named after its content never changes, so the copy kept is as good as the hub's. */
async function fromCache(event) {
  const kept = await caches.match(event.request);
  if (kept) {
    return kept;
  }
  return fromNetwork(event);
}

/** The file from the hub, kept for when the hub cannot be reached; else the copy kept last. */
async function fromNetwork(event) {
  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  } catch (error) {
    const kept = await caches.match(event.request);
    if (kept) {
      return kept;
    }
    throw error;
  }
}
