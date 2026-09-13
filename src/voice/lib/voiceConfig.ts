import type { VoiceConfig } from "./voiceTypes";

/**
 * Where the voice backend lives.
 *
 * Upstream this could be empty, because the companion's own Vite dev server
 * proxies /voice to a backend on the same origin. AURA cannot do that in
 * production: it is deployed as static files plus Vercel serverless
 * functions, and a serverless function cannot hold the WebSocket a
 * conversation needs open for its whole length. So the backend is a separate
 * deployment and this is its origin.
 *
 * Empty is a supported state, not a misconfiguration to paper over: the panel
 * says the feature is not switched on yet instead of showing a microphone
 * button that fails when pressed.
 */
export const BACKEND_URL = (import.meta.env.VITE_VOICE_BACKEND_URL ?? "").replace(/\/$/, "");

/** False when no backend is configured, which the UI checks before offering to connect. */
export const VOICE_ENABLED = BACKEND_URL.length > 0;

export function httpUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export function wsUrl(path = "/voice"): string {
  if (BACKEND_URL) return `${BACKEND_URL.replace(/^http/, "ws")}${path}`;
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}${path}`;
}

export const VOICE_SUBPROTOCOL = "voice.v1";
export const MIC_SAMPLE_RATE = 16000;
/** 40 ms frames: small enough for responsive VAD, few enough messages per second. */
export const MIC_FRAME_SAMPLES = 640;

/** Local barge-in: sustained speech this loud while the assistant talks stops playback at once. */
export const BARGE_IN = { rms: 0.045, frames: 5 };

export const RECONNECT_DELAYS_MS = [1000, 2000, 4000];

// Namespaced with the rest of AURA's keys so they are obvious in devtools and
// cannot collide with anything the companion's own build left behind.
export const CONSENT_STORAGE_KEY = "aura_voice_consent_v1";
export const LANGUAGE_STORAGE_KEY = "aura_voice_language";

export const FALLBACK_CONFIG: VoiceConfig = {
  provider: "unknown",
  languages: [
    { code: "en-IN", name: "English", nativeName: "English" },
    { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी" },
    { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  ],
  defaultLanguage: "en-IN",
  maxSessionMinutes: 30,
  transcriptStorageAvailable: false,
  transcriptRetentionDays: 7,
};

/** Storage can throw (private mode, blocked cookies); the UI must work without it. */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
