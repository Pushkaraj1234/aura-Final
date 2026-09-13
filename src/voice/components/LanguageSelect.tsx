import { useId } from "react";
import type { VoiceConfig } from "../lib/voiceTypes";

interface Props {
  value: string;
  languages: VoiceConfig["languages"];
  label: string;
  disabled: boolean;
  onChange: (code: string) => void;
}

export function LanguageSelect({ value, languages, label, disabled, onChange }: Props) {
  const id = useId();
  return (
    <div className="language-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {languages.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName === l.name ? l.name : `${l.nativeName} (${l.name})`}
          </option>
        ))}
      </select>
    </div>
  );
}
