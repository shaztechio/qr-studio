const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(new URL('../sw.js', `file://${__filename}`), 'utf8');
const appURL = 'https://shaztech.io/apps/qr/';
const html = (body) => new Response(body, { headers: { 'content-type': 'text/html' } });

function worker() {
  const handlers = {};
  const stores = new Map();
  let network = async () => html('initial app');
  let claimed = false;
  let skipped = false;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        add: async (request) => {
          const response = await network(request);
          if (!response.ok) throw new Error('Install failed');
          store.set(request.url, response.clone());
        },
        match: async (url) => store.get(url)?.clone(),
        put: async (url, response) => store.set(url, response.clone()),
      };
    },
  };
  vm.runInNewContext(source, {
    URL, Request, AbortController, caches, setTimeout, clearTimeout,
    fetch: (...args) => network(...args),
    self: {
      location: { href: `${appURL}sw.js` },
      addEventListener: (type, handler) => { handlers[type] = handler; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
  });
  return {
    stores,
    setNetwork: (next) => { network = next; },
    state: () => ({ claimed, skipped }),
    lifecycle: (type) => {
      let work;
      handlers[type]({ waitUntil: (promise) => { work = promise; } });
      return work;
    },
    navigate: (url = appURL, overrides = {}) => {
      let result;
      handlers.fetch({
        request: { url, method: 'GET', mode: 'navigate', ...overrides },
        respondWith: (promise) => { result = promise; },
      });
      return result;
    },
  };
}

test('installs an offline copy and cleans up only old QR Studio caches', async () => {
  const sw = worker();
  sw.stores.set('qr-studio-old', new Map());
  sw.stores.set('another-app', new Map());
  await sw.lifecycle('install');
  await sw.lifecycle('activate');
  assert.deepEqual(sw.state(), { claimed: true, skipped: true });
  assert.deepEqual([...sw.stores.keys()].sort(), ['another-app', 'qr-studio-v1']);
  sw.setNetwork(async () => { throw new Error('Offline'); });
  for (const url of [appURL, `${appURL}index.html?test=1`]) {
    assert.equal(await (await sw.navigate(url)).text(), 'initial app');
  }
});

test('refreshes cached HTML online and preserves it during server failures', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  sw.setNetwork(async () => html('updated app'));
  assert.equal(await (await sw.navigate()).text(), 'updated app');
  sw.setNetwork(async () => new Response('Unavailable', { status: 503 }));
  assert.equal(await (await sw.navigate()).text(), 'updated app');
  sw.setNetwork(async () => { throw new Error('Offline'); });
  assert.equal(await (await sw.navigate()).text(), 'updated app');
});

test('ignores other pages, resources, origins and non-GET requests', () => {
  const sw = worker();
  assert.equal(sw.navigate('https://shaztech.io/'), undefined);
  assert.equal(sw.navigate(`${appURL}missing.html`), undefined);
  assert.equal(sw.navigate('https://example.com/apps/qr/'), undefined);
  assert.equal(sw.navigate(appURL, { method: 'POST' }), undefined);
  assert.equal(sw.navigate(appURL, { mode: 'cors' }), undefined);
});

test('failed precaching does not activate a worker', async () => {
  const sw = worker();
  sw.setNetwork(async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(sw.lifecycle('install'));
  assert.deepEqual(sw.state(), { claimed: false, skipped: false });
});
