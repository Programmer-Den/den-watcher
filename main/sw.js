// The service worker of the page. Browsers start it only for a page opened over https or on
// localhost. With it the page can be installed as an app, it opens from the last visit while the
// hub cannot be reached, and the alerts' notifications show where the browser shows them only
// from a service worker, such as Chrome on Android.
//
// It keeps the files of its build, listed in BUILD, when it is installed, and serves them from
// there. The page itself, index.html, comes from the hub first, so a new version shows at once,
// and from the cache only while the hub cannot be reached. A new build changes sw.js, so the
// browser installs it as a new worker, which keeps the new files and then drops the old ones.
// Nothing else is kept, such as the API or /metrics: their values are live, or the page says
// they are not.
'use strict';

// The build's files below the page, the page itself as '', and a version that changes with any
// of them; scripts/precache.mjs puts them in after each build.
const BUILD = {"version":"08679580b1dca7ce","files":["apple-touch-icon.png","chunk-7qHJ1h4B.js","chunk-BLKGfi4o.js","chunk-BwmQKNpf.js","chunk-CLmVvdmT.js","chunk-DN8Teuo9.js","chunk-Des0iUrq.js","chunk-TqPdi4nj.js","chunk-n0PMTkNc.js","flags/de.svg","flags/en-GB.svg","flags/en-US.svg","flags/es.svg","flags/fr.svg","icon-192.png","icon-512.png","icon-maskable-512.png","","main-U6HVLNST.js","manifest.webmanifest","mascot.svg","styles-E7IGHT2T.css"]};

const scope = new URL(self.registration.scope);
/** Each page its own caches, as the demo has two pages on one site, one inside the other. */
const prefix = `den-watcher ${scope.pathname} `;
const CACHE = prefix + BUILD.version;
const files = new Set(BUILD.files.map((file) => new URL(file, scope).href));
/** What a reverse proxy in front of the hub answers while the hub is down. */
const unreachable = new Set([502, 503, 504]);

self.addEventListener('install', (event) => {
  event.waitUntil(keepBuild().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(dropOldBuilds().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  const href = url.origin + url.pathname;
  if (request.mode === 'navigate' && (href === scope.href || href === `${scope.href}index.html`)) {
    event.respondWith(openPage(request));
  } else if (files.has(href)) {
    event.respondWith(fromCache(request, href));
  }
  // Anything else goes to the hub as if there were no service worker.
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

/** Keeps every file of the build, asking the hub, as the browser may hold older copies. */
async function keepBuild() {
  const cache = await caches.open(CACHE);
  await cache.addAll([...files].map((href) => new Request(href, { cache: 'no-cache' })));
}

/** Drops the files of the builds before, once this one is kept. */
async function dropOldBuilds() {
  const names = await caches.keys();
  // 'den-watcher' was the one cache of the first service worker, for every page on the site.
  const old = names.filter(
    (name) => name === 'den-watcher' || (name.startsWith(prefix) && name !== CACHE),
  );
  await Promise.all(old.map((name) => caches.delete(name)));
}

/** The page from the hub; the one kept while the hub cannot be reached. */
async function openPage(request) {
  try {
    const response = await fetch(request);
    if (!unreachable.has(response.status)) {
      return response;
    }
    return (await kept(scope.href)) ?? response;
  } catch (error) {
    const page = await kept(scope.href);
    if (page) {
      return page;
    }
    throw error;
  }
}

/** A file of the build as kept; from the hub if it is not, such as one of a newer build. */
async function fromCache(request, href) {
  return (await kept(href)) ?? fetch(request);
}

async function kept(href) {
  const cache = await caches.open(CACHE);
  return cache.match(href);
}
