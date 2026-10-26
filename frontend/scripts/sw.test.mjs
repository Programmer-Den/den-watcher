import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const build = { version: 'v2', files: ['', 'main-AB12CD34.js', 'flags/de.svg'] };

/** Cache Storage as the service worker uses it, keeping the answers by address. */
class Caches {
  stores = new Map();

  constructor(hub) {
    this.hub = hub;
  }

  async open(name) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    const store = this.stores.get(name);
    return {
      match: async (href) => store.get(href)?.clone(),
      addAll: async (requests) => {
        for (const request of requests) {
          const response = await this.hub(request);
          if (!response.ok) {
            throw new TypeError(`${request.url} answered ${response.status}`);
          }
          store.set(request.url, response);
        }
      },
    };
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(name) {
    return this.stores.delete(name);
  }
}

let hub;
let asked;
let caches;
let listeners;

/** Starts the service worker of the page at scope, as the browser does after the build. */
function start(scope = 'https://hub/') {
  listeners = {};
  const self = {
    registration: { scope },
    addEventListener: (type, listener) => (listeners[type] = listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const fetch = async (request) => {
    asked.push(typeof request === 'string' ? request : request.url);
    return hub(request);
  };
  const built = source.replace(/^const BUILD = .*;$/m, `const BUILD = ${JSON.stringify(build)};`);
  runInNewContext(built, { self, caches, fetch, Request, URL, Set });
}

async function lifecycle(type) {
  const waits = [];
  listeners[type]({ waitUntil: (promise) => waits.push(promise) });
  await Promise.all(waits);
}

/** What the service worker answers, or undefined where it leaves the request to the browser. */
async function get(url, { mode = 'no-cors', method = 'GET' } = {}) {
  let answer;
  listeners.fetch({ request: { url, mode, method }, respondWith: (promise) => (answer = promise) });
  return answer && (await answer);
}

async function text(url, options) {
  return (await get(url, options)).text();
}

beforeEach(() => {
  asked = [];
  hub = async (request) => new Response(`hub ${request.url}`);
  caches = new Caches((request) => hub(request));
});

test('keeps the files of its build, asking the hub, then drops the builds before', async () => {
  caches.stores.set('den-watcher / v1', new Map());
  caches.stores.set('den-watcher', new Map());
  caches.stores.set('den-watcher /main/ v1', new Map());
  start();

  await lifecycle('install');
  await lifecycle('activate');

  assert.deepEqual(await caches.keys(), ['den-watcher /main/ v1', 'den-watcher / v2']);
  const kept = [...caches.stores.get('den-watcher / v2').keys()].sort();
  assert.deepEqual(kept, [
    'https://hub/',
    'https://hub/flags/de.svg',
    'https://hub/main-AB12CD34.js',
  ]);
});

test('opens the page from the hub, and the kept one while the hub cannot be reached', async () => {
  start();
  await lifecycle('install');
  hub = async () => new Response('new page');
  assert.equal(await text('https://hub/?kiosk', { mode: 'navigate' }), 'new page');

  for (const status of [502, 503, 504]) {
    hub = async () => new Response('Bad Gateway', { status });
    assert.equal(await text('https://hub/index.html', { mode: 'navigate' }), 'hub https://hub/');
  }
  hub = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal(await text('https://hub/', { mode: 'navigate' }), 'hub https://hub/');

  hub = async () => new Response('Not Found', { status: 404 });
  assert.equal((await get('https://hub/', { mode: 'navigate' })).status, 404);
});

test('serves the files of its build as kept, and others from the hub', async () => {
  start();
  await lifecycle('install');
  asked = [];

  assert.equal(await text('https://hub/flags/de.svg'), 'hub https://hub/flags/de.svg');
  assert.deepEqual(asked, []);

  caches.stores.get('den-watcher / v2').delete('https://hub/main-AB12CD34.js');
  assert.equal(await text('https://hub/main-AB12CD34.js'), 'hub https://hub/main-AB12CD34.js');
  assert.deepEqual(asked, ['https://hub/main-AB12CD34.js']);
});

test('leaves the API, other addresses and other pages to the browser', async () => {
  start('https://pages.example/den-watcher/');
  await lifecycle('install');

  for (const url of [
    'https://pages.example/den-watcher/api/devices',
    'https://pages.example/den-watcher/metrics',
    'https://pages.example/den-watcher/main/',
    'https://pages.example/den-watcher/main/main-AB12CD34.js',
    'https://elsewhere.example/den-watcher/main-AB12CD34.js',
  ]) {
    assert.equal(await get(url, { mode: 'navigate' }), undefined, url);
  }
  const post = { method: 'POST', mode: 'navigate' };
  assert.equal(await get('https://pages.example/den-watcher/', post), undefined);
});
