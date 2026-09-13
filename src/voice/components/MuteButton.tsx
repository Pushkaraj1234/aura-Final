interface Props {
  muted: boolean;
  onToggle: () => void;
  muteLabel: string;
  unmuteLabel: string;
}

/**
 * Turns the microphone off without leaving the conversation.
 *
 * Deliberately a second control rather than a mode of the stop button: someone
 * muting because a person has just walked into the room wants the mic off
 * *now* and the conversation still there afterwards. Ending and restarting
 * would lose the thread and cost another connection.
 */
export function MuteButton({ muted, onToggle, muteLabel, unmuteLabel }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? unmuteLabel : muteLabel}
      className={`mute-button ${muted ? "is-muted" : ""}`}
    >
      {muted ? (
        // Struck-through mic: the state it is *in*, not the action.
        <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M4 3.5 20.5 20"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      )}
      <span>{muted ? unmuteLabel : muteLabel}</span>
    </button>
  );
}
