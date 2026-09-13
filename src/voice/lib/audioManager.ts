import { StreamingDownsampler, floatTo16BitPCM, rms } from "./audioUtils";
import { MIC_FRAME_SAMPLES, MIC_SAMPLE_RATE } from "./voiceConfig";

export type MicFrameHandler = (pcm16: ArrayBuffer, level: number) => void;

const WORKLET_SOURCE = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("mic-capture", MicCapture);
`;

/**
 * Captures the microphone and emits 40 ms PCM16 frames at 16 kHz.
 * Audio exists only in memory and is streamed to our backend; nothing is recorded.
 */
export class AudioManager {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private pending = new Float32Array(MIC_FRAME_SAMPLES * 4);
  private pendingLength = 0;

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== "undefined";
  }

  async startMicrophone(onFrame: MicFrameHandler): Promise<MediaStream> {
    // Only called from a user tap, never on page load.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });

    const context = new AudioContext();
    this.context = context;
    await context.resume();

    const downsampler = new StreamingDownsampler(context.sampleRate, MIC_SAMPLE_RATE);
    const handleSamples = (samples: Float32Array) => this.accumulate(downsampler.process(samples), onFrame);

    const source = context.createMediaStreamSource(this.stream);
    const mute = context.createGain();
    mute.gain.value = 0;

    if (context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
      try {
        await context.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const worklet = new AudioWorkletNode(context, "mic-capture");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => handleSamples(event.data);
      source.connect(worklet).connect(mute).connect(context.destination);
      this.nodes = [source, worklet, mute];
    } else {
      // Older Safari fallback.
      const processor = context.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (event) => handleSamples(event.inputBuffer.getChannelData(0).slice(0));
      source.connect(processor).connect(mute).connect(context.destination);
      this.nodes = [source, processor, mute];
    }
    return this.stream;
  }

  private accumulate(samples: Float32Array, onFrame: MicFrameHandler): void {
    if (this.pendingLength + samples.length > this.pending.length) {
      const grown = new Float32Array((this.pendingLength + samples.length) * 2);
      grown.set(this.pending.subarray(0, this.pendingLength));
      this.pending = grown;
    }
    this.pending.set(samples, this.pendingLength);
    this.pendingLength += samples.length;

    let offset = 0;
    while (this.pendingLength - offset >= MIC_FRAME_SAMPLES) {
      const frame = this.pending.slice(offset, offset + MIC_FRAME_SAMPLES);
      offset += MIC_FRAME_SAMPLES;
      onFrame(floatTo16BitPCM(frame).buffer as ArrayBuffer, rms(frame));
    }
    this.pending.copyWithin(0, offset, this.pendingLength);
    this.pendingLength -= offset;
  }

  stopMicrophone(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.nodes.forEach((node) => node.disconnect());
    void this.context?.close().catch(() => undefined);
    this.stream = null;
    this.context = null;
    this.nodes = [];
    this.pendingLength = 0;
  }
}
