/**
 * The claims AURA makes about itself.
 *
 * This is a text test over a component file, which is unusual and is the point.
 * Four times now a fabricated statistic or an invented mechanism has been
 * found in this product's own self-description: hardcoded cohort percentages,
 * a "4.2% override rate", thresholds that "have been naturally recalibrating",
 * an "automated cryptographic erasure pipeline", and a claim to track
 * "algorithmic parity across synthetic cohorts". Every one of them was written
 * in good faith, sat on a page a reviewer would read as evidence, and was
 * invisible in a diff because nothing about it looked like code.
 *
 * A type checker cannot catch a sentence. This can.
 *
 * The rule being enforced: the responsible-AI surface may describe properties
 * that hold, and must not describe measurements that were never taken or
 * mechanisms that do not exist.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/**
 * Strips block comments and `//` lines, so the explanatory notes that quote a
 * removed claim ("Was: ... naturally recalibrating ...") do not trip the very
 * rules they document. Only text that can reach a screen is checked.
 */
const visibleText = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const BADGES = visibleText(read('src/components/ResponsibleAIBadges.tsx'));
const CONSENT = visibleText(read('src/pages/ConsentManagement.tsx'));
const COMMUNITY = visibleText(read('src/pages/CommunityInsights.tsx'));
const DASHBOARD = visibleText(read('src/pages/SupportDashboard.tsx'));

const surfaces = [
  ['ResponsibleAIBadges', BADGES],
  ['ConsentManagement', CONSENT],
  ['CommunityInsights', COMMUNITY],
  ['SupportDashboard', DASHBOARD],
];

const forbid = (pattern, why) => {
  for (const [name, text] of surfaces) {
    const m = text.match(pattern);
    ok(!m, `${name} claims something untrue (${why}): "${m && m[0]}"`);
  }
};

// ---- measurements nobody took ---------------------------------------------

t('nothing claims to track fairness or parity that is not computed', () => {
  // The Fairness Slices screen is the only place a disparity figure may come
  // from, and it withholds one until there is data.
  forbid(/\btracks?\s+(algorithmic\s+)?(parity|fairness)\b/i, 'no such tracking exists');
  forbid(/\balgorithmic\s+parity\s+across\b/i, 'nothing computes parity');
  forbid(/\bequal\s+heuristic\s+weighting\b/i, 'asserted as an audit result');
  forbid(/\bfair\s+sensitivity\s+curve\b/i, 'no sensitivity curve is computed');
});

t('nothing claims a confidence interval', () => {
  // Nothing in the codebase computes one.
  forbid(/\bconfidence\s+intervals?\b/i, 'no interval is ever computed');
});

t('nothing claims the model was trained or evaluated', () => {
  // The weights were chosen by hand. There is no training and no held-out set.
  forbid(/\bevaluated\s+entirely\s+on\b/i, 'no evaluation was run');
  forbid(/\b(test|validation|holdout|held-out)\s+set\b/i, 'no such set exists');
  forbid(/\btrained\s+(on|against)\b/i, 'nothing is trained');
});

t('nothing claims a mechanism that recalibrates itself', () => {
  // Thresholds move when an administrator edits them, and at no other time.
  forbid(/\b(naturally\s+)?recalibrat/i, 'no self-recalibration exists');
  forbid(/\b(self|auto)[-\s]?(tunes?|tuning|adjusts?|adjusting)\b/i, 'nothing tunes itself');
});

t('nothing promises deletion that does not happen', () => {
  // Withdrawal marks the consent record revoked. It deletes nothing.
  forbid(/\bcryptographic\s+erasure\b/i, 'no erasure pipeline exists');
  forbid(/\bdelete\s+check-in\s+histor(y|ies)\s+anytime\b/i, 'withdrawal deletes nothing');
  forbid(/\bvectors\s+are\s+deleted\b/i, 'nothing is deleted on withdrawal');
});

t('no fabricated statistic has come back', () => {
  // Every one of these was a hardcoded number presented as a measurement.
  forbid(/\b4\.2%|\b5\.3%\s+last\s+month/i, 'fabricated override rate');
  forbid(/\bhigh\s+baseline\s+clinical\s+trust\b/i, 'unmeasured trust claim');
  forbid(/\bsynthetic\s+demonstration\s+aggregates\b/i, 'replaced by computed figures');
  forbid(/\b128\s+synthetic\s+participants\b/i, 'fabricated cohort size');
});

// ---- the claims that must remain -------------------------------------------

t('the fairness card still states the limit that matters', () => {
  // Identical weights do not imply equal accuracy. Deleting the false claim
  // without stating this would leave the page reassuring by omission.
  ok(/not\s+measured/i.test(BADGES), 'must say what has not been measured');
  ok(/machine-translated/i.test(BADGES),
     'must name why a language-blind formula can still be worse in one language');
  ok(/Fairness\s+Slices/i.test(BADGES), 'must point at where the real figure lives');
});

t('the fairness card is honest about caste', () => {
  ok(/[Nn]ot collected/.test(BADGES), 'caste is not collected and the page must say so');
});

t('the human-review claim is kept, because it is true', () => {
  // escalationEngine raises to a person and never contacts anyone itself.
  ok(/[Ee]very alert/.test(BADGES) || /[Hh]uman review/i.test(BADGES));
});

t('the consent screen says what withdrawal actually does', () => {
  ok(/does not\s+delete/i.test(CONSENT), 'must state that past check-ins remain');
});

// ---- the reading library is shared, not duplicated -------------------------

t('both places that show the reading pieces read the one module list', () => {
  // These appear on the landing page, in front of the sign-up wall, and inside
  // the app for signed-in participants. The two now present them differently,
  // a flip-card grid and a ruled accordion, because a visitor scanning a
  // homepage and somebody who opened the reading page deliberately are doing
  // different things. What must never differ is the words: if either ever
  // inlines its own copy the two will drift, and the version a person reads
  // BEFORE deciding to trust us is the one that would go stale.
  const landing = read('src/pages/LandingPage.tsx');
  const inApp = read('src/pages/WhatToExpect.tsx');

  ok(/<LiteracyCards/.test(landing), 'the landing page renders the card grid');
  ok(/<LiteracyLibrary/.test(inApp), 'the signed-in page renders the accordion');

  for (const [name, source] of [['LandingPage', landing], ['WhatToExpect', inApp]]) {
    ok(!/LITERACY_MODULES/.test(source),
       `${name} must not read the module list itself; that is a component's job`);
  }

  for (const rel of [
    'src/components/LiteracyCards.tsx',
    'src/components/LiteracyLibrary.tsx',
  ]) {
    ok(/LITERACY_MODULES/.test(read(rel)),
       `${rel} must take its content from literacyModules`);
  }
});

t('the card grid types none of the reading content into itself', () => {
  // The whole point of two presentations over one source. A title copied in
  // here would look right the day it was written and be wrong the day the
  // module changed.
  const cards = read('src/components/LiteracyCards.tsx');
  const forbidden = [
    "What distress is",
    "What a counsellor here",
    "What the court process usually looks like",
    "What AURA does with what you tell it",
    "min read.",
  ];
  for (const phrase of forbidden) {
    // "min read." is allowed inside the aria-label template, where it is
    // interpolated rather than typed; a literal title never is.
    if (phrase === 'min read.') continue;
    ok(!cards.includes(phrase), `card grid hardcodes content: "${phrase}"`);
  }
  ok(/\{module\.title\}/.test(cards) && /\{module\.summary\}/.test(cards) &&
     /\{module\.minutes\}/.test(cards) && /\{module\.prompt\}/.test(cards),
     'every piece of card text must come from the module');
});

t('nothing important is reachable only by flipping a card', () => {
  // A screen reader user never hovers, so the faces are decoration and the
  // button carries the whole card in its accessible name.
  const cards = read('src/components/LiteracyCards.tsx');
  ok(/aria-label=\{`\$\{module\.prompt\}[\s\S]{0,200}module\.minutes/.test(cards),
     'the accessible name must carry prompt, article and reading time together');
  const faces = cards.match(/aria-hidden="true"\s*\n\s*className="flip-face/g) || [];
  ok(faces.length === 2, `both faces must be aria-hidden; found ${faces.length}`);
});

t('a device without hover still reaches the back of the card', () => {
  const cards = read('src/components/LiteracyCards.tsx');
  ok(/\(hover: hover\)/.test(cards), 'hover capability must be detected, not assumed');
  ok(/!canHover && tapped !== id/.test(cards),
     'without hover the first tap must turn the card rather than opening it');
});

t('the landing cards still track nothing about what was read', () => {
  const cards = read('src/components/LiteracyCards.tsx');
  ok(!/localStorage|sessionStorage|apiService|supabase/i.test(cards),
     'the reading cards must not persist or report anything');
});

t('the accordion reads its content from the one module list', () => {
  const lib = read('src/components/LiteracyLibrary.tsx');
  ok(/LITERACY_MODULES/.test(lib), 'content comes from literacyModules, never inlined');
  ok(/\{module\.minutes\}\s*min read/.test(lib),
     'reading times come from the data, not typed into the markup');
});

t('a row is labelled by the reader\'s own sentence, not by the article title', () => {
  // The whole reason this is not a list of article cards. Somebody who cannot
  // name what is happening to them can still recognise "I don't understand
  // what I'm feeling"; they cannot reliably pick "What distress is, and what
  // it isn't" out of four headlines. If a refactor ever puts the title back in
  // the trigger, the section has quietly become a menu again.
  const lib = read('src/components/LiteracyLibrary.tsx');
  const trigger = lib.slice(lib.indexOf('<button'), lib.indexOf('</button>'));
  ok(/\{module\.prompt\}/.test(trigger), 'the trigger must render the prompt');
  ok(!/\{module\.title\}/.test(trigger),
     'the article title belongs in the opened panel, not in the closed row');
});

t('the library still tracks nothing about what was read', () => {
  // A progress flag here would end up in a counsellor's view of a survivor.
  const lib = read('src/components/LiteracyLibrary.tsx');
  ok(!/localStorage|sessionStorage|apiService|supabase/i.test(lib),
     'the reading library must not persist or report anything');
});

t('the explanatory comments naming removed claims are still present', () => {
  // The stripping above must not be hiding a regression: these notes live in
  // comments and record what was removed and why. If they vanish, someone has
  // rewritten these files and the tests above may be passing vacuously.
  const raw = read('src/components/ResponsibleAIBadges.tsx');
  // Matched with \s+ because the note is wrapped across comment lines; an
  // exact-phrase match failed here for that reason alone and would have made
  // this test a spelling check on line width rather than on content.
  ok(/algorithmic\s+parity\s+across\s+synthetic\s+\*?\s*cohorts/.test(raw),
     'the note recording the removed parity claim should remain in a comment');
  ok(/Nothing was tracked/.test(raw),
     'the note should say plainly that nothing was behind the old claim');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
