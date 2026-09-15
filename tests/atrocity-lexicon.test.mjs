/**
 * Recognising the exposure that defines this population.
 *
 * Gap G2 of the atrocity-victim literature review: "There is no caste-
 * discrimination lexicon, no atrocity-event detection schema... Consequence:
 * the system cannot detect the exposure that defines the target population."
 *
 * Two failures matter, and they are not the same as the crisis detector's.
 *
 * A MISS means a survivor writes that the village stopped speaking to them and
 * the counsellor opens their file knowing nothing about it. That is the gap.
 *
 * A FALSE FIRE here is less dangerous than in the crisis detector (nobody is
 * paged) but more corrosive, because it lands in a counsellor's view of a
 * person as an assertion about their case. A card that is wrong often is a
 * card that gets ignored, taking the true readings with it.
 *
 * The third property, tested last and most important: this may never touch the
 * distress score.
 */
import { detectAtrocityExposure, ATROCITY_CATEGORIES }
  from '../dist-test/atrocityLexicon.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const categories = (text) => detectAtrocityExposure(text).signals.map((s) => s.category).sort();
const finds = (text, category) => {
  const found = categories(text);
  ok(found.includes(category), `${JSON.stringify(text)} should report ${category}, got [${found}]`);
};
const quiet = (text) => {
  const found = categories(text);
  eq(found.length, 0, `${JSON.stringify(text)} should report nothing, got [${found}]`);
};

// ---- the categories the review names --------------------------------------

t('social boycott', () => {
  finds('The whole village stopped speaking to us after we filed the case', 'social_boycott');
  finds('They have boycotted our family', 'social_boycott');
  finds('Nobody will talk to me now', 'social_boycott');
  finds('आमच्यावर गावाने बहिष्कार टाकला', 'social_boycott');
});

t('denial of access to water, temple, shop or public space', () => {
  finds('They stopped us from drawing water from the well', 'denial_of_access');
  finds('We were not allowed to enter the temple', 'denial_of_access');
  finds('At the tea shop they give us a separate glass', 'denial_of_access');
  finds('They made us sit outside while everyone else ate', 'denial_of_access');
  finds('मंदिरात जाऊ दिलं नाही', 'denial_of_access');
});

t('public humiliation', () => {
  finds('They paraded him through the village', 'public_humiliation');
  finds('He made me apologise in front of the whole village', 'public_humiliation');
  finds('They blackened my face', 'public_humiliation');
  finds('त्यांनी धिंड काढली', 'public_humiliation');
});

t('caste abuse', () => {
  finds('He abused me using my caste name', 'caste_slur');
  finds('They keep making casteist remarks at work', 'caste_slur');
  finds('जातिवाचक शिवीगाळ केली', 'caste_slur');
});

t('forced and bonded labour', () => {
  finds('They forced me to work in their field', 'forced_labour');
  finds('It was bonded labour, we were never paid', 'forced_labour');
  finds('मला जबरदस्ती काम करायला लावलं', 'forced_labour');
});

t('violence over an inter-caste relationship', () => {
  finds('We had an inter-caste marriage and they came for us', 'inter_caste_relationship');
  finds('She married into a different caste and the village turned', 'inter_caste_relationship');
  finds('आंतरजातीय लग्न केल्यामुळे', 'inter_caste_relationship');
});

t('land, house and property', () => {
  finds('They grabbed our land', 'land_or_property');
  finds('They burnt our house down', 'land_or_property');
  finds('जमीन बळकावली', 'land_or_property');
});

t('displacement', () => {
  finds('We had to leave the village and cannot go back', 'displacement');
  finds('They drove us out', 'displacement');
  finds('आम्हाला गाव सोडावं लागलं', 'displacement');
});

t('witch-hunting', () => {
  // The Jharkhand pattern the review names explicitly.
  finds('They branded her a witch and beat her', 'witch_hunting');
  finds('गावात मला चेटकीण म्हणतात', 'witch_hunting');
});

t('sexual violence', () => {
  finds('I was raped', 'sexual_violence');
  finds('He sexually assaulted me', 'sexual_violence');
  finds('बलात्कार झाला', 'sexual_violence');
});

t('pressure on the case', () => {
  // The review's G3 territory: what actually happens to the legal pipeline.
  finds('They are pressuring us to withdraw the case', 'obstruction_of_justice');
  finds('The police refused to register the FIR', 'obstruction_of_justice');
  finds('They offered us money to settle', 'obstruction_of_justice');
  finds('केस मागे घेण्यासाठी दबाव आणत आहेत', 'obstruction_of_justice');
});

// ---- more than one thing at a time ----------------------------------------

t('several categories in one reflection are all reported', () => {
  const found = categories(
    'After the inter-caste marriage the village boycotted us, they burnt our house, ' +
    'and now they are pressuring us to withdraw the case'
  );
  ok(found.includes('inter_caste_relationship'));
  ok(found.includes('social_boycott'));
  ok(found.includes('land_or_property'));
  ok(found.includes('obstruction_of_justice'));
});

t('every signal carries the phrase that produced it', () => {
  // A counsellor has to be able to check the reading against the text.
  const { signals } = detectAtrocityExposure('They stopped us from drawing water');
  ok(signals.length > 0);
  for (const s of signals) {
    ok(s.matched && s.matched.length > 0, 'matched phrase missing');
    ok(s.label && s.label.length > 0, 'human label missing');
  }
});

// ---- ordinary writing must survive ----------------------------------------

t('ordinary distress is not an atrocity report', () => {
  quiet('I have not been sleeping and I feel exhausted all the time');
  quiet('I had a hard week but my sister came to stay');
  quiet('I am worried about money');
  quiet('The counsellor was kind to me last time');
});

t('talking about the case in neutral terms does not fire', () => {
  quiet('My next hearing is on the fourteenth');
  quiet('The lawyer explained what happens next');
  quiet('I went to the court with my brother');
});

t('everyday words that overlap the lexicon do not fire', () => {
  // These are the false fires that would make a counsellor stop reading it.
  quiet('I had to leave work early because I felt unwell');
  quiet('We are saving to buy a small plot one day');
  quiet('The water tastes strange from the new tap');
  quiet('My daughter got married last month and it was a happy day');
  quiet('I work in the fields every morning');
});

t('empty and malformed input is handled', () => {
  quiet('');
  quiet('   ');
  eq(detectAtrocityExposure(null).signals.length, 0);
  eq(detectAtrocityExposure(undefined).signals.length, 0);
  eq(detectAtrocityExposure(42).signals.length, 0);
});

// ---- the rules that keep it safe -------------------------------------------

t('it never reports that it affects the score', () => {
  // Exposure and symptom state are different quantities. Folding what happened
  // to someone into how distressed they are would mean a survivor who mentions
  // a boycott calmly scores worse than one who does not mention it.
  eq(detectAtrocityExposure('They boycotted us').affectsScore, false);
  eq(detectAtrocityExposure('nothing here').affectsScore, false);
});

t('it does not infer caste, only what was described', () => {
  // Caste is the most sensitive attribute this database could hold, and a
  // survivor describing an atrocity is telling us about an event.
  const { signals } = detectAtrocityExposure('He abused me using my caste name');
  for (const s of signals) {
    ok(!/caste_identity|is_dalit|community_is/.test(s.category),
       'no category may name the person rather than the event');
  }
  ok(ATROCITY_CATEGORIES.every((c) => !/identity|belongs|member/i.test(c.category)));
});

t('past tense is not suppressed, unlike the crisis detector', () => {
  // Deliberately different. The crisis detector asks whether something is
  // happening now, which is about urgency. This asks what a person has lived
  // through, which does not stop being true because it was in 2019.
  finds('In 2019 they boycotted our family', 'social_boycott');
  finds('Years ago they forced me to work without wages', 'forced_labour');
});

t('the exported legend covers every category the detector can emit', () => {
  const declared = new Set(ATROCITY_CATEGORIES.map((c) => c.category));
  const samples = [
    'they boycotted us', 'not allowed to enter the temple', 'they paraded him',
    'casteist remarks', 'bonded labour', 'inter-caste marriage', 'they grabbed our land',
    'they drove us out', 'branded her a witch', 'I was raped',
    'withdraw the case',
  ];
  for (const sample of samples) {
    for (const c of categories(sample)) {
      ok(declared.has(c), `${c} is emitted but missing from ATROCITY_CATEGORIES`);
    }
  }
  ok(ATROCITY_CATEGORIES.length >= 11);
});

t('no category label reads as a diagnosis or a verdict', () => {
  for (const { label } of ATROCITY_CATEGORIES) {
    ok(/^(Describes|Reports)/.test(label),
       `"${label}" must describe what the person said, not assert a finding`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
