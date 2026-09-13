export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
  timestamp: number;
}

export interface VoiceSession {
  sessionId: string;
  token: string;
  provider: string;
  language: string;
  expiresAt: string;
  transcriptStored: boolean;
}

export interface SafetyResource {
  id: string;
  name: string;
  phone?: string | null;
  url?: string | null;
}

export interface SafetyInfo {
  mode: "EMERGENCY" | "SAFETY_SUPPORT";
  level: string;
  category: string;
  message: string;
  resources: SafetyResource[];
}

export type VoiceErrorCode =
  | "mic_denied"
  | "mic_unavailable"
  | "unsupported"
  | "network"
  | "connection_lost"
  | "provider_unavailable"
  | "quota_exceeded"
  | "session_limit"
  | "rate_limited"
  | "session_expired"
  | "stt_failed"
  | "internal";

export type ServerMessage =
  | { type: "ready"; sessionId: string; provider: string; language: string }
  | { type: "status"; status: "listening" | "thinking" | "speaking" }
  | { type: "transcript"; id: string; role: "user" | "assistant"; text: string; final: boolean; turnId: number; replaces?: string }
  | { type: "response_done"; turnId: number }
  | { type: "interrupted"; turnId: number }
  | { type: "speak_text"; turnId: number; text: string; language: string }
  | ({ type: "safety"; turnId: number } & SafetyInfo)
  | { type: "error"; code: VoiceErrorCode; fatal: boolean }
  | { type: "session_ending"; reason: "time_limit" | "idle" | "ended" }
  | { type: "pong" };

export type ClientMessage =
  | { type: "interrupt" }
  | { type: "text_input"; text: string }
  | { type: "playback_done"; turnId: number }
  | { type: "end" }
  | { type: "ping" };

export interface AudioFrame {
  sampleRate: number;
  turnId: number;
  samples: Float32Array;
}

export interface VoiceConfig {
  provider: string;
  languages: { code: string; name: string; nativeName: string }[];
  defaultLanguage: string;
  maxSessionMinutes: number;
  transcriptStorageAvailable: boolean;
  transcriptRetentionDays: number;
}
