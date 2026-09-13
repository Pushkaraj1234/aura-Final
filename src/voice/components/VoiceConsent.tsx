import { useId, useState } from "react";
import type { Strings } from "../lib/i18n";

interface Props {
  strings: Strings;
  transcriptStorageAvailable: boolean;
  retentionDays: number;
  onAccept: (choice: { storeTranscript: boolean }) => void;
}

/** Plain-language consent shown before first use. Transcript storage is opt-in and off by default. */
export function VoiceConsent({ strings, transcriptStorageAvailable, retentionDays, onAccept }: Props) {
  const [storeTranscript, setStoreTranscript] = useState(false);
  const titleId = useId();

  return (
    <section className="voice-consent" aria-labelledby={titleId}>
      <h2 id={titleId}>{strings.consentTitle}</h2>
      <p>{strings.consentIntro}</p>
      <ul>
        <li>{strings.consentProcessing}</li>
        <li>{strings.consentNoPressure}</li>
        <li>{strings.consentStop}</li>
        <li>{strings.consentNotHuman}</li>
      </ul>
      {transcriptStorageAvailable && (
        <label className="consent-option">
          <input type="checkbox" checked={storeTranscript} onChange={(e) => setStoreTranscript(e.target.checked)} />
          <span>{strings.consentStore(retentionDays)}</span>
        </label>
      )}
      <button type="button" className="primary-button" onClick={() => onAccept({ storeTranscript })}>
        {strings.consentStart}
      </button>
    </section>
  );
}
