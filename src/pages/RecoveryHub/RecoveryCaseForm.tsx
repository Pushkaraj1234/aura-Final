import React, { useState } from "react";
import { StepShell, TextField } from "../../components/Recovery/RecoveryPrimitives";
import { INDIAN_STATES } from "../../services/indianStates";

/**
 * Opening a file.
 *
 * WHAT IS REQUIRED, AND WHY IT IS NOT "NOTHING"
 *
 * An earlier version of this screen made everything optional except the state,
 * on the reasoning that a survivor should never be blocked by a form. That was
 * the wrong conclusion from a right instinct, and it produced a file that could
 * not pre-fill a single official application, which is the entire reason those
 * details are collected here rather than typed again on every portal.
 *
 * So each required field earns it by pointing at something concrete:
 *
 *   - Name, because every compensation and legal-aid application asks for it.
 *   - One way to be reached, because an application with no contact route is
 *     one the office cannot progress. Both blank is the case that cannot be
 *     right; either one alone is fine.
 *   - State, because it decides which schemes and which police portal we show,
 *     and getting it wrong sends someone to the wrong government.
 *   - District, because the SC/ST atrocity assistance is administered by the
 *     district Assistant Commissioner of Social Welfare. Without it we cannot
 *     tell anyone which office is theirs.
 *
 * REQUIRED TO CONTINUE IS NOT REQUIRED TO EXIST
 *
 * Nothing here is a wall. The account already knows the name and email, so
 * three of the four arrive filled in, and every later screen keeps "save and
 * come back later", which stores whatever has been typed. What is prevented is
 * sleepwalking to the end of the intake with an empty file and discovering it
 * at the compensation office.
 */

interface Props {
  defaultName?: string;
  defaultEmail?: string;
  defaultLanguage: string;
  busy: boolean;
  error: string | null;
  onCreate: (fields: {
    displayName?: string;
    contactPhone?: string;
    contactEmail?: string;
    state?: string;
    district?: string;
    language: string;
  }) => void;
  onBack: () => void;
}

export const RecoveryCaseForm: React.FC<Props> = ({
  defaultName,
  defaultEmail,
  defaultLanguage,
  busy,
  error,
  onCreate,
  onBack,
}) => {
  const [displayName, setDisplayName] = useState(defaultName || "");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail || "");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");

  return (
    <StepShell
      eyebrow="Your file"
      title="Let's open a file for you"
      help="A few things applications will ask for, so you only type them once. Most of it is already filled in from your account."
      onBack={onBack}
      onNext={() =>
        onCreate({
          displayName: displayName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          state: state || undefined,
          district: district.trim() || undefined,
          language: defaultLanguage,
        })
      }
      nextLabel="Open my file"
      // Both contact fields blank is the case that cannot be right: either one
      // alone is enough, and the account email means this is usually already
      // satisfied before the screen is read.
      nextDisabled={
        !displayName.trim() ||
        !state ||
        !district.trim() ||
        (!contactPhone.trim() && !contactEmail.trim())
      }
      busy={busy}
      error={error}
    >
      <TextField
        label="Your name"
        hint="As it appears on the documents you'll be using, if you can. Applications ask for it, and this saves you typing it each time."
        value={displayName}
        onChange={setDisplayName}
        needed="Applications ask for a name, so we need one to fill in for you."
      />

      <div className="space-y-2">
        <p className="text-[0.9375rem] font-semibold text-[#3A2A1E]">
          How you can be reached
        </p>
        <p className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
          One of these is enough. An office with no way to reach you
          can&rsquo;t take an application forward, so this is the one thing we
          won&rsquo;t leave blank.
        </p>
        <div className="grid gap-5 pt-1 sm:grid-cols-2">
          <TextField
            label="Phone"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
            needed={!contactEmail.trim() ? "A phone number or an email address." : undefined}
          />
          <TextField
            label="Email"
            type="email"
            value={contactEmail}
            onChange={setContactEmail}
            needed={!contactPhone.trim() ? "A phone number or an email address." : undefined}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="rh-state"
          className="block text-[0.9375rem] font-semibold text-[#3A2A1E]"
        >
          State
        </label>
        <p id="rh-state-hint" className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
          This decides which schemes and which police portal we show you, so it
          is the one thing worth getting right.
        </p>
        <select
          id="rh-state"
          value={state}
          aria-describedby="rh-state-hint"
          onChange={(e) => setState(e.target.value)}
          className="w-full rounded-xl border border-[#E4D7C6] bg-white px-4 py-3.5 text-[1rem] text-[#3A2A1E]"
        >
          <option value="">Choose a state or union territory</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label="District"
        hint="Assistance for atrocities is handled by the district office, so this is how we can point you at the right one."
        value={district}
        onChange={setDistrict}
        needed="We need the district to tell you which office handles your area."
      />

      {/* Said before the id is generated, not after, so it is never mistaken
          for an official number in the first place. */}
      <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
        When you open a file we&rsquo;ll give it a Recovery Hub case ID, so you
        can find it again. It is ours, for this website only. It is not an FIR
        number, a court case number, or a government application number.
      </p>
    </StepShell>
  );
};
