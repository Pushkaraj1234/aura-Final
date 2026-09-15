/**
 * Leaving fast, and leaving nothing behind.
 *
 * This is the gap the atrocity-victim literature review (Sept 2026) rates
 * "critical (safety)": every digital-phenotyping system assumes the subject
 * controls the device, and for a survivor of caste or intimate partner
 * violence that is often false. The failure mode is not a bad user experience,
 * it is a record of someone's distress under their own name on a phone the
 * person they are afraid of can pick up.
 *
 * So these tests are about two properties and nothing else: after a wipe there
 * is nothing readable left, and the exit happens even when everything else
 * fails.
 */
import {
  wipeLocalTraces, quickExit, watchForEscapeExit,
  SAFE_EXIT_URL, AURA_STORAGE_PREFIX, ESCAPE_PRESSES_TO_EXIT, ESCAPE_WINDOW_MS,
} from '../dist-test/safetyExit.js';

let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); pass++; console.log('PASS', n); }
                             catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

/** A Storage implementation with the real indexed key() semantics. */
class FakeStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const install = (local, session) => {
  globalThis.window = { localStorage: local, sessionStorage: session };
};

// ---- the wipe --------------------------------------------------------------

await t('every AURA key is removed from both storages', () => {
  const local = new FakeStorage({
    'aura_auth_session': '{}', 'aura_auth_token': 'x',
    'aura_participants_v2': '[{"checkIns":[...]}]', 'aura_alerts_v2': '[]',
    'aura_audit_events_v2': '[]', 'aura_notif_prefs_v2_P1': '{}',
  });
  const session = new FakeStorage({ 'aura_draft': 'half a reflection' });
  install(local, session);

  const r = wipeLocalTraces();
  eq(local.length, 0, 'localStorage must be empty of AURA keys');
  eq(session.length, 0);
  eq(r.localKeysCleared.length, 6);
  eq(r.sessionKeysCleared.length, 1);
  eq(r.failed, false);
});

await t('the cached check-in history is what actually goes', () => {
  // The specific thing that survived sign-out before this existed.
  const local = new FakeStorage({ 'aura_participants_v2': '[{"name":"real person"}]' });
  install(local, new FakeStorage());
  wipeLocalTraces();
  eq(local.getItem('aura_participants_v2'), null);
});

await t('removing while iterating does not skip every other key', () => {
  // Storage.key(i) reindexes on delete, so a naive loop clears only half and
  // looks like it worked. That bug would leave a survivor's check-ins behind.
  const entries = {};
  for (let i = 0; i < 20; i++) entries[`aura_key_${i}`] = 'v';
  const local = new FakeStorage(entries);
  install(local, new FakeStorage());

  const r = wipeLocalTraces();
  eq(local.length, 0, 'all twenty must go');
  eq(r.localKeysCleared.length, 20);
});

await t('storage belonging to other sites on the origin is left alone', () => {
  const local = new FakeStorage({
    'aura_auth_token': 'x', 'theme': 'dark', 'other_app_state': '{}', 'auralike': 'keep',
  });
  install(local, new FakeStorage());
  wipeLocalTraces();
  eq(local.getItem('theme'), 'dark');
  eq(local.getItem('other_app_state'), '{}');
  eq(local.getItem('auralike'), 'keep', 'prefix match, not substring');
  eq(local.getItem('aura_auth_token'), null);
});

await t('the prefix is the one the app actually writes', () => {
  eq(AURA_STORAGE_PREFIX, 'aura_');
});

await t('storage that throws is reported, not crashed on', () => {
  // A private window with site data blocked. The exit must still proceed.
  const hostile = { get length() { throw new Error('blocked'); }, key() { throw new Error('blocked'); },
                    getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  install(hostile, hostile);
  const r = wipeLocalTraces();
  eq(r.failed, true);
});

await t('with no window at all it returns cleanly', () => {
  delete globalThis.window;
  const r = wipeLocalTraces();
  eq(r.failed, false);
  eq(r.localKeysCleared.length, 0);
});

// ---- the exit --------------------------------------------------------------

const exitHarness = (over = {}) => {
  const calls = { wiped: 0, signedOut: 0, replaced: [] };
  const deps = {
    wipe: () => { calls.wiped++; return { localKeysCleared: [], sessionKeysCleared: [], failed: false }; },
    signOut: async () => { calls.signedOut++; },
    replace: (url) => calls.replaced.push(url),
    signOutTimeoutMs: 50,
    ...over,
  };
  return { calls, deps };
};

await t('a quick exit wipes, signs out, and leaves', async () => {
  const { calls, deps } = exitHarness();
  await quickExit(deps);
  eq(calls.wiped, 1);
  eq(calls.signedOut, 1);
  eq(calls.replaced.length, 1);
  eq(calls.replaced[0], SAFE_EXIT_URL);
});

await t('the wipe happens before anything that can fail', async () => {
  // Nothing below the wipe may be a precondition for it.
  const order = [];
  await quickExit({
    wipe: () => { order.push('wipe'); return { localKeysCleared: [], sessionKeysCleared: [], failed: false }; },
    signOut: async () => { order.push('signOut'); },
    replace: () => order.push('replace'),
    signOutTimeoutMs: 50,
  });
  eq(order[0], 'wipe');
});

await t('a failing sign-out does not trap the person on the page', async () => {
  const { calls, deps } = exitHarness({ signOut: async () => { throw new Error('offline'); } });
  await quickExit(deps);
  eq(calls.wiped, 1);
  eq(calls.replaced.length, 1, 'they must still leave');
});

await t('a hanging sign-out does not trap them either', async () => {
  // The case that matters most: a slow network while someone is standing over
  // their shoulder. The navigation is on a timer, not on the network.
  const { calls, deps } = exitHarness({ signOut: () => new Promise(() => {}), signOutTimeoutMs: 30 });
  const exiting = quickExit(deps);
  await new Promise((r) => setTimeout(r, 80));
  eq(calls.replaced.length, 1, 'must leave on the timer');
  eq(calls.replaced[0], SAFE_EXIT_URL);
  void exiting;
});

await t('it never navigates twice, even when the timer and sign-out race', async () => {
  // A double navigation would push an extra history entry, which is the one
  // thing this must not do.
  const { calls, deps } = exitHarness({
    signOut: () => new Promise((r) => setTimeout(r, 30)),
    signOutTimeoutMs: 30,
  });
  await quickExit(deps);
  await new Promise((r) => setTimeout(r, 60));
  eq(calls.replaced.length, 1);
});

await t('the destination is a plausible ordinary page', () => {
  ok(/^https:\/\//.test(SAFE_EXIT_URL), 'must be https');
  ok(!/aura/i.test(SAFE_EXIT_URL), 'must not name the product');
});

// ---- the keyboard route ----------------------------------------------------

const keyHarness = () => {
  const listeners = [];
  globalThis.window = {
    addEventListener: (type, fn) => { if (type === 'keydown') listeners.push(fn); },
    removeEventListener: (type, fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  return {
    listeners,
    press: (key = 'Escape') => listeners.forEach((fn) => fn({ key })),
  };
};

await t('three Escapes leave; one or two do not', () => {
  const h = keyHarness();
  let exits = 0;
  watchForEscapeExit(() => exits++);

  h.press();
  eq(exits, 0, 'one press must not exit, Escape also closes dialogs');
  h.press();
  eq(exits, 0, 'two must not either');
  h.press();
  eq(exits, 1);
});

await t('the count resets, so a fourth press does not exit again', () => {
  const h = keyHarness();
  let exits = 0;
  watchForEscapeExit(() => exits++);
  h.press(); h.press(); h.press();
  eq(exits, 1);
  h.press();
  eq(exits, 1, 'a stray press after an exit must not re-fire');
});

await t('presses spread beyond the window do not accumulate into an exit', async () => {
  const h = keyHarness();
  let exits = 0;
  watchForEscapeExit(() => exits++);
  h.press();
  await new Promise((r) => setTimeout(r, ESCAPE_WINDOW_MS + 50));
  h.press();
  h.press();
  eq(exits, 0, 'the first press has aged out');
});

await t('other keys are ignored', () => {
  const h = keyHarness();
  let exits = 0;
  watchForEscapeExit(() => exits++);
  h.press('a'); h.press('Enter'); h.press('Escape');
  h.press('x'); h.press('Escape'); h.press('Escape');
  eq(exits, 1, 'only the Escapes count, and they still add up');
});

await t('unsubscribing actually detaches the listener', () => {
  const h = keyHarness();
  let exits = 0;
  const stop = watchForEscapeExit(() => exits++);
  stop();
  h.press(); h.press(); h.press();
  eq(exits, 0);
  eq(h.listeners.length, 0);
});

await t('the escape threshold is deliberate, not a single press', () => {
  ok(ESCAPE_PRESSES_TO_EXIT >= 2, 'one press would fire constantly by accident');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
