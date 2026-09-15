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
