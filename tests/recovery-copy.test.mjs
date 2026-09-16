/**
 * What the Recovery Hub is allowed to say.
 *
 * Copy in this feature is load-bearing in a way that ordinary product copy is
 * not. A person reads it alone, about their own assault, while deciding whether
 * to spend money they do not have travelling to an office. Four specific
 * failures would be invisible in review and serious in use:
 *
 *   - Promising compensation. Somebody budgets around money that is not coming.
 *   - Implying AURA registered an FIR. Somebody does not go to the police.
 *   - Asserting eligibility. Somebody stops looking at the scheme that would
 *     actually have covered them.
 *   - Quoting amounts, deadlines or section numbers. These vary by state and
 *     change, and a survivor who plans around a wrong figure has been harmed.
 *
 * A type checker cannot catch a sentence, so this reads the sources.
 */
import { readFileSync, readdirSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const SCREEN_DIR = 'src/pages/RecoveryHub';
const SOURCES = [
  ...readdirSync(new URL(`../${SCREEN_DIR}`, import.meta.url))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `${SCREEN_DIR}/${f}`),
  'src/components/Recovery/RecoveryPrimitives.tsx',
  'src/services/recoveryHub.ts',
  'src/services/officialResources.ts',
];

/**
 * Comments are stripped before scanning.
 *
 * The comments in these files discuss the very claims the tests forbid, which
 * is the point of them. Without this the rules could only be satisfied by
 * deleting the explanation of why they exist.
 */
const visibleText = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

/**
 * True when a phrase is negated by something shortly before it.
 *
 * Needed because these screens deliberately say things like "it does not decide
 * whether you qualify for anything", which is the opposite of asserting
 * eligibility and is exactly the honesty these tests exist to protect. A plain
 * keyword scan flags it, and deleting the sentence to satisfy the test would
 * make the page less honest rather than more.
 */
const isNegated = (text, index) => {
  const before = text.slice(Math.max(0, index - 60), index).toLowerCase();
  return /\b(not|never|doesn'?t|does not|don'?t|do not|cannot|can'?t|won'?t|will not|no)\b/
    .test(before);
};

const scanAll = (pattern, label) => {
  for (const rel of SOURCES) {
    const text = visibleText(read(rel));
    const re = new RegExp(pattern.source, pattern.flags.includes('g')
      ? pattern.flags : pattern.flags + 'g');
    for (const m of text.matchAll(re)) {
      if (!isNegated(text, m.index)) {
        throw new Error(`${rel} ${label}: "${m[0].trim()}"`);
      }
    }
  }
};

// ---- it must not promise ---------------------------------------------------

t('nothing promises compensation or an outcome', () => {
  scanAll(
    /\b(you will receive|you'?ll receive|guaranteed?|we guarantee|will be approved|will be granted|is assured)\b/i,
    'promises an outcome'
  );
});

t('nothing asserts eligibility', () => {
  scanAll(
    /\b(you (are|do) (definitely )?(eligible|qualify)|you definitely|you qualify for)\b/i,
    'asserts eligibility'
  );
});

t('nothing predicts the case will succeed', () => {
  scanAll(/\byour case will (be successful|succeed|win)\b/i, 'predicts success');
});

// ---- it must not impersonate an authority ---------------------------------

t('nothing claims AURA registers an FIR or submits an application', () => {
  // The single most dangerous sentence this product could contain: somebody
  // who believes the app filed their FIR does not go to the police.
  const src = read(`${SCREEN_DIR}/RecoveryFir.tsx`);
  const text = visibleText(src);
  ok(!/\b(we|aura) (will )?(register|file|lodge)(s|ed)? (your |an |the )?(fir|complaint)\b/i.test(text),
     'claims to register an FIR');
  ok(/cannot register an FIR/i.test(text),
     'the FIR screen must say outright that AURA cannot register one');
});

t('the compensation screen says AURA does not submit', () => {
  const text = visibleText(read(`${SCREEN_DIR}/RecoveryCompensation.tsx`));
  ok(/can&rsquo;t submit it for you|cannot submit/i.test(text),
     'must state that submission happens on the official portal');
});

// ---- it must not give legal or financial specifics ------------------------

t('no statutory citations anywhere', () => {
  scanAll(/\bsection\s+\d|\bu\/s\s*\d|\bIPC\b|\bCrPC\b|\bBNS\b/i, 'cites a statute');
});

t('no money amounts in the interface', () => {
  // The Maharashtra scheme's range is real and is on the government's own page,
  // which is where it belongs: it changes, and a stale figure here would be
  // read as what this person is getting.
  scanAll(/(₹|\bRs\.?\s*\d|\blakh\b|\bcrore\b)/i, 'quotes an amount');
});

t('no fixed statutory deadlines', () => {
  scanAll(/\bwithin\s+\d+\s+(days?|weeks?|months?|hours?)\b/i, 'states a fixed deadline');
});

// ---- it must say the things that protect people ---------------------------

t('the financial screen carries the eligibility qualification', () => {
  const text = visibleText(read(`${SCREEN_DIR}/RecoveryFinancial.tsx`));
  ok(/may be relevant/i.test(text), 'must say resources "may be relevant"');
  ok(/determined by the relevant authority/i.test(text),
     'must say who actually decides eligibility');
});

t('the case id is never presented as an official number', () => {
  const form = visibleText(read(`${SCREEN_DIR}/RecoveryCaseForm.tsx`));
  const dash = visibleText(read(`${SCREEN_DIR}/RecoveryDashboard.tsx`));
  for (const [name, text] of [['case form', form], ['dashboard', dash]]) {
    // \s+ rather than a literal space: this sentence wraps across source
    // lines, and an exact-phrase match would make the test a check on line
    // width rather than on what the screen says.
    ok(/not\s+an\s+FIR\s+number/i.test(text),
       `${name} must say the case id is not an FIR number`);
  }
});

t('the document centre admits files are not scanned', () => {
  const text = visibleText(read(`${SCREEN_DIR}/RecoveryDocuments.tsx`));
  ok(/not scanned for viruses/i.test(text),
     'must not let a private bucket imply malware scanning');
});

t('the entry screen states what AURA is not', () => {
  const text = visibleText(read(`${SCREEN_DIR}/RecoveryEntry.tsx`));
  ok(/not the police/i.test(text) && /compensation authority/i.test(text),
     'must disclaim being police, court, lawyer or compensation authority');
});

// ---- verification must stay honest ----------------------------------------

t('nothing in the app writes OFFICIALLY_VERIFIED', () => {
  // There is no authorised integration that could justify it. The value exists
  // in the type so the UI can render it if one ever arrives; writing it today
  // would be labelling the user's own note as an authority's confirmation.
  const writers = [
    'src/services/recoveryService.ts',
    ...SOURCES.filter((s) => s.endsWith('.tsx')),
  ];
  for (const rel of writers) {
    const text = visibleText(read(rel));
    const assigns = text.match(/verification:\s*["']OFFICIALLY_VERIFIED["']/);
    if (assigns) throw new Error(`${rel} writes OFFICIALLY_VERIFIED: ${assigns[0]}`);
  }
});

t('the timeline shows the source of every entry', () => {
  const text = read(`${SCREEN_DIR}/RecoveryTimeline.tsx`);
  ok(/VerificationBadge/.test(text),
     'a ladder of ticks without attribution reads as officially confirmed');
});

// ---- official resources ----------------------------------------------------

t('every official resource is https and carries an authority and a check date', () => {
  const src = read('src/services/officialResources.ts');
  const urls = [...src.matchAll(/url:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
  ok(urls.length >= 10, `expected the full catalogue, found ${urls.length}`);
  for (const u of urls) {
    ok(u.startsWith('https://'), `not https: ${u}`);
  }
  const entries = src.split(/\n  \{\n/).slice(1);
  for (const e of entries) {
    ok(/authority:/.test(e), 'a resource with no publisher named');
    ok(/checkedOn:/.test(e), 'a resource with no check date');
  }
});

t('only government and UN hosts are linked', () => {
  // A survivor typing an FIR number into a lookalike is the harm this prevents,
  // so the allowlist is by host, not by how official the name sounds.
  const src = read('src/services/officialResources.ts');
  const urls = [...src.matchAll(/url:\s*\n?\s*"(https:\/\/[^"]+)"/g)].map((m) => m[1]);
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(gov\.in|nic\.in|un\.org|ohchr\.org)\//;
  for (const u of urls) {
    ok(allowed.test(u), `host is not a government or UN domain: ${u}`);
  }
});

t('the link the brief got wrong has not come back', () => {
  // vcTrackingResult.action is not an entry point: it appears in no index or
  // site map and reads as a POST result handler. Tracking for both legal aid
  // and compensation goes through the diary-number form.
  const src = read('src/services/officialResources.ts');
  ok(!/vcTrackingResult/.test(visibleText(src)),
     'vcTrackingResult.action is not a reachable page');
  ok(/applicationTrackingForm\.action/.test(src),
     'the working tracking form must be linked');
});

t('the published-FIR path keeps its verified capitalisation', () => {
  const src = read('src/services/officialResources.ts');
  ok(/citizen\.mahapolice\.gov\.in\/Citizen\/MH\/PublishedFIRs\.aspx/.test(src),
     'the indexed path is /Citizen/MH/; ASP.NET routing is not reliably case-insensitive');
});

t('locale is only appended to portals known to accept it', () => {
  const src = read('src/services/officialResources.ts');
  ok(/scourtapp\\\.nic\\\.in/.test(src) || /scourtapp\.nic\.in\\\//.test(src),
     'localisedUrl must be scoped to the LSAMS host');
  ok(/requestLocale/.test(src));
});

t('the Recovery Hub never persists case data to the browser', () => {
  // The reason this feature has its own service instead of going through
  // participantStore. An FIR number, a caste certificate and an account of an
  // assault sitting in a browser profile is a file waiting to be found on a
  // confiscated phone, for the population least able to absorb that. AURA
  // already ships quick-exit because devices get checked.
  const files = [
    'src/services/recoveryService.ts',
    'src/services/recoveryHub.ts',
    'src/pages/RecoveryHub/index.tsx',
    ...SOURCES.filter((f) => f.endsWith('.tsx')),
  ];
  for (const rel of files) {
    const text = visibleText(read(rel));
    const hit = text.match(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
    if (hit) throw new Error(`${rel} persists to the browser: ${hit[0]}`);
    ok(!/participantStore/.test(text),
       `${rel} must not route case data through participantStore`);
  }
});

t('no case identifier is ever put in a URL', () => {
  // A case id in the address bar is a case id in browser history and on any
  // shared screen.
  const shell = visibleText(read('src/pages/RecoveryHub/index.tsx'));
  ok(!/history\.(push|replace)State|location\.(href|search|hash)\s*=/.test(shell),
     'the shell must not write the sub-view or case id into the URL');
});

t('the negation guard itself works, so the rules above can still fail', () => {
  // A guard that swallowed everything would quietly disable every rule it
  // protects. These two prove it distinguishes the cases.
  const negated = 'this does not decide whether you qualify for anything';
  eq(isNegated(negated, negated.indexOf('you qualify')), true);
  const bare = 'you qualify for this scheme';
  eq(isNegated(bare, bare.indexOf('you qualify')), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
