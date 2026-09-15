import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { quickExit, watchForEscapeExit, wipeLocalTraces, ESCAPE_PRESSES_TO_EXIT } from "../services/safetyExit";

/**
 * The way out.
 *
 * Deliberately plain and deliberately small. A large red "ESCAPE" banner is
 * itself a disclosure: it tells anyone glancing at the phone that this is an
 * app somebody needed to hide from them, which is the opposite of what a
 * survivor on a monitored device needs. This reads as a close button, because
 * that is all it should look like.
 *
 * Bottom-left rather than bottom-right: the assistant's floating button
 * already occupies the right, and a safety control that overlaps something
 * else is a safety control that fails when it is needed.
 *
 * It never asks for confirmation. A dialog asking "are you sure you want to
 * leave?" while the person someone is afraid of walks across the room is worse
 * than useless, and the cost of an accidental press is one sign-in.
 */

interface Props {
  /** Shown only to signed-in participants; staff are not the threat model. */
  visible: boolean;
}

export const SafetyExitButton: React.FC<Props> = ({ visible }) => {
  const [leaving, setLeaving] = useState(false);

  const exit = useCallback(() => {
    setLeaving(true);
    void quickExit({
      wipe: wipeLocalTraces,
      signOut: () => supabase.auth.signOut(),
      replace: (url) => window.location.replace(url),
      // Long enough for a sign-out on a slow connection, short enough that
      // nobody stands in front of their own check-in waiting for it.
      signOutTimeoutMs: 1200,
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    return watchForEscapeExit(exit);
  }, [visible, exit]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={exit}
      disabled={leaving}
      aria-label={`Leave this site now. Clears what is stored on this device. Or press Escape ${ESCAPE_PRESSES_TO_EXIT} times.`}
      title={`Leave now (Escape x${ESCAPE_PRESSES_TO_EXIT})`}
      className="fixed bottom-6 left-6 z-50 inline-flex items-center gap-1.5 rounded-full border border-[#E0D7CE] bg-white/95 px-3.5 py-2.5 text-xs font-semibold text-[#5A5049] shadow-lg backdrop-blur-sm transition-colors hover:bg-white hover:text-[#3C3530] disabled:opacity-60"
    >
      <X size={14} aria-hidden="true" />
      <span>Leave</span>
    </button>
  );
};
