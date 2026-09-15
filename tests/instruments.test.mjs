/**
 * The instrument layer, and the boundary that makes it worth having.
 *
 * AURA's own score is auditable, not validated. An instrument someone else
 * validated is only useful here if it still means in this app what it means in
 * the literature, so the tests that matter are the ones pinning the exact
 * published specification and the rule that the two scores are never mixed.
 */
import {
  WHO5, INSTRUMENTS, scoreInstrument, administrationProgress,
  who5NeedsALook, IncompleteInstrumentError,
} from '../dist-test/instruments.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };
const throws = (fn, Type) => {
  try { fn(); } catch (e) { if (e instanceof Type) return e; throw new Error(`wrong error: ${e}`); }
  throw new Error('expected a throw');
};

const all = (v) => Object.fromEntries(WHO5.items.map((i) => [i.id, v]));

// ---- the published specification ------------------------------------------

t('WHO-5 has exactly five items, in the published order', () => {
  eq(WHO5.items.length, 5);
  eq(WHO5.items.map((i) => i.id).join(','), 'cheerful,calm,active,rested,interested');
});

t('the item wording is the published wording', () => {
  eq(WHO5.items[0].text, 'I have felt cheerful and in good spirits');
  eq(WHO5.items[1].text, 'I have felt calm and relaxed');
  eq(WHO5.items[2].text, 'I have felt active and vigorous');
  eq(WHO5.items[3].text, 'I woke up feeling fresh and rested');
  eq(WHO5.items[4].text, 'My daily life has been filled with things that interest me');
});

t('the response scale is six points, 0 to 5, not five', () => {
  eq(WHO5.options.length, 6, 'a five-point WHO-5 is not a WHO-5');
  eq(WHO5.options.map((o) => o.value).join(','), '5,4,3,2,1,0');
  eq(WHO5.options.map((o) => o.label).join(' / '),
     'All of the time / Most of the time / More than half of the time / '
     + 'Less than half of the time / Some of the time / At no time');
});

t('the recall window is two weeks and is stated in the instruction', () => {
  ok(/two weeks/i.test(WHO5.instruction), WHO5.instruction);
  ok(/two weeks/i.test(WHO5.recallWindow));
});

// ---- scoring ---------------------------------------------------------------

t('all best answers score raw 25, scaled 100', () => {
  const s = scoreInstrument(WHO5, all(5));
  eq(s.raw, 25); eq(s.scaled, 100); ok(s.complete);
});

t('all worst answers score raw 0, scaled 0', () => {
  const s = scoreInstrument(WHO5, all(0));
  eq(s.raw, 0); eq(s.scaled, 0);
});

t('the documented multiplier holds across the range', () => {
  for (let v = 0; v <= 5; v++) {
    const s = scoreInstrument(WHO5, all(v));
    eq(s.raw, v * 5);
    eq(s.scaled, v * 5 * 4, `raw ${s.raw} should scale by 4`);
  }
});

t('a mixed administration sums its items', () => {
  const s = scoreInstrument(WHO5, { cheerful: 4, calm: 3, active: 2, rested: 1, interested: 0 });
  eq(s.raw, 10); eq(s.scaled, 40);
});

t('an unanswered item is refused, never treated as zero', () => {
  // Zero is "At no time" -- the worst answer -- so defaulting a skipped item
  // would report someone as less well than they said.
  const partial = all(5); delete partial.rested;
  const e = throws(() => scoreInstrument(WHO5, partial), IncompleteInstrumentError);
  eq(e.missing.join(','), 'rested');
});

t('an out-of-range value is refused rather than clamped', () => {
  throws(() => scoreInstrument(WHO5, { ...all(5), calm: 6 }), IncompleteInstrumentError);
  throws(() => scoreInstrument(WHO5, { ...all(5), calm: -1 }), IncompleteInstrumentError);
  throws(() => scoreInstrument(WHO5, { ...all(5), calm: 2.5 }), IncompleteInstrumentError);
});

t('progress can be read without scoring', () => {
  const p = administrationProgress(WHO5, { cheerful: 5, calm: 4 });
  eq(p.answered, 2); eq(p.total, 5); eq(p.complete, false);
  eq(administrationProgress(WHO5, all(3)).complete, true);
});

// ---- versioning ------------------------------------------------------------

t('every score carries the instrument version that produced it', () => {
  const s = scoreInstrument(WHO5, all(3));
  eq(s.instrumentId, 'who5');
  eq(s.instrumentVersion, WHO5.version);
  ok(Number.isInteger(WHO5.version) && WHO5.version >= 1);
});

// ---- the screening threshold ----------------------------------------------

t('the screening cue fires at raw 13 and not at 14', () => {
  ok(who5NeedsALook(scoreInstrument(WHO5, { cheerful: 3, calm: 3, active: 3, rested: 2, interested: 2 })),
     'raw 13 should flag');
  ok(!who5NeedsALook(scoreInstrument(WHO5, { cheerful: 3, calm: 3, active: 3, rested: 3, interested: 2 })),
     'raw 14 should not');
});

// ---- the boundary ----------------------------------------------------------

t('the instrument never imports or references the AURA score', () => {
  // The module must not be able to blend the two even by accident. If this
  // fails, someone has coupled the anchor to the thing it is meant to anchor.
  const exported = Object.keys(INSTRUMENTS);
  eq(exported.join(','), 'who5');
  const s = scoreInstrument(WHO5, all(5));
  eq(Object.prototype.hasOwnProperty.call(s, 'distressScore'), false);
  eq(Object.prototype.hasOwnProperty.call(s, 'auraScore'), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
