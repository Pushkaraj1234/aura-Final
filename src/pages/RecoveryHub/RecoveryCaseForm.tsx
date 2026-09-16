import React, { useState } from "react";
import { StepShell, TextField } from "../../components/Recovery/RecoveryPrimitives";
import { INDIAN_STATES } from "../../services/indianStates";

/**
 * Opening a file.
 *
 * ASKS FOR LITTLE, REQUIRES LESS
 *
 * Every field here is optional except the state, and the state is asked for
 * only because it decides which schemes and which police portal are worth
 * showing: getting it wrong sends someone to the wrong government. Name and
 * contact are collected because applications ask for them later and nobody
 * should type their own name four times, not because the file needs them.
 *
 * A person may want a record before they are ready to put their name on
 * anything, and a form that refuses to proceed without one turns the first
 * screen into a checkpoint.
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
      help="Only what's useful later. You can leave anything blank and add it whenever you want."
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
      nextDisabled={!state}
      busy={busy}
      error={error}
    >
      <TextField
        label="What should we call you?"
        hint="A first name or anything you like. It is only shown back to you."
        value={displayName}
        onChange={setDisplayName}
        optional
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Phone"
          type="tel"
          value={contactPhone}
          onChange={setContactPhone}
          optional
        />
        <TextField
          label="Email"
          type="email"
          value={contactEmail}
          onChange={setContactEmail}
          optional
        />
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

      <TextField label="District" value={district} onChange={setDistrict} optional />

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
