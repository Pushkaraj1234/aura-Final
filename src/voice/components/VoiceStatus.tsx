import type { Strings } from "../lib/i18n";
import type { VoiceErrorCode, VoiceStatus as Status } from "../lib/voiceTypes";

interface Props {
  status: Status;
  error: VoiceErrorCode | null;
  strings: Strings;
}

export function VoiceStatus({ status, error, strings }: Props) {
  const label: Record<Status, string> = {
    idle: strings.tapToTalk,
    connecting: strings.connecting,
    listening: strings.listening,
    thinking: strings.thinking,
    speaking: strings.speaking,
    error: error ? strings.errors[error] : strings.errors.internal,
  };
  const hint = status === "listening" ? strings.listeningHint : status === "speaking" ? strings.speakingHint : null;
  const transientError = status !== "error" && error ? strings.errors[error] : null;

  return (
    <div className="voice-status" role="status" aria-live="polite">
      <p className={`voice-status-label ${status === "error" ? "is-error" : ""}`}>{label[status]}</p>
      {hint && <p className="voice-status-hint">{hint}</p>}
      {transientError && <p className="voice-status-hint is-error">{transientError}</p>}
    </div>
  );
}
