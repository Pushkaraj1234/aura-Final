import type { AudioFrame } from "./voiceTypes";

/**
 * Streaming box-filter downsampler (e.g. 48 kHz -> 16 kHz). Averaging each output
 * window acts as a simple low-pass filter, which is enough for speech recognition.
 */
export class StreamingDownsampler {
  private readonly ratio: number;
  private carry: Float32Array = new Float32Array(0);

  constructor(inputRate: number, outputRate = 16000) {
    this.ratio = inputRate / outputRate;
  }

  process(input: Float32Array): Float32Array {
    const data = new Float32Array(this.carry.length + input.length);
    data.set(this.carry);
    data.set(input, this.carry.length);

    if (this.ratio === 1) {
      this.carry = new Float32Array(0);
      return data;
    }

    const outLength = Math.floor(data.length / this.ratio);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const start = Math.floor(i * this.ratio);
      const end = Math.min(data.length, Math.floor((i + 1) * this.ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += data[j]!;
      out[i] = end > start ? sum / (end - start) : 0;
    }
    this.carry = data.slice(Math.floor(outLength * this.ratio));
    return out;
  }
}

export function floatTo16BitPCM(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function pcm16ToFloat32(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i]! / 0x8000;
  return out;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / samples.length);
}

/** Server audio frame: [uint32 sampleRate][uint32 turnId][PCM16LE]. */
export function parseAudioFrame(buffer: ArrayBuffer): AudioFrame {
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(0, true);
  const turnId = view.getUint32(4, true);
  const sampleCount = Math.floor((buffer.byteLength - 8) / 2);
  return { sampleRate, turnId, samples: pcm16ToFloat32(new Int16Array(buffer, 8, sampleCount)) };
}
