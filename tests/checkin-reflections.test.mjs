/**
 * Two open questions, two ways to answer each.
 *
 * Step 8 asks what keeps someone going. Step 9 asks what they wish
 * institutions and the public understood. Both can now be spoken instead of
 * typed, and that is exactly where the existing code was losing answers:
 * a single shared reflection object meant the second recording replaced the
 * first, and the submit path read
 *
 *   currentReflection?.transcript || [coping, publicUnderstanding].join()
 *
 * so recording step 8 by voice discarded step 9 from the transcript the model
 * reads and from the stored reflection. The person answered and the answer
 * went nowhere.
 *
 * These pin the resolution rules against the source, because the assembly
 * happens inside a long React submit handler that no unit test can call.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

const src = readFileSync(new URL('../src/pages/ParticipantCheckin.tsx', import.meta.url), 'utf8');

// ---- step 9 can be spoken --------------------------------------------------

t('step 9 offers a voice recorder', () => {
  ok(/setShowPublicVoiceRecorder/.test(src), 'no toggle for the step 9 recorder');
  ok(/initialTranscript=\{publicUnderstandingReflection\}/.test(src),
    'the step 9 recorder does not start from what was already typed');
});

t('step 9 keeps its own reflection, separate from step 8', () => {
  ok(/const \[publicReflection, setPublicReflection\]/.test(src), 'no separate state');
  ok(/setPublicReflection\(ref\)/.test(src), 'the step 9 recorder does not save into it');
  // The step 8 recorder must not be the one writing it.
  const step9 = src.slice(src.indexOf('setShowPublicVoiceRecorder(!showPublicVoiceRecorder)'));
  const recorderBlock = step9.slice(0, step9.indexOf('</div>') + 6);
  ok(!/setCurrentReflection/.test(recorderBlock),
    'the step 9 recorder overwrites the step 8 reflection');
});

t('clearing step 9 clears only step 9', () => {
  const idx = src.indexOf('setPublicReflection(null)');
  ok(idx > 0, 'step 9 cannot be cleared');
  const around = src.slice(idx, idx + 220);
  ok(/setPublicUnderstandingReflection\(""\)/.test(around), 'the text is left behind');
  ok(!/setCopingReflection\(""\)/.test(around), 'clearing step 9 wiped step 8');
});

t('there are two independent recorder toggles', () => {
  ok(/const \[showVoiceRecorder, setShowVoiceRecorder\]/.test(src), 'step 8 toggle missing');
  ok(/const \[showPublicVoiceRecorder, setShowPublicVoiceRecorder\]/.test(src), 'step 9 toggle missing');
});

// ---- neither answer is lost ------------------------------------------------

t('each answer resolves on its own before they are joined', () => {
  ok(/const copingPart = currentReflection\?\.transcript\?\.trim\(\) \|\| copingReflection\.trim\(\)/.test(src),
    'step 8 does not resolve voice-or-text independently');
  ok(/const publicPart = publicReflection\?\.transcript\?\.trim\(\) \|\| publicUnderstandingReflection\.trim\(\)/.test(src),
    'step 9 does not resolve voice-or-text independently');
  ok(/const transcript = \[copingPart, publicPart\]\.filter\(Boolean\)\.join\("\\n\\n"\)/.test(src),
    'the two parts are not joined');
});

t('the old clobbering expression is gone', () => {
  ok(!/currentReflection\?\.transcript \|\| \[copingReflection, publicUnderstandingReflection\]/.test(src),
    'the short-circuit that dropped step 9 is back');
});

t('the stored reflection carries both answers, not just the first', () => {
  const idx = src.indexOf('let updatedReflection');
  ok(idx > 0, 'no reflection is built');
  const block = src.slice(idx, idx + 900);
  ok(/transcript,/.test(block), 'the combined transcript is not written onto it');
  ok(!/let updatedReflection = currentReflection \|\|/.test(src),
    'the reflection is still taken wholesale from step 8');
});

// ---- consent is not widened by combining -----------------------------------

t('the stricter sharing choice wins', () => {
  ok(/const shareWithWorker = reflections\.every\(\(r\) => r\.shareWithWorker !== false\)/.test(src),
    'sharing is not the AND of both reflections');
});

t('a withheld answer is never sent to the model', () => {
  ok(/if \(transcript\.length > 5 && shareWithWorker\)/.test(src),
    'the AI call does not check the combined sharing choice');
});

t('the check-in records the combined choice, not step 8 alone', () => {
  ok(/shareNoteWithWorker: shareWithWorker/.test(src), 'the stored flag is not the combined one');
  ok(/voiceInputUsed: spokeAloud/.test(src), 'voice use is not the OR of both');
  ok(/const spokeAloud = reflections\.some\(\(r\) => r\.type === "voice" \|\| r\.audioRecorded\)/.test(src),
    'spokeAloud is not derived from both reflections');
});

// ---- the review screen shows what will be stored ---------------------------

t('the review screen resolves answers the same way the submit path does', () => {
  ok(/const previewTranscript = \[/.test(src), 'no shared preview resolution');
  ok(/"\{previewTranscript\}"/.test(src), 'the review screen shows a different join');
  ok(/previewSpokeAloud \? "Voice Transcript" : "Text Input"/.test(src),
    'the review label still reads only step 8');
});

t('the review screen appears whenever either answer exists', () => {
  ok(/\{previewTranscript && \(/.test(src), 'the reflection summary gate was not updated');
});

// ---- the offer is the same on both questions -------------------------------

t('both questions offer the same wording for speaking instead of typing', () => {
  const offers = src.match(/Use Spoken Voice Recording Instead/g) || [];
  eq(offers.length, 2, 'the two questions do not make the same offer');
});

t('both recorders are the shared component, not a copy', () => {
  const recorders = src.match(/<VoiceRecorder/g) || [];
  eq(recorders.length, 2, 'expected exactly two recorder mounts');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
