/**
 * Registers the offline shell, and refuses to in the places where a service
 * worker causes more harm than it prevents.
 *
 * A service worker is sticky. Once installed on an origin it keeps serving
 * that origin until it is explicitly unregistered, which is exactly what you
 * want on a phone with no signal and exactly what you do not want in a dev
 * server that is rebuilding the bundle every few seconds. So this registers
 * in production builds only, and actively cleans up any worker it finds in
 * development, because one installed by accident during local work will
 * otherwise keep serving a stale bundle long after the tab that installed it
 * is gone.
 */

const SW_PATH = "/sw.js";

const buildId = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/**
 * Removes the worker and everything it cached.
 *
 * A service worker is the one thing here that keeps running after a bad
 * deploy: it is sticky by design, it survives a reload, and a person on a
 * phone cannot open devtools to get rid of it. So there is a way out that
 * does not require them to do anything but follow a link. Visiting
 * /?nosw=1 unregisters and clears, and the next ordinary visit is a plain
 * online app again.
 */
async function unregisterOfflineShell(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("aura-")).map((n) => caches.delete(n)));
    }
  } catch {
    // Nothing useful to do, and nothing worth interrupting anybody over.
  }
}

export function registerOfflineShell(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // The escape hatch, checked before anything is installed.
  if (new URLSearchParams(window.location.search).has("nosw")) {
    void unregisterOfflineShell();
    return;
  }

  // Development: remove rather than install. An orphaned worker from an
  // earlier session is a genuinely confusing bug to chase.
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((r) => void r.unregister()))
      .catch(() => undefined);
    return;
  }

  // After load, so installing the worker never competes with the first paint
  // on the slow connections this exists for.
  window.addEventListener("load", () => {
    // The build id rides in the URL so a new deploy is a byte-different script
    // and the browser installs it. Without it the worker is only re-fetched on
    // the browser's own schedule and a fix can sit undelivered for a day.
    void navigator.serviceWorker
      .register(`${SW_PATH}?v=${encodeURIComponent(buildId)}`)
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            // A new worker is ready and an old one is still in control. Hand
            // over now rather than waiting for every tab to close: this app's
            // crisis copy and helpline numbers need to be current, and a
            // person who reloads after an update should get it.
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              incoming.postMessage("aura-skip-waiting");
            }
          });
        });
      })
      .catch(() => {
        // A failed registration is not worth interrupting anybody over. The
        // app works online exactly as it did before; it just will not open
        // without a connection.
      });
  });
}

/** Whether the browser currently believes it has a connection. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Calls back whenever connectivity changes. Returns an unsubscribe function.
 *
 * navigator.onLine is unreliable in one direction only: it can report true on
 * a connection that goes nowhere. It is trustworthy when it says false, which
 * is the case this is used for.
 */
export function watchConnectivity(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
