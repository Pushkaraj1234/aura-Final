/**
 * AURA's offline shell.
 *
 * WHY THIS EXISTS
 *
 * offlineStorage.ts already queues check-ins written while the connection is
 * down, encrypted, in IndexedDB. That only helps someone whose tab is already
 * open. Close it on a patchy connection, or open the app in a village with no
 * signal, and there was nothing to load at all: a blank page, and no way to
 * reach the crisis numbers. The umbrella review this was audited against
 * names offline capability three separate times as the thing that made rural
 * adoption work, and it is the single most reachability-limiting gap AURA had.
 *
 * WHAT IT WILL NOT CACHE, AND WHY THAT MATTERS MORE HERE THAN USUAL
 *
 * Nothing from /api/ and nothing from Supabase, ever. For most products a
 * cached API response is a staleness bug. For this one it is a disclosure: a
 * survivor's check-ins, alerts and messages written to the disk cache of a
 * device that may be shared, borrowed, or taken. The data layer is online-only
 * on purpose, and the encrypted IndexedDB queue is the only place anything
 * personal is allowed to rest.
 *
 * So this caches the application itself and nothing about anybody.
 *
 * STRATEGY
 *
 *   navigation      network first, falling back to the cached shell
 *   static assets   cache first, revalidated in the background
 *   fonts           cache first, revalidated in the background
 *   everything else passed straight through, uncached
 *
 * Network-first for navigation rather than cache-first is deliberate: a
 * cache-first shell serves the previous build until the next reload, and this
 * is an app whose crisis copy and helpline numbers have to be current.
 */

// Registered as /sw.js?v=<build id>, so a new build produces a byte-different
// script URL and the browser installs it rather than reusing the old worker.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL_CACHE = `aura-shell-${VERSION}`;
const ASSET_CACHE = `aura-assets-${VERSION}`;
const FONT_CACHE = `aura-fonts-${VERSION}`;
const CURRENT = new Set([SHELL_CACHE, ASSET_CACHE, FONT_CACHE]);

const SHELL_URL = "/index.html";

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/** Hosts and paths that must never touch a cache. */
const isPrivate = (url) =>
  url.pathname.startsWith("/api/") ||
  url.hostname.endsWith(".supabase.co") ||
  url.hostname.endsWith(".supabase.in") ||
  url.pathname.startsWith("/voice/");

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") ||
    /\.(js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|ico|webmanifest)$/i.test(url.pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Bypass the HTTP cache so a fresh worker never installs a stale shell.
      await cache.add(new Request(SHELL_URL, { cache: "reload" })).catch(() => undefined);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("aura-") && !CURRENT.has(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/** Cache first, refresh in the background. Only ever called for app assets. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) {
    // Revalidate without blocking. A failure here is normal when offline.
    void fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => undefined);
    return hit;
  }
  const response = await fetch(request);
  // Opaque responses (cross-origin fonts) have status 0 and are still worth
  // keeping; response.ok is false for them, so check the type as well.
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

/** Network first, falling back to the shell so the app still opens offline. */
async function navigateWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(SHELL_URL, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const shell = await cache.match(SHELL_URL);
    if (shell) return shell;
    // Nothing cached and no network. Better than the browser's error page,
    // and it carries the emergency number, which is the one thing that has to
    // survive every failure this file can have.
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <title>AURA is offline</title></head>
       <body style="font-family:system-ui,sans-serif;background:#FAF7F4;color:#3C3530;margin:0;padding:2rem;line-height:1.6">
       <h1 style="font-size:1.4rem">AURA can't reach the internet</h1>
       <p>Open this page again once you have a signal, and everything will be where you left it.</p>
       <p style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #E0D7CE">
       If you need help right now, these work without the app:<br>
       <strong>Emergency: 112</strong><br>
       <strong>KIRAN, free, 24 hours: 1800-599-0019</strong><br>
       <strong>AASRA, 24 hours: +91 98204 66726</strong></p>
       </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never cached, never intercepted. Let these fail the way they would
  // without a service worker, so the app's own offline handling still sees a
  // real network error rather than a stale success.
  if (isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigateWithFallback(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
});

// Lets the page hand over a new build without waiting for every tab to close.
self.addEventListener("message", (event) => {
  if (event.data === "aura-skip-waiting") void self.skipWaiting();
});

/**
 * Exposed for tests. The rule that /api, Supabase and the voice backend are
 * never cached is the one property in this file whose regression would be
 * silent and serious, so it is reachable from outside rather than only
 * observable by inspecting a device's disk cache.
 */
self.__auraSwInternals = { isPrivate, isStaticAsset, VERSION, SHELL_URL };
