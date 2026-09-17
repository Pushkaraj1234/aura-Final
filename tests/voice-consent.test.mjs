/**
 * The three voice consents, and whether they do anything.
 *
 * Two of them did not. "Measure how it was said" was stored, rendered on the
 * consent screen, and never read: the acoustic analyser ran whichever way the
 * switch was set. "Keep the recording afterwards" said "Stores the audio
 * itself once the session ends", and nothing stored anything, because
 * stopRecording produced an object URL, which lives in one browser tab and
 * dies with it.
 *
 * A decorative toggle is bad anywhere. On a consent screen it is a promise of
 * control that the product does not give, made to people whose voice is the
 * thing at stake, so these are pinned in source rather than trusted to hold.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const recorder = read('src/services/voiceRecording.ts');
const component = read('src/components/VoiceRecorder.tsx');
const store = read('src/services/voiceRecordings.ts');
const consentScreen = read('src/pages/ConsentManagement.tsx');
const card = read('src/components/MyRecordings.tsx');

// ---- "Measure how it was said" --------------------------------------------

t('the delivery analyser is gated on the consent, not always on', () => {
  ok(/measureDelivery/.test(recorder), 'the recorder must take the choice as input');
  ok(/if \(this\.measureDelivery\) this\.startAcousticAnalysis/.test(recorder),
     'the analyser must never be attached when the consent is off');
  ok(/\{ measureDelivery \}/.test(component),
     'the component must pass the saved preference through');
});

t('the consent is read from storage, not assumed', () => {
  ok(/consents\s*\n?\s*\.get\(participantId\)|consents\.get\(participantId\)/.test(component),
     'the recorder component must load the saved preferences');
});

t('an unreadable preference means measure nothing and keep nothing', () => {
  // Guessing the other way means analysing or storing a voice nobody agreed to.
  ok(/useState\(false\);?\s*\n\s*const \[keepRecording, setKeepRecording\] = useState\(false\)/
      .test(component) ||
     (/const \[measureDelivery, setMeasureDelivery\] = useState\(false\)/.test(component) &&
      /const \[keepRecording, setKeepRecording\] = useState\(false\)/.test(component)),
     'both consents must default to off');
});

// ---- "Keep the recording afterwards" --------------------------------------

t('the audio actually reaches something that can persist it', () => {
  ok(/audioBlob: Blob \| null/.test(recorder),
     'stopRecording must return the blob, not only an object URL');
  ok(/voiceRecordingStore\.keep\(/.test(component), 'the component must be able to keep it');
  ok(/if \(keepRecording && audioBlob/.test(component),
     'and must only keep it when the consent says so');
});

t('keeping a recording cannot lose the reflection', () => {
  // The person came to say something, not to file an audio archive.
  ok(/Promise<VoiceRecording \| null>/.test(store),
     'keep() must return null on failure rather than throwing');
});

t('an object with no row is cleaned up rather than left orphaned', () => {
  const keepBody = store.slice(store.indexOf('async keep('), store.indexOf('async playbackUrl'));
  ok(/remove\(\[storagePath\]\)/.test(keepBody),
     'a failed insert must take the uploaded object back out');
});

t('playback links expire', () => {
  ok(/createSignedUrl\(storagePath, expiresInSeconds\)/.test(store),
     'a link that works forever still works after it is forwarded');
});

// ---- withdrawal -----------------------------------------------------------

t('turning retention off deletes what it was keeping', () => {
  // A switch that stops future retention but leaves everything already stored
  // is a pause, and the consent screen does not describe a pause.
  ok(/removeAll/.test(store), 'the store must be able to clear everything');
  ok(/!preferences\.voiceAudioRetention[\s\S]{0,200}removeAll\(\)/.test(consentScreen),
     'saving with retention off must clear the stored audio');
  ok(/handleWithdrawConsent[\s\S]{0,400}removeAll\(\)/.test(consentScreen),
     'withdrawing everything must include the audio');
});

t('the deletion is said out loud', () => {
  ok(/removedCount/.test(consentScreen),
     'deleting somebody\'s recordings quietly is worse than not deleting them');
});

// ---- the consent screen's own UI -------------------------------------------

t('every voice consent has its own icon', () => {
  // Two of the three rendered an empty bordered box where the icon goes, which
  // reads as an icon that failed to load, next to a switch about keeping
  // recordings of someone's voice.
  ok(/Icon: LucideIcon/.test(consentScreen), 'the table must carry an icon per row');
  for (const icon of ['Mic', 'AudioLines', 'Archive']) {
    ok(new RegExp(`Icon: ${icon},`).test(consentScreen), `missing icon: ${icon}`);
  }
  ok(!/position === 0 \? <Mic/.test(consentScreen),
     'the empty-span fallback must be gone');
});

// ---- the playback surface ---------------------------------------------------

t('nothing is shown as kept when nothing is being kept', () => {
  ok(/!retentionOn \?/.test(card),
     'the card must say retention is off rather than render an empty list');
  ok(/Nothing saved yet/.test(card), 'and must distinguish that from having none yet');
});

t('recordings are the person\'s own and the card says so', () => {
  ok(/Only you can play these/.test(card));
  ok(!/is_staff|counsellor can hear/.test(card));
});

t('one player, so two recordings cannot talk over each other', () => {
  ok(/audioRef\.current\?\.pause\(\)/.test(card), 'starting one must stop the other');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
