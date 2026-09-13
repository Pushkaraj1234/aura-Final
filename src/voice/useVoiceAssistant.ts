import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "./lib/audioManager";
import { AudioPlayer } from "./lib/audioPlayer";
import { VoiceClient, type VoiceClientHandlers } from "./lib/voiceClient";
import { BARGE_IN, RECONNECT_DELAYS_MS, httpUrl, wsUrl } from "./lib/voiceConfig";
import type {
  AudioFrame,
  ClientMessage,
  SafetyInfo,
  ServerMessage,
  VoiceErrorCode,
  VoiceMessage,
  VoiceSession,
  VoiceStatus,
} from "./lib/voiceTypes";

export interface VoiceClientLike {
  connect(url: string, token: string, handlers: VoiceClientHandlers): void;
  send(message: ClientMessage): void;
  sendAudio(pcm16: ArrayBuffer): void;
  disconnect(): void;
  readonly isOpen: boolean;
}

export interface MicLike {
  startMicrophone(onFrame: (pcm16: ArrayBuffer, level: number) => void): Promise<unknown>;
  stopMicrophone(): void;
  setMuted(muted: boolean): void;
}

export interface PlayerLike {
  unlock(): Promise<void>;
  enqueue(turnId: number, sampleRate: number, samples: Float32Array): void;
  speakText(turnId: number, text: string, language: string): void;
  markResponseDone(turnId: number): void;
  stop(turnId?: number): void;
  close(): void;
  readonly isPlaying: boolean;
}

export interface VoiceDeps {
  createClient: () => VoiceClientLike;
  createMic: () => MicLike;
  createPlayer: (onPlaybackEnd: (turnId: number) => void) => PlayerLike;
  fetch: typeof fetch;
  isSupported: () => boolean;
}

const defaultDeps: VoiceDeps = {
  createClient: () => new VoiceClient(),
  createMic: () => new AudioManager(),
  createPlayer: (onEnd) => new AudioPlayer(onEnd),
  // Parameters<> rather than a bare spread: AURA compiles with a DOM lib whose
  // fetch signature is an overload set, and an untyped rest argument cannot be
  // spread into it.
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  isSupported: () => AudioManager.isSupported() && typeof WebSocket !== "undefined",
};

export interface VoiceOptions {
  language: string;
  storeTranscript: boolean;
}

export type SessionEndReason = "time_limit" | "idle" | null;

function micErrorCode(error: unknown): VoiceErrorCode {
  const name = (error as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "mic_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "mic_unavailable";
  return "internal";
}

export function useVoiceAssistant(options: VoiceOptions, deps: VoiceDeps = defaultDeps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const [safety, setSafety] = useState<SafetyInfo | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason>(null);
  const [muted, setMuted] = useState(false);

  const client = useRef<VoiceClientLike | null>(null);
  const mic = useRef<MicLike | null>(null);
  const player = useRef<PlayerLike | null>(null);
  const session = useRef<VoiceSession | null>(null);
  const active = useRef(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loudFrames = useRef(0);
  // Read inside onMicFrame, which is memoised and would otherwise close over a
  // stale value and keep streaming after the button said it had stopped.
  const mutedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const teardown = useCallback(() => {
    active.current = false;
    mutedRef.current = false;
    setMuted(false);
    clearTimeout(reconnectTimer.current);
    client.current?.disconnect();
    mic.current?.stopMicrophone();
    player.current?.close();
    client.current = null;
    mic.current = null;
    player.current = null;
    session.current = null;
  }, []);

  const fail = useCallback(
    (code: VoiceErrorCode) => {
      teardown();
      setError(code);
      setStatus("error");
    },
    [teardown],
  );

  const interrupt = useCallback(() => {
    player.current?.stop();
    loudFrames.current = 0;
    client.current?.send({ type: "interrupt" });
    setStatus("listening");
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    mic.current?.setMuted(next);
    setMuted(next);
    // Nothing is sent to the server: muting is a local decision about this
    // person's own microphone, and the session carries on either way.
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "ready":
          reconnectAttempt.current = 0;
          setError(null);
          setStatus("listening");
          break;
        case "status":
          // Local playback may outlast the server's view of the turn.
          if (message.status === "listening" && player.current?.isPlaying) break;
          setStatus(message.status);
          break;
        case "transcript":
          setMessages((prev) => {
            const next = prev.filter((m) => m.id !== message.replaces);
            const index = next.findIndex((m) => m.id === message.id);
            const entry: VoiceMessage = {
              id: message.id,
              role: message.role,
              text: message.text,
              final: message.final,
              timestamp: index >= 0 ? next[index]!.timestamp : Date.now(),
            };
            if (index >= 0) next[index] = entry;
            else next.push(entry);
            return next;
          });
          break;
        case "response_done":
          player.current?.markResponseDone(message.turnId);
          break;
        case "interrupted":
          player.current?.stop(message.turnId);
          setStatus("listening");
          break;
        case "speak_text":
          player.current?.speakText(message.turnId, message.text, message.language);
          setStatus("speaking");
          break;
        case "safety": {
          const { type: _type, turnId: _turnId, ...info } = message;
          setSafety(info);
          break;
        }
        case "error":
          if (message.fatal) fail(message.code);
          else setError(message.code);
          break;
        case "session_ending":
          teardown();
          setEndReason(message.reason === "ended" ? null : message.reason);
          setStatus("idle");
          break;
      }
    },
    [fail, teardown],
  );

  const connect = useCallback(() => {
    const current = session.current;
    if (!current) return;
    const socket = deps.createClient();
    client.current = socket;
    socket.connect(wsUrl(), current.token, {
      onOpen: () => undefined,
      onMessage: handleMessage,
      onAudio: (frame: AudioFrame) => {
        player.current?.enqueue(frame.turnId, frame.sampleRate, frame.samples);
      },
      onError: () => undefined,
      onClose: () => {
        if (!active.current) return;
        player.current?.stop();
        const delay = RECONNECT_DELAYS_MS[reconnectAttempt.current];
        if (delay === undefined || Date.parse(current.expiresAt) < Date.now()) {
          fail("connection_lost");
          return;
        }
        reconnectAttempt.current += 1;
        setStatus("connecting");
        reconnectTimer.current = setTimeout(() => active.current && connect(), delay);
      },
    });
  }, [deps, fail, handleMessage]);

  const onMicFrame = useCallback(
    (pcm16: ArrayBuffer, level: number) => {
      const socket = client.current;
      if (!socket?.isOpen) return;
      // Muted: send nothing and let no barge-in fire. The track is already
      // delivering silence; this makes sure a muted person can never
      // accidentally interrupt the assistant either.
      if (mutedRef.current) {
        loudFrames.current = 0;
        return;
      }
      socket.sendAudio(pcm16);

      // Barge-in: stop the assistant the instant the user clearly starts speaking.
      if (player.current?.isPlaying) {
        loudFrames.current = level > BARGE_IN.rms ? loudFrames.current + 1 : 0;
        if (loudFrames.current >= BARGE_IN.frames) interrupt();
      } else {
        loudFrames.current = 0;
      }
    },
    [interrupt],
  );

  const start = useCallback(async () => {
    if (active.current) return;
    if (!deps.isSupported()) {
      setError("unsupported");
      setStatus("error");
      return;
    }
    active.current = true;
    setError(null);
    setSafety(null);
    setEndReason(null);
    setStatus("connecting");

    const audioOut = deps.createPlayer((turnId) => {
      client.current?.send({ type: "playback_done", turnId });
      setStatus("listening");
    });
    player.current = audioOut;
    // Unlock audio inside the tap so iOS allows playback later.
    void audioOut.unlock().catch(() => undefined);

    const microphone = deps.createMic();
    mic.current = microphone;
    try {
      await microphone.startMicrophone(onMicFrame);
    } catch (e) {
      fail(micErrorCode(e));
      return;
    }
    if (!active.current) return;

    try {
      const response = await deps.fetch(httpUrl("/voice/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: optionsRef.current.language,
          consent: { voiceProcessing: true, storeTranscript: optionsRef.current.storeTranscript },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: VoiceErrorCode };
        fail(body.error ?? "provider_unavailable");
        return;
      }
      session.current = (await response.json()) as VoiceSession;
    } catch {
      fail("network");
      return;
    }
    if (!active.current) return;
    reconnectAttempt.current = 0;
    connect();
  }, [connect, deps, fail, onMicFrame]);

  const stop = useCallback(() => {
    client.current?.send({ type: "end" });
    teardown();
    setStatus("idle");
  }, [teardown]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    player.current?.stop();
    client.current?.send({ type: "text_input", text: trimmed });
  }, []);

  const dismissSafety = useCallback(() => setSafety(null), []);

  useEffect(() => teardown, [teardown]);

  return {
    status,
    messages,
    error,
    safety,
    endReason,
    muted,
    start,
    stop,
    interrupt,
    toggleMute,
    sendText,
    dismissSafety,
  };
}
