/**
 * The opening greeting, and the reason it is not a turn.
 *
 * Speaking the greeting through speakText() would have been one line shorter
 * and quietly wrong. speakText sets `playingTurn`, and stop() raises
 * `droppedUpTo` to whatever `playingTurn` holds -- so a barge-in during the
 * greeting would push the watermark up and the server's first real turn would
 * be discarded on arrival. The person would hear a greeting, start talking,
 * and then get silence.
 *
 * announce() therefore stays outside the turn system. These tests pin that
 * difference, because it is invisible in the code and catastrophic in use.
 */
import { AudioPlayer } from '../dist-test/audioPlayer.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

// ---- browser stubs ---------------------------------------------------------

let spoken = [];
let cancelled = 0;
let pendingUtterances = [];

class FakeUtterance {
  constructor(text) { this.text = text; this.lang = ''; this.rate = 1; }
}
const installSpeech = () => {
  spoken = []; cancelled = 0; pendingUtterances = [];
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  globalThis.speechSynthesis = {
    speak(u) { spoken.push(u); pendingUtterances.push(u); },
    cancel() { cancelled += 1; pendingUtterances = []; },
  };
};
/** Fire the browser's onend for everything queued. */
const finishSpeech = () => {
  const queue = pendingUtterances;
  pendingUtterances = [];
  for (const u of queue) u.onend?.();
};

class FakeSource {
  constructor() { this.onended = null; this.stopped = false; }
  connect() {}
  start() {}
  stop() { this.stopped = true; }
}
globalThis.AudioContext = class {
  constructor() { this.currentTime = 0; this.destination = {}; }
  async resume() {}
  createBuffer(_ch, len, rate) {
    return { duration: len / rate, getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() { return new FakeSource(); }
};

const samples = () => new Float32Array([0.1, 0.2, 0.3]);

// ---- announce stays out of the turn system --------------------------------

t('a barge-in during the greeting does not discard the first real turn', () => {
  installSpeech();
  const ended = [];
  const player = new AudioPlayer((turn) => ended.push(turn));

  player.announce('Hello.', 'en');
  player.stop();                       // the person starts talking over it

  player.enqueue(1, 16000, samples()); // the server's first real turn
  ok(player.isPlaying, 'turn 1 must still play after a greeting was interrupted');
});

t('by contrast, a greeting sent as a turn would have swallowed turn 1', () => {
  // Documents the bug that announce() exists to avoid. If this ever starts
  // failing, speakText has changed and announce may no longer be needed.
  installSpeech();
  const player = new AudioPlayer(() => {});
  player.speakText(1, 'Hello.', 'en');
  player.stop();
  player.enqueue(1, 16000, samples());
  eq(player.isPlaying, false, 'turn 1 is dropped, which is why the greeting is not a turn');
});

t('the greeting never reports playback_done for a turn the server has no record of', () => {
  installSpeech();
  const ended = [];
  const player = new AudioPlayer((turn) => ended.push(turn));
  player.announce('Hello.', 'en');
  finishSpeech();
  eq(ended.length, 0, 'no turn id should be reported back to the server');
});

// ---- it still behaves like speech -----------------------------------------

t('the greeting is actually spoken, in the requested language', () => {
  installSpeech();
  const player = new AudioPlayer(() => {});
  player.announce('नमस्कार.', 'mr');
  eq(spoken.length, 1);
  eq(spoken[0].text, 'नमस्कार.');
  eq(spoken[0].lang, 'mr');
});

t('while greeting, the player counts as playing, so barge-in can fire', () => {
  installSpeech();
  const player = new AudioPlayer(() => {});
  eq(player.isPlaying, false);
  player.announce('Hello.', 'en');
  eq(player.isPlaying, true, 'onMicFrame checks isPlaying to decide about barge-in');
});

t('stop() cancels the greeting mid-sentence', () => {
  installSpeech();
  const player = new AudioPlayer(() => {});
  player.announce('Hello.', 'en');
  player.stop();
  eq(cancelled, 1, 'speechSynthesis.cancel must be called');
  eq(player.isPlaying, false);
});

t('the done callback runs when the greeting finishes', () => {
  installSpeech();
  const player = new AudioPlayer(() => {});
  let done = 0;
  player.announce('Hello.', 'en', () => { done += 1; });
  eq(done, 0, 'not before it has been spoken');
  finishSpeech();
  eq(done, 1);
  eq(player.isPlaying, false);
});

t('a speech error still releases the player rather than wedging it', () => {
  installSpeech();
  const player = new AudioPlayer(() => {});
  let done = 0;
  player.announce('Hello.', 'en', () => { done += 1; });
  const [u] = pendingUtterances;
  pendingUtterances = [];
  u.onerror?.();
  eq(done, 1, 'onerror must resolve it too, or the orb stays speaking forever');
  eq(player.isPlaying, false);
});

t('with no speech synthesis available, it resolves instead of hanging', () => {
  // Some browsers and every headless context. The conversation must still open.
  delete globalThis.speechSynthesis;
  const player = new AudioPlayer(() => {});
  let done = 0;
  player.announce('Hello.', 'en', () => { done += 1; });
  eq(done, 1, 'the caller is waiting to set status back to listening');
  eq(player.isPlaying, false);
  installSpeech();
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
