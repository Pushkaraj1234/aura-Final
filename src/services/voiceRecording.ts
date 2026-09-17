/**
 * AURA Browser Voice Recording, Speech-to-Text & Vocal-Delivery Analysis
 *
 * Capabilities:
 * 1. Speech-to-Text: Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 *    to generate real client-side transcripts of spoken reflections where supported.
 * 2. Audio Capture: Uses MediaRecorder API to record local audio chunks for playback.
 * 3. Vocal-delivery measurement: Uses the Web Audio API (AnalyserNode) to sample the
 *    live microphone stream and measure how the reflection was spoken — pitch
 *    variability, pauses, and loudness/energy — entirely on-device. Nothing here
 *    "listens" for emotion; it produces plain numeric summaries. The LLM in
 *    server/aiService.ts reasons over those numbers together with the transcript
 *    to infer emotional tone, so tone judgments are grounded in measured delivery
 *    rather than transcript keyword matching.
 */

export interface VoiceRecordingState {
  isSupported: boolean;
  isRecording: boolean;
  durationSeconds: number;
  transcript: string;
  interimTranscript: string;
  audioUrl: string | null;
  error: string | null;
}

export interface AcousticDeliveryFeatures {
  pitchVariabilityScore: number; // 0-1 coefficient of variation of estimated voiced pitch
  speakingRateWpm: number;
  pauseRatio: number; // 0-1 fraction of sampled frames that were silent
  energyScore: number; // 0-1 normalized average loudness while voiced
  durationSeconds: number;
  voicedSampleCount: number;
}

const SILENCE_RMS_THRESHOLD = 0.02; // frames quieter than this count as a pause
const MIN_PITCH_HZ = 70;
const MAX_PITCH_HZ = 400;

/**
 * Time-domain autocorrelation pitch estimator (standard approach for
 * browser-based pitch detection). Returns -1 when no clear pitch is found
 * (e.g. silence, noise, or a signal outside the human voice range).
 */
function estimatePitchHz(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < SILENCE_RMS_THRESHOLD) return -1;

  // Trim leading/trailing near-silence to tighten the autocorrelation window.
  let start = 0;
  let end = SIZE - 1;
  const trimThreshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= trimThreshold) { start = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= trimThreshold) { end = SIZE - i; break; }
  }
  const trimmed = buf.slice(start, end);
  const n = trimmed.length;
  if (n < 8) return -1;

  const correlations = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    correlations[lag] = sum;
  }

  // Skip the initial downward slope from lag 0 before searching for the peak.
  let d = 0;
  while (d < n - 1 && correlations[d] > correlations[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return -1;

  // Parabolic interpolation around the peak for sub-sample precision.
  const x1 = correlations[maxPos - 1] ?? correlations[maxPos];
  const x2 = correlations[maxPos];
  const x3 = correlations[maxPos + 1] ?? correlations[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const refinedLag = a !== 0 ? maxPos - b / (2 * a) : maxPos;

  const freq = sampleRate / refinedLag;
  if (freq < MIN_PITCH_HZ || freq > MAX_PITCH_HZ || !isFinite(freq)) return -1;
  return freq;
}

export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private speechRecognition: any | null = null;
  private stream: MediaStream | null = null;
  private timerInterval: any = null;

  // Vocal-delivery analysis state
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analysisInterval: any = null;
  /** Set from the "Measure how it was said" consent on every start. */
  private measureDelivery = true;
  private pitchSamplesHz: number[] = [];
  private energySamples: number[] = [];
  private voicedFrameCount = 0;
  private silentFrameCount = 0;
  private totalFrameCount = 0;
  private recordingStartMs = 0;

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public isMediaRecorderSupported(): boolean {
    if (typeof window === "undefined" || !navigator.mediaDevices) return false;
    return !!window.MediaRecorder;
  }

  public isAcousticAnalysisSupported(): boolean {
    return typeof window !== "undefined" && !!((window as any).AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * Start recording audio and live speech-to-text
   */
  /**
   * @param options.measureDelivery
   *   Whether to run the on-device pace/pause/loudness analysis. This is the
   *   "Measure how it was said" consent, which until now was stored, shown on
   *   the consent screen, and never read: the analysis ran whatever the switch
   *   said. Off means the analyser is never attached, not that its output is
   *   discarded afterwards.
   */
  public async startRecording(
    onTranscriptUpdate: (finalText: string, interimText: string) => void,
    onDurationTick: (seconds: number) => void,
    onError: (err: string) => void,
    options: { measureDelivery?: boolean } = {}
  ): Promise<boolean> {
    this.measureDelivery = options.measureDelivery !== false;
    try {
      this.audioChunks = [];
      this.pitchSamplesHz = [];
      this.energySamples = [];
      this.voicedFrameCount = 0;
      this.silentFrameCount = 0;
      this.totalFrameCount = 0;
      this.recordingStartMs = Date.now();
      let currentDuration = 0;

      // 1. Request microphone access
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (window.MediaRecorder && this.stream) {
          this.mediaRecorder = new MediaRecorder(this.stream);
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              this.audioChunks.push(event.data);
            }
          };
          this.mediaRecorder.start(200); // 200ms slices
        }

        // 1b. Vocal-delivery measurement via Web Audio API — entirely local,
        // nothing is sent anywhere; it just produces numeric summaries.
        if (this.measureDelivery) this.startAcousticAnalysis(this.stream);
      }

      // 2. Initialize Web Speech Recognition if available
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      let aggregatedTranscript = "";

      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = "en-US";

        this.speechRecognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              aggregatedTranscript += (aggregatedTranscript ? " " : "") + event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          onTranscriptUpdate(aggregatedTranscript, interim);
        };

        this.speechRecognition.onerror = (e: any) => {
          console.warn("AURA Speech Recognition warning:", e.error);
          if (e.error === "not-allowed") {
            onError("Microphone permission was denied.");
          }
        };

        this.speechRecognition.start();
      }

      // 3. Duration Timer
      this.timerInterval = setInterval(() => {
        currentDuration += 1;
        onDurationTick(currentDuration);
      }, 1000);

      return true;
    } catch (err: any) {
      console.error("Failed to start voice recording:", err);
      onError(err.message || "Microphone access could not be established.");
      this.cleanup();
      return false;
    }
  }

  /**
   * Samples the live microphone stream a few times a second to build up
   * distributions of pitch and loudness for the whole recording.
   */
  private startAcousticAnalysis(stream: MediaStream) {
    if (!this.isAcousticAnalysisSupported()) return;
    try {
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextCtor();
      this.analyser = this.audioContext!.createAnalyser();
      this.analyser.fftSize = 1024;
      this.sourceNode = this.audioContext!.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      // Intentionally NOT connected to audioContext.destination — we only
      // read the signal, never play it back through the speakers.

      const buffer = new Float32Array(this.analyser.fftSize);
      const sampleRate = this.audioContext!.sampleRate;

      this.analysisInterval = setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getFloatTimeDomainData(buffer);

        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) sumSquares += buffer[i] * buffer[i];
        const rms = Math.sqrt(sumSquares / buffer.length);

        this.totalFrameCount++;
        if (rms < SILENCE_RMS_THRESHOLD) {
          this.silentFrameCount++;
        } else {
          this.voicedFrameCount++;
          // Loudness above the silence floor, roughly normalized to 0-1
          // (typical speech RMS on a laptop mic rarely exceeds ~0.3).
          this.energySamples.push(Math.min(1, rms / 0.3));

          const pitch = estimatePitchHz(buffer, sampleRate);
          if (pitch > 0) this.pitchSamplesHz.push(pitch);
        }
      }, 150);
    } catch (err) {
      console.warn("AURA acoustic analysis unavailable:", err);
    }
  }

  private stopAcousticAnalysis(): AcousticDeliveryFeatures {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    try {
      this.sourceNode?.disconnect();
      this.analyser?.disconnect();
      this.audioContext?.close();
    } catch {
      // ignore teardown errors
    }
    this.sourceNode = null;
    this.analyser = null;
    this.audioContext = null;

    const durationSeconds = Math.max(0.1, (Date.now() - this.recordingStartMs) / 1000);

    let pitchVariabilityScore = 0;
    if (this.pitchSamplesHz.length >= 3) {
      const mean = this.pitchSamplesHz.reduce((a, b) => a + b, 0) / this.pitchSamplesHz.length;
      const variance =
        this.pitchSamplesHz.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / this.pitchSamplesHz.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
      // Typical expressive speech CoV lands roughly in the 0-0.5 range; clamp to 0-1.
      pitchVariabilityScore = Math.max(0, Math.min(1, coefficientOfVariation * 2));
    }

    const energyScore =
      this.energySamples.length > 0
        ? this.energySamples.reduce((a, b) => a + b, 0) / this.energySamples.length
        : 0;

    const pauseRatio = this.totalFrameCount > 0 ? this.silentFrameCount / this.totalFrameCount : 0;

    return {
      pitchVariabilityScore,
      speakingRateWpm: 0, // filled in by the caller, which knows the transcript word count
      pauseRatio,
      energyScore,
      durationSeconds,
      voicedSampleCount: this.pitchSamplesHz.length,
    };
  }

  /**
   * Stop recording and finalize audio Blob URL + measured delivery features
   */
  /**
   * Returns the blob as well as the object URL.
   *
   * Without it there was nothing for a caller to persist, which is why "Keep
   * the recording afterwards" could not have worked however it was set: an
   * object URL lives in one tab and dies with it.
   */
  public async stopRecording(): Promise<{
    audioUrl: string | null;
    audioBlob: Blob | null;
    hasAudio: boolean;
    acoustic: AcousticDeliveryFeatures;
  }> {
    const acoustic = this.stopAcousticAnalysis();

    return new Promise((resolve) => {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (this.speechRecognition) {
        try {
          this.speechRecognition.stop();
        } catch (e) {
          // ignore
        }
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
          const audioUrl = URL.createObjectURL(audioBlob);
          this.cleanupStream();
          resolve({ audioUrl, audioBlob, hasAudio: this.audioChunks.length > 0, acoustic });
        };
        this.mediaRecorder.stop();
      } else {
        this.cleanupStream();
        resolve({ audioUrl: null, audioBlob: null, hasAudio: false, acoustic });
      }
    });
  }

  /**
   * Cleanup tracks and streams
   */
  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  public cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    try {
      this.sourceNode?.disconnect();
      this.analyser?.disconnect();
      this.audioContext?.close();
    } catch {
      // ignore
    }
    this.sourceNode = null;
    this.analyser = null;
    this.audioContext = null;
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
      this.speechRecognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.cleanupStream();
    this.audioChunks = [];
  }
}

export const voiceRecordingService = new VoiceRecordingService();
