import React from "react";
import { Globe2, Loader2, WifiOff } from "lucide-react";
import { LanguageCode } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface Props {
  /** `full` names the language in its own script; `compact` shows the code. */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * The one language control in the app.
 *
 * It reports its own state rather than pretending translation is instant:
 * picking a language with no bundled dictionary means a call to Bhashini, and
 * a person watching the screen deserves to know it is working — and to be told
 * plainly when it could not, instead of silently reading English and wondering
 * whether the app ignored them.
 */
export const LanguageSelector: React.FC<Props> = ({ variant = "full", className = "" }) => {
  const { lang, setLang, languages, status, degradedReason } = useLanguage();

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <Globe2 size={15} className="text-[#5A5049] shrink-0" />

      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        aria-label="Choose your language"
        data-language-picker
        className={
          variant === "compact"
            ? "text-xs font-bold text-[#3C3530] bg-[#FDF9F5] border border-[#EFE8E2] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#DBC3B2] cursor-pointer max-w-[9rem]"
            : "text-xs font-bold text-[#3C3530] bg-transparent focus:outline-none focus:ring-2 focus:ring-[#DBC3B2] rounded cursor-pointer max-w-[13rem] truncate"
        }
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {variant === "compact"
              ? l.code.toUpperCase()
              : l.code === "en"
                ? l.native
                : `${l.native} · ${l.english}`}
          </option>
        ))}
      </select>

      {status === "loading" && (
        <span className="flex items-center gap-1 text-[10px] text-[#7F8C8D] shrink-0">
          <Loader2 size={11} className="animate-spin" />
          <span className="hidden sm:inline">Translating…</span>
        </span>
      )}

      {/* Shown for every language but English. Hindi and Marathi have a built-in
          questionnaire dictionary, but the rest of their screens still go
          through Bhashini, so they can degrade too — hiding the notice for
          them left a half-translated page with nothing to explain it. */}
      {status === "degraded" && lang !== "en" && (
        <span
          className="flex items-center gap-1 text-[10px] text-[#A55D25] shrink-0"
          title={degradedReason || "The translation service could not be reached."}
        >
          <WifiOff size={11} />
          <span className="hidden sm:inline">Showing English</span>
        </span>
      )}
    </div>
  );
};
