import { parseAudioFrame } from "./audioUtils";
import { VOICE_SUBPROTOCOL } from "./voiceConfig";
import type { AudioFrame, ClientMessage, ServerMessage } from "./voiceTypes";

export interface VoiceClientHandlers {
  onOpen: () => void;
  onMessage: (message: ServerMessage) => void;
  onAudio: (frame: AudioFrame) => void;
  onClose: (event: { code: number; wasClean: boolean }) => void;
  onError: () => void;
}

/** Drop mic frames rather than build latency if the network can't keep up. */
const MAX_BUFFERED_BYTES = 256 * 1024;

/**
 * Thin WebSocket wrapper. It deliberately doesn't know whether Gemini, Ollama,
 * or anything else is behind the backend.
 */
export class VoiceClient {
  private socket: WebSocket | null = null;

  connect(url: string, token: string, handlers: VoiceClientHandlers): void {
    // The session token rides in the subprotocol header, not the URL, so it never lands in logs.
    const socket = new WebSocket(url, [VOICE_SUBPROTOCOL, `token.${token}`]);
    socket.binaryType = "arraybuffer";
    socket.onopen = handlers.onOpen;
    socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data === "string") {
        try {
          handlers.onMessage(JSON.parse(event.data) as ServerMessage);
        } catch {
          /* ignore malformed */
        }
      } else {
        handlers.onAudio(parseAudioFrame(event.data));
      }
    };
    socket.onclose = (event) => handlers.onClose({ code: event.code, wasClean: event.wasClean });
    socket.onerror = handlers.onError;
    this.socket = socket;
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send(message: ClientMessage): void {
    if (this.isOpen) this.socket!.send(JSON.stringify(message));
  }

  sendAudio(pcm16: ArrayBuffer): void {
    if (this.isOpen && this.socket!.bufferedAmount < MAX_BUFFERED_BYTES) this.socket!.send(pcm16);
  }

  /** Closes without firing onClose (a deliberate disconnect is not a dropped connection). */
  disconnect(): void {
    if (!this.socket) return;
    this.socket.onclose = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.close(1000);
    this.socket = null;
  }
}
