/**
 * Leaving fast, and leaving nothing behind.
 *
 * THE THREAT MODEL THIS ANSWERS
 *
 * Every digital-phenotyping system in the literature assumes the person using
 * it controls the device. For a survivor of caste violence or intimate partner
 * violence that assumption is often false: the phone is shared, borrowed,
 * checked, or taken. The systematic review of AI mental-health monitoring for
 * atrocity victims (September 2026) names this as gap G8 and rates its
 * consequence "naive deployment could endanger participants", which is a
 * stronger claim than it first reads. It means the monitoring itself becomes
 * the harm: a record of someone's distress, under their name, on a device the
 * person they are afraid of can pick up.
 *
 * Two concrete failures existed here before this module.
 *
 * There was no way to leave a screen quickly. Someone walking in behind a
 * survivor mid-check-in had to find a tab, or close a browser, while their
 * answers about feeling unsafe were on screen.
 *
 * And signing out left everything. `authService.logout()` removed the session
 * and the token and nothing else, so `aura_participants_v2` kept every
 * check-in, note and alert in plain localStorage indefinitely. The next person
 * to open the phone could read a survivor's full history without signing in as
 * anybody.
 *
 * WHAT THIS IS NOT
 *
 * This is not protection against a forensic adversary, and the product must
 * never imply that it is. Browser history beyond the current entry cannot be
 * cleared from JavaScript, a determined examiner can recover deleted storage,
 * and a device with monitoring software installed is compromised in ways no
 * web page can address. The honest claim is narrower and still worth a great
 * deal: after a quick exit, a person who picks up the phone and looks finds a
 * neutral page and no readable record.
 */

/**
 * Where a quick exit goes.
 *
 * A general-purpose search page rather than a news or weather site, because it
 * is the least remarkable thing to find open on somebody's phone and it is
 * plausible in every region AURA runs in.
 */
export const SAFE_EXIT_URL = "https://www.google.com";

/** Everything AURA writes to web storage is prefixed. */
export const AURA_STORAGE_PREFIX = "aura_";

export interface WipeResult {
  localKeysCleared: string[];
  sessionKeysCleared: string[];
  /** Set when storage was unreadable, e.g. a private window with storage blocked. */
  failed: boolean;
}

const auraKeysIn = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(AURA_STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
};

/**
 * Removes every trace AURA left in readable web storage.
 *
 * Collected before deleting, because removing while iterating over
 * `storage.key(i)` reindexes the store and silently skips entries. That bug
 * would leave a survivor's check-ins behind on roughly every other key while
 * appearing to work.
 *
 * The encrypted IndexedDB sync queue is deliberately left alone. It holds
 * check-ins written while offline that have not reached the server yet, it is
 * not readable by looking at the phone, and discarding it would silently throw
 * away something a person wrote and believed they had submitted.
 */
export function wipeLocalTraces(): WipeResult {
  const result: WipeResult = { localKeysCleared: [], sessionKeysCleared: [], failed: false };
  if (typeof window === "undefined") return result;

  try {
    const keys = auraKeysIn(window.localStorage);
    for (const key of keys) window.localStorage.removeItem(key);
    result.localKeysCleared = keys;
  } catch {
    result.failed = true;
  }

  try {
    const keys = auraKeysIn(window.sessionStorage);
    for (const key of keys) window.sessionStorage.removeItem(key);
    result.sessionKeysCleared = keys;
  } catch {
    result.failed = true;
  }

  return result;
}

export interface QuickExitDeps {
  wipe: () => WipeResult;
  /** Ends the server-side session. Failure here must not delay leaving. */
  signOut: () => Promise<unknown>;
  /** Replaces the current history entry, so Back does not return to AURA. */
  replace: (url: string) => void;
  /** How long to wait for sign-out before leaving anyway, in milliseconds. */
  signOutTimeoutMs: number;
}

/**
 * Leaves AURA immediately.
 *
 * Order is the whole design. The wipe runs first and synchronously, so storage
 * is clear even if everything after it fails. Sign-out is attempted but never
 * waited on indefinitely: a survivor pressing this button has seconds, and a
 * slow network must not hold them on a screen showing their own distress. The
 * navigation is guaranteed to happen, on a timer, whatever the network does.
 *
 * `location.replace` rather than `location.href`, so the current entry is
 * overwritten and the Back button does not return to the page they fled.
 * Entries before this one cannot be removed from JavaScript, which is a real
 * limit and is documented rather than papered over.
 */
export async function quickExit(deps: QuickExitDeps): Promise<void> {
  // First and synchronous. Nothing below is allowed to be a precondition.
  deps.wipe();

  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    deps.replace(SAFE_EXIT_URL);
  };

  const timer = setTimeout(leave, deps.signOutTimeoutMs);
  try {
    await deps.signOut();
  } catch {
    // A failed sign-out is not a reason to keep someone on this screen.
  } finally {
    clearTimeout(timer);
    leave();
  }
}

/**
 * Wires up the keyboard route out.
 *
 * Three presses of Escape inside two seconds. One press is already how every
 * dialog in the app closes, so a single-press exit would fire constantly by
 * accident, and an accidental exit costs a person their session and their
 * place in a check-in. Three is deliberate enough not to happen by mistake and
 * fast enough to do without looking.
 *
 * Returns an unsubscribe function.
 */
export const ESCAPE_PRESSES_TO_EXIT = 3;
export const ESCAPE_WINDOW_MS = 2000;

export function watchForEscapeExit(onExit: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  let presses: number[] = [];
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const now = Date.now();
    presses = presses.filter((t) => now - t < ESCAPE_WINDOW_MS);
    presses.push(now);
    if (presses.length >= ESCAPE_PRESSES_TO_EXIT) {
      presses = [];
      onExit();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
