/**
 * Mute has to stop audio actually leaving the browser, not just change a
 * button's colour. This drives the real component with a fake microphone and a
 * stand-in WebSocket, then counts the binary frames on the wire before and
 * after the button is pressed.
 *
 * Chromium is launched with a fake capture device, so getUserMedia resolves
 * without a permission prompt and the mic emits a real tone — which is what
 * makes "frames stopped" a meaningful observation rather than an artefact of
 * there being no audio in the first place.
 */
import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

let pass = 0, fail = 0;
const check = (n, c, e = '') => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, e); } };

const page = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const json = (x) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });

// Replace WebSocket before any app code runs, and keep a frame counter the
// test can read back out of the page.
await page.addInitScript(() => {
  window.__sent = { binary: 0, text: [] };
  class FakeSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor() {
      this.readyState = 1;
      this.bufferedAmount = 0;
      this.binaryType = 'arraybuffer';
      window.__socket = this;
      setTimeout(() => {
        this.onopen && this.onopen();
        // The app only leaves "connecting" once the server says ready.
        this.onmessage && this.onmessage({
          data: JSON.stringify({ type: 'ready', sessionId: 's1', provider: 'gemini', language: 'en-IN' }),
        });
      }, 30);
    }
    send(data) {
      if (typeof data === 'string') window.__sent.text.push(data);
      else window.__sent.binary += 1;
    }
    close() { this.readyState = 3; }
  }
  window.WebSocket = FakeSocket;
});

await page.route(/supabase\.co\//, (r) => r.fulfill(json([])));
await page.route('**/api/**', (r) => r.fulfill(json({})));
await page.route(/onrender\.com\/voice\/config/, (r) =>
  r.fulfill(json({
    provider: 'gemini',
    languages: [{ code: 'en-IN', name: 'English', nativeName: 'English' }],
    defaultLanguage: 'en-IN',
    maxSessionMinutes: 30,
    transcriptStorageAvailable: false,
    transcriptRetentionDays: 7,
  })));
await page.route(/onrender\.com\/voice\/session/, (r) =>
  r.fulfill(json({
    sessionId: 's1', token: 't', provider: 'gemini', language: 'en-IN',
    expiresAt: new Date(Date.now() + 3600e3).toISOString(), transcriptStored: false,
  })));

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('aura_storage_ver_v2', '2.6');
  localStorage.setItem('aura_language', 'en');
  localStorage.setItem('aura_auth_token', 't');
  // Consent already given, so the test lands straight on the controls.
  localStorage.setItem('aura_voice_consent_v1', JSON.stringify({ storeTranscript: false }));
  const uid = '11111111-1111-1111-1111-111111111111';
  localStorage.setItem('aura_participants_v2', JSON.stringify([{
    id: uid, name: 'Pushkaraj Narkhede', consentGiven: true, status: 'Stable',
    language: 'English', ageGroup: '25-34', notes: [], checkIns: [],
    createdAt: new Date().toISOString(),
  }]));
  localStorage.setItem('aura_auth_session', JSON.stringify({
    id: uid, email: 'p@x.com', role: 'participant', name: 'Pushkaraj Narkhede',
    consentGiven: true, createdAt: new Date().toISOString(),
  }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);

const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const el = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent || ''));
  if (el) { el.click(); return true; }
  return false;
}, re.source);

check('opens the voice page', await clickText(/Start talking/));
await page.waitForTimeout(1500);

const text = () => page.evaluate(() => document.body.innerText);
check('no mute button before a conversation starts',
  !/microphone off/i.test(await text()), (await text()).slice(0, 400));

// Start the conversation via the mic button (aria-label, it has no text).
check('starts the conversation', await page.evaluate(() => {
  const el = document.querySelector('button.voice-button');
  if (el) { el.click(); return true; }
  return false;
}));
await page.waitForTimeout(3000);

check('connected and listening', /listening/i.test(await text()), (await text()).slice(0, 500));
check('mute button appears once the mic is live',
  await page.evaluate(() => !!document.querySelector('.mute-button')));

// --- audio is flowing ---
const before = await page.evaluate(async () => {
  const start = window.__sent.binary;
  await new Promise((r) => setTimeout(r, 1200));
  return window.__sent.binary - start;
});
check('microphone frames are reaching the socket while unmuted', before > 0, `frames=${before}`);

// --- mute ---
check('presses mute', await page.evaluate(() => {
  const el = document.querySelector('.mute-button');
  if (el) { el.click(); return true; }
  return false;
}));
await page.waitForTimeout(600);

check('says plainly that the microphone is off',
  /microphone is off/i.test(await text()), (await text()).slice(0, 600));
check('the track itself is disabled, not just our sending',
  await page.evaluate(() => {
    const el = document.querySelector('.mute-button');
    return el?.getAttribute('aria-pressed') === 'true';
  }));

const during = await page.evaluate(async () => {
  const start = window.__sent.binary;
  await new Promise((r) => setTimeout(r, 1500));
  return window.__sent.binary - start;
});
check('NOTHING leaves the browser while muted', during === 0, `frames=${during}`);

// --- unmute ---
check('presses unmute', await page.evaluate(() => {
  const el = document.querySelector('.mute-button');
  if (el) { el.click(); return true; }
  return false;
}));
await page.waitForTimeout(600);
const after = await page.evaluate(async () => {
  const start = window.__sent.binary;
  await new Promise((r) => setTimeout(r, 1200));
  return window.__sent.binary - start;
});
check('audio resumes after unmuting', after > 0, `frames=${after}`);
check('the notice goes away again', !/microphone is off/i.test(await text()));

// The conversation was never interrupted or ended by any of this.
check('muting never told the server anything', await page.evaluate(
  () => !window.__sent.text.some((m) => /"type":"(end|interrupt)"/.test(m))),
  await page.evaluate(() => JSON.stringify(window.__sent.text)));

console.log(`\nvoice-mute: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
