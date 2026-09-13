/**
 * The reported bug: picking a counsellor said "Your counsellor has been
 * updated" and then every other screen went on naming the old one.
 *
 * select_counsellor() was writing correctly the whole time — assignment_history
 * proved it. What was missing is that the participant record is read from a
 * local cache refilled from the server only at startup, so the app kept
 * rendering the counsellor the person had just left.
 *
 * Also covers the two things that hang off that card: the counsellor's name
 * where the heading used to say "YOUR COUNSELLOR", and the optional "why did
 * you change?" note.
 *
 * TWO HARNESS NOTES, both learned the hard way:
 *  - page.route matches the most recently registered handler first, so the
 *    catch-all goes on FIRST and the specific mocks after it. Registering it
 *    last silently swallows every mock below.
 *  - the catch-all is a RegExp, not a glob. '**supabase.co/**' does not match
 *    these URLs, so requests escaped to the real network, died on the proxy
 *    after a long timeout, and the page sat on "Loading counsellors…" long
 *    enough to look like a rendering bug.
 */
import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass = 0, fail = 0;
const check = (n, c, e = '') => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, e); } };

const UID = '11111111-1111-1111-1111-111111111111';
const SARAH = '22222222-2222-2222-2222-222222222222';
const AMARA = '33333333-3333-3333-3333-333333333333';

const NAMES = { [SARAH]: 'Sarah Jenkins', [AMARA]: 'Amara Devi' };

function directoryRow(id, name, tags) {
  return {
    worker_id: id, display_name: name, photo_path: null,
    bio: `${name} has worked with people facing ${tags[0].replace(/_/g, ' ')} for years.`,
    specialties: tags, languages: ['English'], session_formats: ['chat', 'video'],
    years_experience: 8, gender: null, accepting_new_clients: true,
    rating_avg: null, rating_count: null,
  };
}

const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Records every write the page attempts, so the test can assert on them. */
const writes = [];

async function session(assignedWorker) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });

  // Catch-all first — see the notes at the top of this file.
  await page.route(/supabase\.co\//, (r) => r.fulfill(json([])));

  await page.route(/rest\/v1\/counsellor_directory/, (r) => {
    r.fulfill(json([directoryRow(SARAH, 'Sarah Jenkins', ['legal_stress']),
                    directoryRow(AMARA, 'Amara Devi', ['grief'])]));
  });
  await page.route(/rest\/v1\/rpc\/select_counsellor/, (r) => {
    writes.push({ kind: 'select', body: r.request().postData() });
    r.fulfill(json('P-1'));
  });
  await page.route(/rest\/v1\/counsellor_switch_feedback/, (r) => {
    writes.push({ kind: 'switch_feedback', body: r.request().postData() });
    r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.route(/rest\/v1\/profiles/, (r) => {
    const m = /id=eq\.([0-9a-f-]+)/.exec(r.request().url());
    r.fulfill(json(m && NAMES[m[1]] ? { name: NAMES[m[1]] } : null));
  });
  await page.route('**/api/**', (r) => r.fulfill(json({})));

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([uid, worker]) => {
    localStorage.clear();
    localStorage.setItem('aura_storage_ver_v2', '2.6');
    localStorage.setItem('aura_language', 'en');
    localStorage.setItem('aura_auth_token', 't');
    localStorage.setItem('aura_participants_v2', JSON.stringify([{
      id: uid, name: 'Pushkaraj Narkhede', consentGiven: true, status: 'Stable',
      language: 'English', ageGroup: '25-34', notes: [], checkIns: [],
      assignedWorker: worker || undefined, createdAt: new Date().toISOString(),
    }]));
    localStorage.setItem('aura_auth_session', JSON.stringify({
      id: uid, email: 'p@x.com', role: 'participant', name: 'Pushkaraj Narkhede',
      consentGiven: true, createdAt: new Date().toISOString(),
    }));
  }, [UID, assignedWorker]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  return page;
}

const clickText = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const el = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent || ''));
  if (el) { el.click(); return true; }
  return false;
}, re.source);

const text = (page) => page.evaluate(() => document.body.innerText);

// ---------------------------------------------------------------------------
// 1. The card names the counsellor instead of saying "YOUR COUNSELLOR"
// ---------------------------------------------------------------------------
let page = await session(SARAH);
let body = await text(page);
check('profile card shows the counsellor by name', /Sarah Jenkins/.test(body), body.slice(0, 400));

// ---------------------------------------------------------------------------
// 2. Switching updates what the rest of the app shows — the reported bug
// ---------------------------------------------------------------------------
check('opens the chooser', await clickText(page, /Change my counsellor/));
await page.waitForTimeout(1800);
body = await text(page);
check('chooser lists both counsellors', /Sarah Jenkins/.test(body) && /Amara Devi/.test(body), body.slice(0, 400));

// Pick the one who is not currently assigned.
const picked = await page.evaluate(() => {
  const card = [...document.querySelectorAll('div')].find(
    (d) => /Amara Devi/.test(d.textContent || '') && d.querySelector('button')
      && [...d.querySelectorAll('button')].some((b) => /Select this counsellor/i.test(b.textContent || ''))
      && !/Sarah Jenkins/.test(d.textContent || '')
  );
  const btn = card && [...card.querySelectorAll('button')].find((b) => /Select this counsellor/i.test(b.textContent || ''));
  if (btn) { btn.click(); return true; }
  return false;
});
check('clicked "Select this counsellor" on the other counsellor', picked);
await page.waitForTimeout(1500);

body = await text(page);
check('confirmation names who is now the counsellor',
  /Amara Devi is now your counsellor/i.test(body), body.slice(0, 500));
check('select_counsellor was actually called',
  writes.some((w) => w.kind === 'select' && (w.body || '').includes(AMARA)),
  JSON.stringify(writes));

// ---------------------------------------------------------------------------
// 3. The optional "why did you change?" note, offered only after leaving someone
// ---------------------------------------------------------------------------
check('offers to ask why they changed', /Would you like to say why you changed/i.test(body), body.slice(0, 600));
// The promise made here has to match where the note actually goes. It now
// reaches the counsellor, so the copy says so — and still promises the two
// things the view really does withhold: the name and the date.
const flat = body.replace(/\s+/g, ' ');
check('names the counsellor who will read it',
  /Sarah Jenkins will read this/i.test(flat), flat.slice(0, 900));
check('promises only what the data actually withholds',
  /not your name/i.test(flat) && /not the day you wrote it/i.test(flat), flat.slice(0, 900));
check('does not claim the counsellor is kept in the dark',
  !/is not told/i.test(flat), flat.slice(0, 900));

await page.evaluate(() => {
  const t = document.querySelector('#switch-reason');
  if (t) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(t, 'I wanted someone who works on grief.');
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(300);
check('sends the note', await clickText(page, /Send this/));
await page.waitForTimeout(1200);
check('the note reached the database',
  writes.some((w) => w.kind === 'switch_feedback' && (w.body || '').includes('works on grief')),
  JSON.stringify(writes.map((w) => w.kind)));

// ---------------------------------------------------------------------------
// 4. Back on the profile, the new counsellor is the one shown. This is the
//    assertion the original bug fails: it used to still say Sarah Jenkins.
// ---------------------------------------------------------------------------
check('goes back to the profile', await clickText(page, /^\s*Back\s*$/));
await page.waitForTimeout(2000);
body = await text(page);
check('profile now names the NEW counsellor', /Amara Devi/.test(body), body.slice(0, 600));
check('profile no longer names the old counsellor', !/Sarah Jenkins/.test(body), body.slice(0, 600));
await page.close();

// ---------------------------------------------------------------------------
// 5. With nobody assigned, a first choice must not ask why they "left" anyone
// ---------------------------------------------------------------------------
page = await session(null);
body = await text(page);
check('unassigned profile offers to choose', /Choose a counsellor/i.test(body), body.slice(0, 400));
await clickText(page, /Choose a counsellor/);
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Select this counsellor/i.test(b.textContent || ''));
  btn && btn.click();
});
await page.waitForTimeout(1500);
body = await text(page);
check('a first choice does not ask why they left anyone',
  !/Would you like to say why you changed/i.test(body), body.slice(0, 500));
await page.close();

// ---------------------------------------------------------------------------
// 6. The voice companion is reachable and does not claim to be a person
// ---------------------------------------------------------------------------
page = await session(SARAH);
check('profile offers the voice companion', /Talk It Through/i.test(await text(page)));
check('opens it', await clickText(page, /Start talking/));
await page.waitForTimeout(1200);
body = await text(page);
check('voice page says plainly it is not a person', /This is not a person/i.test(body), body.slice(0, 600));
check('voice page offers emergency help', /Emergency help/i.test(body), body.slice(0, 600));
// The backend origin is now committed as a default, so the feature is on by
// build rather than waiting on a dashboard variable. What must stay true is
// that the page never claims to be switched off when it is configured.
check('does not claim the feature is switched off',
  !/not switched on/i.test(body), body.slice(0, 900));
check('reaches the consent step before any microphone',
  /Start conversation/i.test(body), body.slice(0, 900));
check('AURA is still styled like AURA (voice css did not escape)',
  await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    // The companion's own body rule would paint #f6f4ef -> rgb(246, 244, 239).
    return bg !== 'rgb(246, 244, 239)';
  }));
await page.close();

console.log(`\ncounsellor-switch: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
