/**
 * The crisis gate in front of the assistant chat.
 *
 * Two kinds of failure matter here and they are not symmetric.
 *
 * A MISS is someone telling AURA they want to die and getting a chatbot
 * answer. There is no recovering from that one, so the self-harm tests below
 * include the ways people actually phrase it rather than the tidy phrasings a
 * keyword list is written against.
 *
 * A FALSE FIRE is a survivor describing the attack they survived and being
 * shown an emergency banner instead of being heard. That is not merely noisy:
 * this platform exists for people whose ordinary subject matter is violence,
 * and a detector that treats every account of it as a live emergency would be
 * switched off within a week, taking the real detections with it.
 *
 * So the past-narrative tests are load-bearing, not politeness.
 */
import { detectCrisis, screenAssistantReply, crisisResponse, crisisAlertReason, crisisAlertAction }
  from '../dist-test/crisisDetection.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const fires = (text, tier) => {
  const r = detectCrisis(text);
  eq(r.triggered, true, `should fire on ${JSON.stringify(text)}:`);
  if (tier) eq(r.tier, tier, `wrong tier for ${JSON.stringify(text)}:`);
  ok(r.matched, 'a firing detection must say what matched');
};
const quiet = (text) => {
  const r = detectCrisis(text);
  eq(r.triggered, false, `should stay quiet on ${JSON.stringify(text)}:`);
};

// ---- self-harm: fires, in any tense, with no escape hatch -----------------

t('the plain phrasings fire', () => {
  fires('I want to kill myself', 'self_harm');
  fires('i want to die', 'self_harm');
  fires('I am thinking about suicide', 'self_harm');
  fires('I want to end my life', 'self_harm');
  fires('I am going to end it all', 'self_harm');
  fires('I would be better off dead', 'self_harm');
});

t('the phrasings people actually use fire too', () => {
  // Each of these is a real register that a tidy keyword list misses.
  fires("I don't want to live anymore", 'self_harm');
  fires('i dont want to live any more', 'self_harm');
  fires('I do not want to wake up tomorrow', 'self_harm');
  fires('there is no point in living', 'self_harm');
  fires("I don't see the point in going on", 'self_harm');
  fires('I wanna die', 'self_harm');
  fires('I want to be dead', 'self_harm');
  fires('my life is not worth living', 'self_harm');
});

t('self-injury phrasings fire, hyphenated or not', () => {
  fires('I have been cutting myself', 'self_harm');
  fires('I self-harm when it gets bad', 'self_harm');
  fires('I self harm sometimes', 'self_harm');
  fires('I want to hurt myself', 'self_harm');
  fires('I keep hurting myself', 'self_harm');
  fires('I took an overdose last month', 'self_harm');
});

t('case and punctuation do not let it through', () => {
  fires('KILL MYSELF', 'self_harm');
  fires('I want to KiLl MySeLf.', 'self_harm');
  fires('   suicidal   ', 'self_harm');
});

t('self-harm is never suppressed by a past-tense marker', () => {
  // Deliberate. Someone writing about last year is telling us about now, and
  // the cost of offering support to a person who did not need it right this
  // minute is small compared with the cost of the opposite mistake.
  fires('Last year I wanted to die', 'self_harm');
  fires('In 2019 I tried to kill myself', 'self_harm');
  fires('I used to self-harm when I was younger', 'self_harm');
});

t('Hindi and Marathi self-harm language fires', () => {
  fires('मुझे आत्महत्या का ख्याल आता है', 'self_harm');
  fires('मैं जीना नहीं चाहता', 'self_harm');
  fires('मला मरायचं आहे', 'self_harm');
  fires('मला आता जगायचं नाही', 'self_harm');
  fires('स्वतःला संपवायचं वाटतं', 'self_harm');
});

// ---- imminent danger: fires unless the text reads as past narrative -------

t('a live third-party threat fires', () => {
  fires('he is going to kill me', 'imminent_danger');
  fires('they will kill me if I go back', 'imminent_danger');
  fires('someone is following me', 'imminent_danger');
  fires('my life is in danger', 'imminent_danger');
  fires('they threatened to kill my brother', 'imminent_danger');
  fires('I am not safe', 'imminent_danger');
});

t('Hindi and Marathi danger language fires', () => {
  fires('मेरी जान को खतरा है', 'imminent_danger');
  fires('माझ्या जीवाला धोका आहे', 'imminent_danger');
  fires('मी सुरक्षित नाही', 'imminent_danger');
});

t('a survivor describing the attack they survived is NOT an emergency', () => {
  // The whole reason this module exists rather than reusing checkUrgentSafety.
  quiet('They attacked my brother in 2019 and the case is still going');
  quiet('He threatened to kill us last year, before the FIR');
  quiet('I was not safe back then, when I was living in the village');
  quiet('That night they were chasing me through the fields');
  quiet('Two years ago someone was following me every day');
});

t('but a present marker beats a date in the same sentence', () => {
  // "It started in 2019 and he is outside right now" is a live emergency that
  // happens to contain a year.
  fires('They attacked us in 2019 and he is outside my house right now', 'imminent_danger');
  fires('Last year he threatened to kill me, and he is about to do it tonight', 'imminent_danger');
});

t('violence vocabulary alone is a case description, not an emergency', () => {
  // The combination rule, tested from the quiet side. If these ever start
  // firing, every survivor describing what happened gets an emergency panel.
  quiet('They attacked my brother and the case is still going');
  quiet('The mob came to our street');
  quiet('He threatened my father before the FIR was filed');
  quiet('I was beaten and nobody helped');
});

t('the same vocabulary next to a present marker is a live report', () => {
  fires('They attacked us and it is happening again', 'imminent_danger');
  fires('The mob is outside my door right now', 'imminent_danger');
  fires('आत्ता माझ्यावर हमला होतोय', 'imminent_danger');
});

t('a present marker without violence vocabulary stays quiet', () => {
  // Otherwise "my son is outside playing right now" is an emergency.
  quiet('My son is outside playing right now');
  quiet('I am filling this in right now');
  quiet('Currently I feel a bit better');
  quiet('I have a hearing today');
});

t('a suppressed match still records what it saw and why it stood down', () => {
  const r = detectCrisis('He threatened to kill me last year');
  eq(r.triggered, false);
  ok(r.matched, 'the near-miss must stay inspectable');
  ok(r.suppressedBy, 'and must say which marker stood it down');
});

t('ambiguous danger with no marker either way fires', () => {
  // Same rule as slaEngine.bandFor: when the system cannot tell, it fails
  // towards attention rather than away from it.
  fires('someone is hurting me', 'imminent_danger');
  fires('they are coming for me', 'imminent_danger');
});

// ---- ordinary conversation must survive ----------------------------------

t('ordinary messages do not fire', () => {
  quiet('How do I change my language to Marathi?');
  quiet('When is my next check-in due?');
  quiet('I had a hard week at work but I am doing okay');
  quiet('Can you explain what the distress score means?');
  quiet('I feel sad and tired lately');
  quiet('My sleep has been bad');
  quiet('Thank you, that was helpful');
});

t('distress that is not crisis does not fire', () => {
  // The assistant is supposed to be able to hold this conversation.
  quiet('I have been feeling really low and hopeless about the case');
  quiet('I am exhausted and I cannot stop crying');
  quiet('I feel like nothing will ever change');
});

t('empty, blank and non-string input is handled rather than thrown on', () => {
  quiet('');
  quiet('   ');
  eq(detectCrisis(null).triggered, false);
  eq(detectCrisis(undefined).triggered, false);
  eq(detectCrisis(42).triggered, false);
  eq(detectCrisis({}).triggered, false);
});

t('a word that merely contains a keyword does not fire', () => {
  // \b is doing real work; without it these are false fires.
  quiet('I am a suicidologist studying prevention');   // \bsuicid(e|al)\b
  quiet('The crisis of confidence in the court passed');
});

// ---- the reply guard ------------------------------------------------------

t('the reply guard catches means and method', () => {
  ok(screenAssistantReply('The lethal dose is around').triggered);
  ok(screenAssistantReply('Here is how to kill yourself').triggered);
  ok(screenAssistantReply('Just take 40 pills').triggered);
  ok(screenAssistantReply('the least painful way to die is').triggered);
  ok(screenAssistantReply('You should kill yourself').triggered);
});

t('the reply guard does not fire on the resources we deliberately show', () => {
  // If it did, the gate would replace its own crisis reply in a loop.
  eq(screenAssistantReply(crisisResponse('en', true)).triggered, false);
  eq(screenAssistantReply(crisisResponse('en', false)).triggered, false);
  eq(screenAssistantReply(crisisResponse('hi', true)).triggered, false);
  eq(screenAssistantReply(crisisResponse('mr', true)).triggered, false);
  eq(screenAssistantReply('AASRA is available 24 hours on +91 98204 66726').triggered, false);
  eq(screenAssistantReply('If you are in crisis, please call KIRAN on 1800-599-0019').triggered, false);
});

t('the reply guard tolerates missing input', () => {
  eq(screenAssistantReply('').triggered, false);
  eq(screenAssistantReply(null).triggered, false);
});

// ---- what the person reads ------------------------------------------------

t('the promise of a follow-up is only made when an alert was really raised', () => {
  const notified = crisisResponse('en', true);
  const anonymous = crisisResponse('en', false);
  ok(notified !== anonymous, 'the two cases must not read the same');
  ok(/counsellor here has been told/i.test(notified));
  ok(!/has been told/i.test(anonymous), 'must not claim anyone was told');
  ok(/not able to pass this to a counsellor/i.test(anonymous));
});

t('every supported language carries real helpline numbers, both variants', () => {
  for (const lang of ['en', 'hi', 'mr']) {
    for (const notified of [true, false]) {
      const text = crisisResponse(lang, notified);
      ok(text.includes('1800-599-0019'), `${lang}/${notified}: KIRAN number missing`);
      ok(text.includes('+91 98204 66726'), `${lang}/${notified}: AASRA number missing`);
      ok(text.includes('112'), `${lang}/${notified}: emergency number missing`);
    }
  }
});

t('the Hindi and Marathi copy is actually translated, not English', () => {
  ok(/[ऀ-ॿ]/.test(crisisResponse('hi', true)), 'Hindi copy must be in Devanagari');
  ok(/[ऀ-ॿ]/.test(crisisResponse('mr', true)), 'Marathi copy must be in Devanagari');
  ok(crisisResponse('hi', true) !== crisisResponse('mr', true), 'hi and mr must differ');
});

t('an unknown or missing language falls back to English rather than breaking', () => {
  eq(crisisResponse('fr', true), crisisResponse('en', true));
  eq(crisisResponse(undefined, true), crisisResponse('en', true));
  eq(crisisResponse('', true), crisisResponse('en', true));
  eq(crisisResponse('HI', true), crisisResponse('hi', true), 'case-insensitive');
  eq(crisisResponse('en-IN', true), crisisResponse('en', true), 'region subtag ignored');
});

// ---- what the counsellor reads -------------------------------------------

t('the alert text differs by tier and never quotes the person', () => {
  const selfHarm = crisisAlertReason('self_harm');
  const danger = crisisAlertReason('imminent_danger');
  ok(selfHarm !== danger, 'a counsellor must be able to tell these apart');
  ok(crisisAlertAction('self_harm') !== crisisAlertAction('imminent_danger'));
  for (const text of [selfHarm, danger, crisisAlertAction('self_harm'), crisisAlertAction('imminent_danger')]) {
    ok(!/"|'/.test(text), 'no quoted user content belongs in a row staff can all read');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
