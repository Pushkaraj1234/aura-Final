import type { VoiceStatus } from "../lib/voiceTypes";

interface Props {
  status: VoiceStatus;
  interruptLabel: string;
  onInterrupt: () => void;
}

/** Calm visual state indicator. While speaking it doubles as a large interrupt target. */
export function VoiceOrb({ status, interruptLabel, onInterrupt }: Props) {
  const orb = (
    <span className={`orb orb-${status}`} aria-hidden="true">
      <span className="orb-ring" />
      <span className="orb-ring" />
      <span className="orb-core" />
    </span>
  );

  if (status === "speaking") {
    return (
      <button type="button" className="voice-orb voice-orb-button" onClick={onInterrupt} aria-label={interruptLabel}>
        {orb}
      </button>
    );
  }
  return <div className="voice-orb">{orb}</div>;
}
