import { useEffect, useId, useRef } from "react";
import type { Strings } from "../lib/i18n";
import type { SafetyInfo } from "../lib/voiceTypes";

interface Props {
  safety: SafetyInfo;
  strings: Strings;
  onDismiss: () => void;
}

/** Calm, non-blocking safety card. Only verified resources from the backend are shown. */
export function SafetyPanel({ safety, strings, onDismiss }: Props) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [safety]);

  return (
    <section className={`safety-panel mode-${safety.mode.toLowerCase()}`} role="alert" aria-labelledby={titleId}>
      <h2 id={titleId} ref={heading} tabIndex={-1}>
        {strings.safetyTitle}
      </h2>
      <p>{safety.message}</p>
      {safety.resources.length > 0 && (
        <ul className="safety-resources">
          {safety.resources.map((r) => (
            <li key={r.id}>
              {r.phone ? (
                <a className="resource-call" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>
                  {strings.safetyCall(r.name)} · {r.phone}
                </a>
              ) : (
                <span>{r.name}</span>
              )}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="resource-link">
                  {r.url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary-button" onClick={onDismiss}>
        {strings.safetyContinue}
      </button>
    </section>
  );
}
