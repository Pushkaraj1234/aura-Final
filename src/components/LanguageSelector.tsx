import React from "react";
import { Globe2, Loader2, TriangleAlert } from "lucide-react";
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
 * Laid out as a single bordered pill rather than a row of loose parts. It sits
 * in a navigation bar that is already full, and the earlier version appended
 * "Translating…" or "Showing English" as separate text beside the select —
 * which widened the whole control the moment anything went wrong and pushed
 * the items next to it off the edge. State now lives on the icon, so the
 * control is the same width whatever is happening inside it.
 *
 * It still reports that state rather than pretending translation is instant:
 * picking a language with no bundled dictionary means a call to Bhashini, and
 * a person watching the screen deserves to know it is working — and to be told
 * plainly when it could not, instead of silently reading English and wondering
 * whether the app ignored them.
 */
export const LanguageSelector: React.FC<Props> = ({ variant = "full", className = "" }) => {
  const { lang, setLang, languages, status, degradedReason } = useLanguage();

  const degraded = status === "degraded" && lang !== "en";
  const loading = status === "loading";

  // One sentence covering whichever state applies, used for the tooltip and
  // read out by a screen reader. Nothing about the layout depends on it.
  const statusText = loading
    ? "Translating this page…"
    : degraded
      ? degradedReason
        ? `Showing English — ${degradedReason}`
        : "Showing English — the translation service could not be reached."
      : "";

  const Icon = loading ? Loader2 : degraded ? TriangleAlert : Globe2;

  return (
    <div
      className={`inline-flex items-center gap-1.5 min-w-0 rounded-full border pl-2.5 pr-1.5 py-1 transition-colors ${
        degraded
          ? "border-[#D49B6A]/50 bg-[#D49B6A]/10"
          : "border-[#EFE8E2] bg-white/70"
      } ${className}`}
      title={statusText || undefined}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className={`shrink-0 ${
          loading ? "animate-spin text-[#7F8C8D]" : degraded ? "text-[#B0713C]" : "text-[#5A5049]"
        }`}
      />

      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        aria-label="Choose your language"
        data-language-picker
        className={`min-w-0 bg-transparent text-xs font-bold text-[#3C3530] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DBC3B2] rounded cursor-pointer ${
          variant === "compact" ? "max-w-[5rem]" : "max-w-[8.5rem] min-[1750px]:max-w-[11rem]"
        }`}
      >
        {/* Never translated. The list is how someone finds their way back, so
            every language has to stay written in its own name — a person who
            switched to a script they cannot read must still be able to see
            "English" and "हिन्दी" and pick one. Translating these turned the
            picker into a trap. */}
        {languages.map((l) => (
          <option key={l.code} value={l.code} data-no-translate>
            {variant === "compact"
              ? l.code.toUpperCase()
              : l.code === "en"
                ? l.native
                : `${l.native} · ${l.english}`}
          </option>
        ))}
      </select>

      {/* The same message the tooltip carries, announced rather than drawn, so
          it costs no width in a bar that has none to give. */}
      {statusText && (
        <span className="sr-only" role="status">
          {statusText}
        </span>
      )}
    </div>
  );
};
