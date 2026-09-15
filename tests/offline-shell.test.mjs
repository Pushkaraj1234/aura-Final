/**
 * The offline shell's routing rules.
 *
 * One property here is worth far more than the rest: nothing about a person
 * may ever reach a cache. For an ordinary app a cached API response is a
 * staleness bug. For this one it is a survivor's check-ins written to the disk
 * cache of a phone that may be shared, borrowed, or confiscated, and it would
 * regress completely silently. Nobody reviewing a diff notices a route that
 * quietly started being cacheable, and nothing in the running app looks any
 * different.
 *
 * So the worker is loaded and exercised for real rather than eyeballed.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
/**
 * Awaits the body. An earlier version of this harness did not, and the one
 * async test in this file reported PASS without ever having run: fn() returned
 * a pending promise, pass was incremented, and process.exit fired before the
 * rejection surfaced. A test that cannot fail is worse than no test.
 */
const t = async (n, fn) => { try { await fn(); pass++; console.log('PASS', n); }
                             catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const ORIGIN = 'https://aura-one-neon.vercel.app';

/**
 * A CacheStorage stand-in that actually stores things, so the cached-shell
 * path can be exercised rather than assumed. Keyed by request URL, which is
 * all this worker ever uses.
 */
const makeCaches = () => {
  const stores = new Map();
  const cacheFor = (name) => {
    if (!stores.has(name)) {
      const entries = new Map();
      stores.set(name, {
        entries,
        async match(request) {
          return entries.get(typeof request === 'string' ? request : request.url) || undefined;
        },
        async put(request, response) {
          entries.set(typeof request === 'string' ? request : request.url, response);
        },
        async add() { throw new Error('offline'); },
      });
    }
    return stores.get(name);
  };
  return {
    stores,
    api: {
      open: async (name) => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
  };
};

/** Runs public/sw.js in a sandbox with just enough of a worker global. */
const loadWorker = (href = `${ORIGIN}/sw.js?v=abc1234`, { fetchImpl } = {}) => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const self = {
    location: { href, origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const caches = makeCaches();
  const sandbox = {
    self, URL, Set, Map, Response, Request, Promise, console,
    fetch: fetchImpl || (async () => { throw new Error('offline'); }),
    caches: caches.api,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { ...self.__auraSwInternals, listeners, self, caches };
};

const worker = loadWorker();
const u = (href) => new URL(href);

// ---- what must never be cached --------------------------------------------

await t('every API route is private', () => {
  for (const path of [
    '/api/chat', '/api/ai/analyze-reflection', '/api/ml/predict/P-1042',
    '/api/admin/login', '/api/', '/api/anything/at/all',
  ]) {
    ok(worker.isPrivate(u(ORIGIN + path)), `${path} must never be cached`);
  }
});

await t('Supabase is private, on either domain', () => {
  ok(worker.isPrivate(u('https://wtkhcndftvsiaxstspsp.supabase.co/rest/v1/check_ins')));
  ok(worker.isPrivate(u('https://wtkhcndftvsiaxstspsp.supabase.co/auth/v1/token')));
  ok(worker.isPrivate(u('https://anything.supabase.in/rest/v1/alerts')));
});

await t('the voice backend is private', () => {
  // Transcripts and audio. Nothing about a conversation may rest on disk.
  ok(worker.isPrivate(u(ORIGIN + '/voice/session')));
});

await t('a private route is not rescued by looking like a static asset', () => {
  // The ordering in the fetch handler matters: isPrivate is checked first.
  // This pins the predicate itself so a reordering is caught as well.
  const url = u(ORIGIN + '/api/export/checkins.json');
  ok(worker.isPrivate(url), 'a .json under /api is still private');
});

await t('a lookalike host is not treated as Supabase', () => {
  // endsWith on the hostname, so an attacker-controlled lookalike does not
  // inherit the exemption. It is uncacheable anyway by falling through.
  eq(worker.isPrivate(u('https://notsupabase.co/rest/v1/x')), false);
  eq(worker.isStaticAsset(u('https://notsupabase.co/rest/v1/x')), false,
     'and it is not cacheable either, which is the outcome that matters');
});

// ---- what may be cached ----------------------------------------------------

await t('the built bundle and stylesheet are cacheable', () => {
  ok(worker.isStaticAsset(u(ORIGIN + '/assets/index-BlFZ0ist.js')));
  ok(worker.isStaticAsset(u(ORIGIN + '/assets/index-Cs5wvh3p.css')));
});

await t('the icons and manifest are cacheable', () => {
  ok(worker.isStaticAsset(u(ORIGIN + '/icon.svg')));
  ok(worker.isStaticAsset(u(ORIGIN + '/icon-maskable.svg')));
  ok(worker.isStaticAsset(u(ORIGIN + '/manifest.webmanifest')));
});

await t('another origin cannot masquerade as a static asset', () => {
  eq(worker.isStaticAsset(u('https://evil.example/assets/index.js')), false);
});

await t('a bare path is not a static asset, so navigations reach the shell branch', () => {
  eq(worker.isStaticAsset(u(ORIGIN + '/')), false);
  eq(worker.isStaticAsset(u(ORIGIN + '/admin')), false);
});

// ---- versioning ------------------------------------------------------------

await t('the cache version comes from the registration query string', () => {
  eq(worker.VERSION, 'abc1234');
  eq(loadWorker(`${ORIGIN}/sw.js?v=deadbee`).VERSION, 'deadbee');
});

await t('a worker registered with no version still loads', () => {
  eq(loadWorker(`${ORIGIN}/sw.js`).VERSION, 'dev');
});

// ---- the handlers it installs ---------------------------------------------

await t('it registers the four handlers it needs', () => {
  for (const type of ['install', 'activate', 'fetch', 'message']) {
    ok(typeof worker.listeners[type] === 'function', `missing ${type} handler`);
  }
});

await t('a private request is passed through untouched, not answered from cache', () => {
  // respondWith must never be called for these, or the app stops seeing real
  // network errors and its own offline handling breaks.
  let respondedWith = null;
  worker.listeners.fetch({
    request: { method: 'GET', url: ORIGIN + '/api/chat', mode: 'cors' },
    respondWith: (r) => { respondedWith = r; },
  });
  eq(respondedWith, null);
});

await t('a non-GET request is passed through untouched', () => {
  let respondedWith = null;
  worker.listeners.fetch({
    request: { method: 'POST', url: ORIGIN + '/', mode: 'navigate' },
    respondWith: (r) => { respondedWith = r; },
  });
  eq(respondedWith, null, 'a POST navigation must not be served the cached shell');
});

await t('a navigation is handled', () => {
  let respondedWith = null;
  worker.listeners.fetch({
    request: { method: 'GET', url: ORIGIN + '/', mode: 'navigate' },
    respondWith: (r) => { respondedWith = r; },
  });
  ok(respondedWith, 'navigations must reach the shell fallback');
});

await t('an unrecognised third-party request is left alone', () => {
  let respondedWith = null;
  worker.listeners.fetch({
    request: { method: 'GET', url: 'https://example.com/tracker.gif', mode: 'no-cors' },
    respondWith: (r) => { respondedWith = r; },
  });
  eq(respondedWith, null);
});

// ---- the shell that makes the app open offline -----------------------------

await t('a successful navigation caches the shell, and a later offline one serves it', async () => {
  // The whole point of the worker: close the tab on a patchy connection, open
  // it again with no signal, and the app is still there.
  let online = true;
  const w = loadWorker(`${ORIGIN}/sw.js?v=abc1234`, {
    fetchImpl: async () => {
      if (!online) throw new Error('offline');
      return new Response('<!doctype html><title>AURA</title>', {
        status: 200, headers: { 'Content-Type': 'text/html' },
      });
    },
  });

  const navigate = async () => {
    let p = null;
    w.listeners.fetch({
      request: { method: 'GET', url: ORIGIN + '/', mode: 'navigate' },
      respondWith: (r) => { p = r; },
    });
    return p;
  };

  const first = await navigate();
  eq(first.status, 200, 'online, the network answers');

  online = false;
  const second = await navigate();
  eq(second.status, 200, 'offline, the cached shell answers rather than an error page');
  ok((await second.text()).includes('AURA'));
});

await t('a failed navigation is not cached as the shell', async () => {
  // A 502 from the host must not become the thing served offline forever.
  const w = loadWorker(`${ORIGIN}/sw.js?v=abc1234`, {
    fetchImpl: async () => new Response('gateway error', { status: 502 }),
  });
  let p = null;
  w.listeners.fetch({
    request: { method: 'GET', url: ORIGIN + '/', mode: 'navigate' },
    respondWith: (r) => { p = r; },
  });
  await p;
  const shell = await (await w.caches.api.open('aura-shell-abc1234')).match('/index.html');
  eq(shell, undefined, 'a non-ok response must not be stored as the shell');
});

// ---- the last-resort page --------------------------------------------------

await t('with nothing cached and no network, the fallback page still carries the numbers', async () => {
  // The one thing that has to survive every failure this worker can have.
  let responsePromise = null;
  worker.listeners.fetch({
    request: { method: 'GET', url: ORIGIN + '/', mode: 'navigate' },
    respondWith: (r) => { responsePromise = r; },
  });
  const response = await responsePromise;
  const body = await response.text();
  ok(body.includes('112'), 'emergency number missing');
  ok(body.includes('1800-599-0019'), 'KIRAN number missing');
  ok(body.includes('+91 98204 66726'), 'AASRA number missing');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
