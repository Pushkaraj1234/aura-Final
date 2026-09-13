import { useEffect, useRef } from "react";
import type { Strings } from "../lib/i18n";
import type { VoiceMessage } from "../lib/voiceTypes";

interface Props {
  messages: VoiceMessage[];
  visible: boolean;
  onToggle: () => void;
  strings: Strings;
}

export function VoiceTranscript({ messages, visible, onToggle, strings }: Props) {
  const list = useRef<HTMLOListElement>(null);

  // Scroll only the caption list, never the page, so controls don't jump under the user's finger.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <section className="voice-transcript" aria-label={strings.captions}>
      <button type="button" className="link-button" onClick={onToggle} aria-expanded={visible}>
        {visible ? strings.captionsHide : strings.captionsShow}
      </button>
      {/* data-no-translate: these captions are what the person actually said,
          transcribed. AURA never sends a survivor's own words to a third-party
          translation service, and the voice backend has already produced them
          in the language they chose. */}
      {visible && messages.length > 0 && (
        <ol ref={list} className="transcript-list" role="log" aria-live="polite" data-no-translate>
          {messages.map((m) => (
            <li key={m.id} className={`transcript-item from-${m.role} ${m.final ? "" : "is-partial"}`}>
              <span className="transcript-speaker">{m.role === "user" ? strings.you : strings.assistant}</span>
              <span className="transcript-text">{m.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
