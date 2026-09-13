/**
 * Gapless playback of streamed assistant audio, with instant stop for barge-in.
 * Also speaks text with the browser's speech synthesis for languages that have
 * no server-side voice.
 */
export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private speechPending = 0;
  private playingTurn: number | null = null;
  private readonly doneTurns = new Set<number>();
  /** Audio for this turn id or older is discarded (it was interrupted). */
  private droppedUpTo = 0;

  constructor(private readonly onPlaybackEnd: (turnId: number) => void) {}

  /** Must run inside a user gesture (iOS Safari autoplay policy). */
  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
  }

  get isPlaying(): boolean {
    return this.sources.size > 0 || this.speechPending > 0;
  }

  enqueue(turnId: number, sampleRate: number, samples: Float32Array): void {
    if (turnId <= this.droppedUpTo || samples.length === 0) return;
    const context = (this.context ??= new AudioContext());
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    this.playingTurn = turnId;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      this.checkFinished();
    };
  }

  speakText(turnId: number, text: string, language: string): void {
    if (turnId <= this.droppedUpTo || typeof speechSynthesis === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.95;
    this.playingTurn = turnId;
    this.speechPending += 1;
    const finish = () => {
      this.speechPending = Math.max(0, this.speechPending - 1);
      this.checkFinished();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  }

  /** The server finished sending this turn; report playback end once audio drains. */
  markResponseDone(turnId: number): void {
    this.doneTurns.add(turnId);
    this.checkFinished();
  }

  private checkFinished(): void {
    const turn = this.playingTurn;
    if (turn === null || this.isPlaying || !this.doneTurns.has(turn)) return;
    this.playingTurn = null;
    this.doneTurns.delete(turn);
    this.onPlaybackEnd(turn);
  }

  /** Stops immediately (barge-in or interrupt) and discards queued audio for the turn. */
  stop(turnId?: number): void {
    this.droppedUpTo = Math.max(this.droppedUpTo, turnId ?? this.playingTurn ?? 0);
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    if (this.speechPending > 0 && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.speechPending = 0;
    this.nextStartTime = 0;
    this.playingTurn = null;
  }

  close(): void {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
