/**
 * The reading library's content rules.
 *
 * Copy does not usually get tests. This copy does, because it is the only
 * place in AURA that talks to a survivor about their own distress and about a
 * court process, at length, without a counsellor in the room. Three specific
 * ways it could go wrong would be invisible in review and serious in use:
 *
 *   - Drifting into diagnosis. AURA does not diagnose, and a page that names a
 *     condition at someone reading alone at night has done exactly that.
 *   - Drifting into legal advice. Amounts, deadlines and section numbers vary
 *     by state and change; a survivor who plans around a wrong figure here has
 *     been actively harmed.
 *   - Promising outcomes. "This will help you feel better" sets a person up to
 *     conclude they failed at reading.
 */
import { LITERACY_MODULES, literacyModule, totalReadingMinutes }
  from '../dist-test/literacyModules.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const allText = LITERACY_MODULES.flatMap((m) => [
  m.title, m.summary, m.takeaway,
  ...m.sections.flatMap((s) => [s.heading, s.body]),
]);
const corpus = allText.join('\n');

// ---- shape ----------------------------------------------------------------

t('every module is complete and readable', () => {
  ok(LITERACY_MODULES.length >= 4, 'at least four modules');
  for (const m of LITERACY_MODULES) {
    ok(m.id && m.title && m.summary && m.takeaway, `${m.id}: missing a field`);
    ok(m.minutes > 0 && m.minutes <= 10, `${m.id}: implausible reading time`);
    ok(m.sections.length >= 3, `${m.id}: too thin to be worth opening`);
    for (const s of m.sections) {
      ok(s.heading.length > 0, `${m.id}: a section with no heading`);
      ok(s.body.length > 80, `${m.id}/${s.heading}: a section too short to say anything`);
    }
  }
});

t('module ids are unique, so lookup and the open/closed state cannot collide', () => {
  const ids = LITERACY_MODULES.map((m) => m.id);
  eq(new Set(ids).size, ids.length);
});

t('lookup works and misses safely', () => {
  eq(literacyModule('court').id, 'court');
  eq(literacyModule('nope'), undefined);
});

t('the total reading time matches the parts', () => {
  eq(totalReadingMinutes(), LITERACY_MODULES.reduce((s, m) => s + m.minutes, 0));
});

// ---- it must not diagnose --------------------------------------------------

t('no condition is named at the reader', () => {
  // AURA does not diagnose. A page read alone at night must not either.
  const conditions = /\b(PTSD|post[- ]traumatic stress disorder|depression|depressive disorder|anxiety disorder|bipolar|psychosis|psychotic|schizophreni)/i;
  const hit = allText.find((text) => conditions.test(text));
  eq(hit, undefined, `names a condition: ${hit}`);
});

t('no diagnostic second person', () => {
  const claims = /\byou (have|are suffering from|are experiencing a|likely have)\b.{0,40}\b(disorder|condition|illness)\b/i;
  const hit = allText.find((text) => claims.test(text));
  eq(hit, undefined, `tells the reader what they have: ${hit}`);
});

// ---- it must not give legal advice -----------------------------------------

t('the court module says plainly that it is not legal advice', () => {
  const court = literacyModule('court');
  ok(/not legal advice/i.test(JSON.stringify(court)), 'the disclaimer must be in the text');
});

t('no section numbers, act citations or statutory references', () => {
  // These change, vary by state, and are exactly what a survivor would act on.
  const legalCitation = /\bsection\s+\d|\bu\/s\s*\d|\bIPC\b|\bCrPC\b|\bBNS\b|\bact,?\s+(19|20)\d{2}\b/i;
  const hit = allText.find((text) => legalCitation.test(text));
  eq(hit, undefined, `cites a statute: ${hit}`);
});

t('no money amounts anywhere', () => {
  // A compensation figure that is wrong, or right for another state, is worse
  // than saying nothing: somebody plans around it.
  const money = /(₹|\bRs\.?\s*\d|\brupees\b|\blakh\b|\bcrore\b|\$\d)/i;
  const hit = allText.find((text) => money.test(text));
  eq(hit, undefined, `quotes an amount: ${hit}`);
});

t('no statutory deadlines or timeframes presented as fixed', () => {
  const deadline = /\bwithin\s+\d+\s+(days?|weeks?|months?|hours?)\b/i;
  const hit = allText.find((text) => deadline.test(text));
  eq(hit, undefined, `states a fixed deadline: ${hit}`);
});

// ---- it must not promise -----------------------------------------------------

/**
 * True when a phrase is negated by something just before it.
 *
 * Needed because the counsellor module deliberately says they "can't promise
 * that talking will make you feel better", which is the opposite of a promise
 * and is exactly the honesty this file is meant to protect. A plain keyword
 * scan flags it, and deleting the sentence to satisfy the test would make the
 * page less honest, not more.
 */
const isNegated = (text, index) => {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  return /\b(can'?t|cannot|won'?t|will not|doesn'?t|does not|never|no one|nobody|nothing)\b/.test(before);
};

const findUnnegated = (pattern) => {
  for (const text of allText) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const match of text.matchAll(re)) {
      if (!isNegated(text, match.index)) return `${match[0]} :: ${text}`;
    }
  }
  return undefined;
};

t('nothing promises an outcome or a better feeling', () => {
  const promise = /\b(will (make you feel|help you feel|get better|cure|heal you)|guarantee[ds]?|you will recover)\b/i;
  const hit = findUnnegated(promise);
  eq(hit, undefined, `promises an outcome: ${hit}`);
});

t('the negation guard itself works, so the test above can still fail', () => {
  // A guard that swallows everything would quietly disable the rule it
  // protects. These two prove it distinguishes the cases.
  eq(isNegated('they cannot promise this will help', 'they cannot promise this '.length), true);
  eq(isNegated('this will help you feel better', 0), false);
});

t('nothing claims reading changes the score', () => {
  const scoreClaim = /\b(lower|reduce|improve|bring down)s?\s+your\s+(score|number)\b/i;
  const hit = allText.find((text) => scoreClaim.test(text));
  eq(hit, undefined, `ties reading to the score: ${hit}`);
});

// ---- the things it must say ------------------------------------------------

t('distress is framed as a response rather than a fault', () => {
  const distress = literacyModule('distress');
  const text = JSON.stringify(distress);
  ok(/not (a fault|signs of weakness|a defect)/i.test(text),
     'the central claim of this module must be stated outright');
});

t('the crisis route is named in the distress module, not only elsewhere', () => {
  // The module about feeling badly is where someone in trouble is reading.
  ok(/emergency/i.test(JSON.stringify(literacyModule('distress'))));
});

t('the counsellor module states the limits, not only the offer', () => {
  const text = JSON.stringify(literacyModule('counsellor'));
  ok(/can'?t|cannot|aren'?t your lawyer/i.test(text), 'limits must be stated');
  ok(/lawyer/i.test(text), 'the counsellor/lawyer distinction is the one people get wrong');
});

t('the AURA module admits what is unvalidated', () => {
  // The same admission the product makes everywhere else. If this page were
  // more confident than EVALUATION_PROTOCOL.md, the page would be lying.
  const text = JSON.stringify(literacyModule('aura'));
  ok(/not a diagnosis/i.test(text));
  ok(/chosen by the people who built this|not derived/i.test(text),
     'must say the formula was chosen rather than derived');
});

t('the AURA module matches the consent screen: four separate voice-related choices', () => {
  // If these two ever disagree, the page is describing a product that does not
  // exist. Phase 4 split one voice switch into three, plus reflection sharing.
  const text = JSON.stringify(literacyModule('aura'));
  ok(/four separate choices/i.test(text));
});

t('no emoji anywhere', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const hit = allText.find((text) => emoji.test(text));
  eq(hit, undefined, `contains an emoji: ${hit}`);
});

t('no em-dashes, matching the rest of the copy', () => {
  ok(!corpus.includes('—'), 'em-dash found');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
