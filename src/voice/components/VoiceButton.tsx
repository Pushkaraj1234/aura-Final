interface Props {
  active: boolean;
  onClick: () => void;
  startLabel?: string;
  stopLabel?: string;
  disabled?: boolean;
}

export function VoiceButton({ active, onClick, startLabel = "Start voice assistant", stopLabel = "Stop voice assistant", disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? stopLabel : startLabel}
      aria-pressed={active}
      className={`voice-button ${active ? "active" : ""}`}
    >
      {active ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" width="28" height="28">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" width="30" height="30">
          <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      )}
    </button>
  );
}
