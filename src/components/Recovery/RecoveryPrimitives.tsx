import React, { useId, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Info } from "lucide-react";
import type { RecoveryStatus, RecoveryVerification } from "../../types/recovery";
import {
  RECOVERY_STATUS_LABELS,
  RECOVERY_VERIFICATION_LABELS,
} from "../../types/recovery";
import { localisedUrl, type OfficialResource } from "../../services/officialResources";

/**
 * The parts every Recovery Hub screen is built from.
 *
 * They exist so the rules this feature has to keep are kept once, in code,
 * rather than remembered on each screen:
 *
 *   - Nothing is shown as a status without also showing whose claim it is.
 *   - Every official link names its publisher and when the address was checked.
 *   - Every form step can be left without losing anything.
 *
 * Visually these are the app's existing vocabulary: card-elev, btn-primary,
 * btn-ghost, the same ink and line colours. No new palette, no new typography,
 * nothing that would make this section look bolted on.
 */

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/**
 * Whose claim this is.
 *
 * The single most important component in the feature. Every status in the
 * Recovery Hub is someone's assertion, and almost all of them are the user's
 * own: AURA has no authorised feed from any police, court or compensation
 * system. Showing a status without this badge would let a person read their own
 * note back as though an authority had confirmed it.
 *
 * USER_REPORTED is deliberately the plainest of the three rather than the most
 * alarming. It is the normal case, not a warning.
 */
export const VerificationBadge: React.FC<{
  verification: RecoveryVerification;
  className?: string;
}> = ({ verification, className = "" }) => {
  const tone =
    verification === "OFFICIALLY_VERIFIED"
      ? "bg-[#E9EFE2] text-[#4A5E3C] border-[#CFDCC2]"
      : verification === "DOCUMENT_VERIFIED"
        ? "bg-[#F3E7D8] text-[#8A4A20] border-[#E6D3BC]"
        : "bg-[#F5F1EA] text-[#6B5B4C] border-[#E4DCD0]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone} ${className}`}
    >
      {RECOVERY_VERIFICATION_LABELS[verification]}
    </span>
  );
};

export const StatusPill: React.FC<{ status: RecoveryStatus }> = ({ status }) => (
  <span className="inline-flex items-center rounded-full border border-[#E4DCD0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3A2A1E]">
    {RECOVERY_STATUS_LABELS[status]}
  </span>
);

// ---------------------------------------------------------------------------
// Official links
// ---------------------------------------------------------------------------

/**
 * A link to somewhere outside AURA.
 *
 * Carries the publisher and the date the address was last checked, because a
 * person about to type an FIR number into a government form deserves to see
 * who they are about to trust and how fresh our information is.
 *
 * It cannot promise the site is up. A browser gives a page no way to tell
 * whether a cross-origin link resolved, so rather than fake a health check
 * this says plainly what to do if the page does not load, which is the §29
 * behaviour: never fabricate, always reassure that saved information is safe.
 */
export const OfficialLink: React.FC<{
  resource: OfficialResource;
  language?: string;
  compact?: boolean;
  /**
   * Why this one was surfaced for this person.
   *
   * Shown because a list that looks identical after changing an answer reads
   * as a control that does nothing. Several of these genuinely do apply to
   * everybody, and saying so is better than inventing gating that would hide a
   * route somebody is entitled to.
   */
  reason?: string;
}> = ({ resource, language = "en", compact = false, reason }) => {
  const href = localisedUrl(resource.url, language);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link block rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-4 sm:p-5 transition-colors hover:bg-[#F7F0E5]"
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-serif text-[1.0625rem] leading-[1.35] text-[#3A2A1E]">
            {resource.name}
          </span>
          <span className="mt-1 block text-[0.8125rem] font-semibold text-[#8A4A20]">
            {resource.authority}
          </span>
          {!compact && (
            <span className="mt-2 block text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
              {resource.description}
            </span>
          )}
          {reason && (
            <span className="mt-2.5 block border-l-2 border-[#E0D0BB] pl-3 text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
              {reason}
            </span>
          )}
          <span className="mt-2 block text-[0.75rem] text-[#7A6A5A]">
            Address last checked {formatDate(resource.checkedOn)}
          </span>
        </span>
        <ExternalLink
          size={16}
          aria-hidden="true"
          className="mt-1 shrink-0 text-[#9A8B77] transition-colors group-hover/link:text-[#3A2A1E]"
        />
      </span>
      <span className="sr-only">Opens the official site in a new tab</span>
    </a>
  );
};

/**
 * Shown alongside any group of outbound links.
 *
 * Says the §29 sentence before it is needed rather than after, because the
 * moment a government portal is down is the moment somebody concludes their
 * case has vanished.
 */
export const OfficialSiteNotice: React.FC = () => (
  <p className="flex items-start gap-2.5 rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.6] text-[#6B5B4C]">
    <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#8A4A20]" />
    <span>
      These are official sites run by the government, not by AURA. If one
      doesn&rsquo;t open, it is usually the service being temporarily
      unavailable. Everything you have saved here is safe, and you can try
      again later.
    </span>
  </p>
);

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

export const EmptyState: React.FC<{
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ message, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-dashed border-[#E0D4C3] bg-[#FDFAF4] px-5 py-8 text-center">
    <p className="text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">{message}</p>
    {actionLabel && onAction && (
      <button onClick={onAction} className="btn-soft mt-4 px-5 py-2.5 min-h-[44px] text-[0.875rem]">
        {actionLabel}
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Always says what is still safe.
 *
 * Someone who has just entrusted an account of an assault to a form and then
 * sees a red box assumes the worst. §29 requires the reassurance to be part of
 * the error, not a separate consolation somewhere else on the page.
 */
export const ErrorNote: React.FC<{ message: string }> = ({ message }) => (
  <p
    role="alert"
    className="rounded-2xl border border-[#E4C3B4] bg-[#FBEFE9] px-4 py-3.5 text-[0.875rem] leading-[1.6] text-[#8A3F20]"
  >
    {message}
  </p>
);

// ---------------------------------------------------------------------------
// Step shell
// ---------------------------------------------------------------------------

/**
 * One question, or one small group of related questions, per screen.
 *
 * The check-in already works this way and it is the right shape here for the
 * same reason: a long form is unreadable on a phone and unbearable when the
 * subject is what was done to you. Back never destroys anything, and "Save and
 * come back later" is offered on every step rather than hidden at the end,
 * because leaving has to be as easy as continuing.
 */
export const StepShell: React.FC<{
  eyebrow?: string;
  title: string;
  help?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSaveAndExit?: () => void;
  busy?: boolean;
  error?: string | null;
  /** 1-based position, for the progress line. Omitted on single screens. */
  step?: number;
  totalSteps?: number;
}> = ({
  eyebrow,
  title,
  help,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  onSaveAndExit,
  busy,
  error,
  step,
  totalSteps,
}) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-7">
      <header className="space-y-3">
        {eyebrow && (
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            {eyebrow}
          </span>
        )}
        <h1
          id={headingId}
          className="text-[1.5rem] sm:text-[1.875rem] leading-[1.2] text-[#3A2A1E]"
        >
          {title}
        </h1>
        {help && (
          <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">{help}</p>
        )}
        {step && totalSteps && (
          <p className="text-[0.8125rem] text-[#7A6A5A]">
            Step {step} of {totalSteps}
          </p>
        )}
      </header>

      <div className="space-y-5">{children}</div>

      {error && <ErrorNote message={error} />}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              disabled={busy}
              className="btn-ghost px-5 py-3 text-[0.9375rem] disabled:opacity-60"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>
          )}
          {onSaveAndExit && (
            <button
              onClick={onSaveAndExit}
              disabled={busy}
              className="min-h-[44px] px-1 text-[0.875rem] font-semibold text-[#7A6A5A] underline-offset-4 hover:text-[#3A2A1E] hover:underline disabled:opacity-60"
            >
              Save and come back later
            </button>
          )}
        </div>
        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled || busy}
            className="btn-primary px-6 py-3.5 text-[0.9375rem] disabled:opacity-60"
          >
            {busy ? "Saving…" : nextLabel}
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "date" | "number";
  optional?: boolean;
  /**
   * Shown when the field is needed and empty.
   *
   * Phrased as what it is for, never as "this field is required". Someone
   * filling this in has been told what to produce by enough offices already,
   * and a form that only says "required" is one more of them.
   */
  needed?: string;
}> = ({ label, value, onChange, hint, placeholder, type = "text", optional, needed }) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const needId = `${id}-need`;
  const showNeed = Boolean(needed) && !value.trim();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[0.9375rem] font-semibold text-[#3A2A1E]">
        {label}
        {optional && (
          <span className="ml-2 font-normal text-[0.8125rem] text-[#7A6A5A]">
            optional
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={Boolean(needed)}
        aria-required={needed ? true : undefined}
        aria-describedby={[hint ? hintId : "", showNeed ? needId : ""].filter(Boolean).join(" ") || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-3.5 text-[1rem] text-[#3A2A1E] placeholder:text-[#6F5F4F] ${
          showNeed ? "border-[#C9A184]" : "border-[#E4D7C6]"
        }`}
      />
      {showNeed && (
        <p id={needId} className="text-[0.8125rem] leading-[1.6] text-[#8A4A20]">
          {needed}
        </p>
      )}
    </div>
  );
};

export const TextArea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
  placeholder?: string;
  needed?: string;
}> = ({ label, value, onChange, hint, rows = 7, placeholder, needed }) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const needId = `${id}-need`;
  const showNeed = Boolean(needed) && !value.trim();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[0.9375rem] font-semibold text-[#3A2A1E]">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        required={Boolean(needed)}
        aria-required={needed ? true : undefined}
        aria-describedby={[hint ? hintId : "", showNeed ? needId : ""].filter(Boolean).join(" ") || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-3.5 text-[1rem] leading-[1.7] text-[#3A2A1E] placeholder:text-[#6F5F4F] ${
          showNeed ? "border-[#C9A184]" : "border-[#E4D7C6]"
        }`}
      />
      {showNeed && (
        <p id={needId} className="text-[0.8125rem] leading-[1.6] text-[#8A4A20]">
          {needed}
        </p>
      )}
    </div>
  );
};

export interface Choice<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

/**
 * A list of options, as real radio or checkbox inputs.
 *
 * Buttons styled to look like a radio group lose the arrow-key behaviour and
 * the group semantics a screen reader announces, and this is a form somebody
 * may be completing with a screen reader at two in the morning.
 */
export function ChoiceList<T extends string>({
  legend,
  hint,
  choices,
  selected,
  onChange,
  multiple = false,
}: {
  legend: string;
  hint?: string;
  choices: Choice<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}) {
  const name = useId();
  const toggle = (value: T) => {
    if (multiple) {
      onChange(selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]);
    } else {
      onChange([value]);
    }
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-[0.9375rem] font-semibold text-[#3A2A1E]">{legend}</legend>
      {hint && (
        <p className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">{hint}</p>
      )}
      <div className="space-y-2.5 pt-1">
        {choices.map((c) => {
          const isSelected = selected.includes(c.value);
          return (
            <label
              key={c.value}
              className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border px-4 py-4 transition-colors ${
                isSelected
                  ? "border-[#C88A5A] bg-[#F9F1E6]"
                  : "border-[#ECE1D3] bg-white hover:bg-[#FBF5EC]"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                checked={isSelected}
                onChange={() => toggle(c.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#A85D2E]"
              />
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-[#3A2A1E]">
                  {c.label}
                </span>
                {c.detail && (
                  <span className="mt-1 block text-[0.875rem] leading-[1.6] text-[#6B5B4C]">
                    {c.detail}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export const SectionCard: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <section className="card-elev rounded-2xl p-5 sm:p-6">
    <header className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-serif text-[1.125rem] leading-[1.3] text-[#3A2A1E]">{title}</h2>
      {action}
    </header>
    {children}
  </section>
);

/** A row of facts, each with the source of the claim beside it. */
export const FactRow: React.FC<{ label: string; value?: string | null }> = ({
  label,
  value,
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-[#F1E7DA] py-2.5 last:border-b-0">
    <span className="text-[0.875rem] text-[#6B5B4C]">{label}</span>
    <span className="text-right text-[0.9375rem] font-semibold text-[#3A2A1E]">
      {value || <span className="font-normal text-[#7A6A5A]">Not added yet</span>}
    </span>
  </div>
);

/** A save button that confirms in place instead of firing a toast into the void. */
export const SaveButton: React.FC<{
  onSave: () => Promise<void>;
  label?: string;
  disabled?: boolean;
}> = ({ onSave, label = "Save", disabled }) => {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  return (
    <button
      disabled={disabled || state === "saving"}
      onClick={async () => {
        setState("saving");
        try {
          await onSave();
          setState("saved");
          window.setTimeout(() => setState("idle"), 2200);
        } catch {
          setState("idle");
        }
      }}
      className="btn-primary px-5 py-3 text-[0.9375rem] disabled:opacity-60"
    >
      {state === "saved" ? (
        <>
          <Check size={16} aria-hidden="true" />
          Saved
        </>
      ) : state === "saving" ? (
        "Saving…"
      ) : (
        label
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
