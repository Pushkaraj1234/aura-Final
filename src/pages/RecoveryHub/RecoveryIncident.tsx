import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  ChoiceList,
  StepShell,
  TextArea,
  TextField,
} from "../../components/Recovery/RecoveryPrimitives";
import { voiceRecordingService } from "../../services/voiceRecording";
import { INDIAN_STATES } from "../../services/indianStates";
import { INCIDENT_CATEGORY_LABELS, IMPACT_LABELS } from "../../services/recoveryHub";
import type {
  AccountSource,
  ImpactType,
  IncidentCategory,
  RecoveryIncident as Incident,
} from "../../types/recovery";

/**
 * What happened, in four short screens.
 *
 * ONE QUESTION AT A TIME
 *
 * The check-in already works this way. It matters more here: a single long
 * form asking for the date, the place, the police station and an account of an
 * assault, all visible at once, is a wall, and on a phone it is an unreadable
 * wall. Each screen saves before it advances, so leaving is never a loss.
 *
 * THE ACCOUNT IS NOT PROCESSED
 *
 * Whatever a person writes is stored as they wrote it. Nothing summarises it,
 * classifies it, or turns it into a legal characterisation. Software deciding
 * that a description amounts to an offence would be both wrong and quotable
 * against the person who wrote it, and the category they pick stays their
 * label rather than our conclusion.
 *
 * "I don't know" is a real answer and appears in the list, because somebody
 * who cannot yet name what happened to them is not an invalid form state.
 */

interface Props {
  incident: Incident | null;
  caseState?: string;
  caseDistrict?: string;
  busy: boolean;
  error: string | null;
  onSave: (patch: Partial<Incident>) => Promise<void>;
  onDone: () => void;
  onExit: () => void;
}

const TOTAL = 4;

export const RecoveryIncidentIntake: React.FC<Props> = ({
  incident,
  caseState,
  caseDistrict,
  busy,
  error,
  onSave,
  onDone,
  onExit,
}) => {
  const [step, setStep] = useState(1);

  const [category, setCategory] = useState<IncidentCategory[]>(
    incident?.category ? [incident.category] : []
  );
  const [occurredOn, setOccurredOn] = useState(incident?.occurredOn || "");
  const [timeNote, setTimeNote] = useState(incident?.occurredTimeNote || "");
  const [location, setLocation] = useState(incident?.location || "");
  const [state, setState] = useState(incident?.state || caseState || "");
  const [district, setDistrict] = useState(incident?.district || caseDistrict || "");
  const [policeStation, setPoliceStation] = useState(incident?.policeStation || "");
  const [account, setAccount] = useState(incident?.account || "");
  const [accountSource, setAccountSource] = useState<AccountSource>(
    incident?.accountSource || "typed"
  );
  const [impacts, setImpacts] = useState<ImpactType[]>(incident?.impacts || []);

  // -- voice ----------------------------------------------------------------
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const baseAccount = useRef("");
  const supportsVoice = voiceRecordingService.isSpeechRecognitionSupported();

  useEffect(() => () => voiceRecordingService.cleanup(), []);

  const startVoice = async () => {
    setVoiceError(null);
    baseAccount.current = account ? `${account.trimEnd()} ` : "";
    const ok = await voiceRecordingService.startRecording(
      (finalText, interimText) => {
        // Appended to what was already typed rather than replacing it, so
        // switching between speaking and typing never eats the earlier words.
        setAccount(baseAccount.current + finalText);
        setInterim(interimText);
      },
      () => {},
      (err) => {
        setVoiceError(err);
        setRecording(false);
      }
    );
    if (ok) {
      setRecording(true);
      setAccountSource("voice");
    }
  };

  const stopVoice = async () => {
    await voiceRecordingService.stopRecording();
    setRecording(false);
    setInterim("");
  };

  const saveAnd = async (next: () => void) => {
    await onSave({
      category: category[0],
      occurredOn: occurredOn || undefined,
      occurredTimeNote: timeNote || undefined,
      location: location || undefined,
      state: state || undefined,
      district: district || undefined,
      policeStation: policeStation || undefined,
      account: account || undefined,
      accountSource: account ? accountSource : undefined,
      impacts,
    });
    next();
  };

  // -------------------------------------------------------------------------

  if (step === 1) {
    return (
      <StepShell
        eyebrow="What happened"
        title="What happened?"
        help="Pick whatever is closest. You can change it later, and nothing here decides anything about your case."
        step={1}
        totalSteps={TOTAL}
        onBack={onExit}
        onNext={() => saveAnd(() => setStep(2))}
        nextDisabled={category.length === 0}
        onSaveAndExit={() => saveAnd(onExit)}
        busy={busy}
        error={error}
      >
        <ChoiceList<IncidentCategory>
          legend="What happened?"
          choices={(Object.keys(INCIDENT_CATEGORY_LABELS) as IncidentCategory[]).map(
            (k) => ({ value: k, label: INCIDENT_CATEGORY_LABELS[k] })
          )}
          selected={category}
          onChange={setCategory}
        />
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell
        eyebrow="What happened"
        title="When and where"
        help="As much or as little as you remember. Leaving something blank is fine."
        step={2}
        totalSteps={TOTAL}
        onBack={() => setStep(1)}
        onNext={() => saveAnd(() => setStep(3))}
        onSaveAndExit={() => saveAnd(onExit)}
        busy={busy}
        error={error}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Date it happened"
            type="date"
            value={occurredOn}
            onChange={setOccurredOn}
            optional
          />
          <TextField
            label="Roughly what time"
            placeholder="Late evening, around 9pm…"
            value={timeNote}
            onChange={setTimeNote}
            optional
          />
        </div>

        <TextField
          label="Where it happened"
          hint="A village, a road, a workplace. Whatever describes it."
          value={location}
          onChange={setLocation}
          optional
        />

        <div className="space-y-2">
          <label
            htmlFor="inc-state"
            className="block text-[0.9375rem] font-semibold text-[#3A2A1E]"
          >
            State
          </label>
          <select
            id="inc-state"
            value={state}
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

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="District" value={district} onChange={setDistrict} optional />
          <TextField
            label="Police station"
            hint="If you know which one covers the area."
            value={policeStation}
            onChange={setPoliceStation}
            optional
          />
        </div>
      </StepShell>
    );
  }

  if (step === 3) {
    return (
      <StepShell
        eyebrow="What happened"
        title="Tell it in your own words"
        help="There is no right way to write this, and no length it has to be. What you write is kept exactly as you write it."
        step={3}
        totalSteps={TOTAL}
        onBack={() => setStep(2)}
        onNext={() => saveAnd(() => setStep(4))}
        onSaveAndExit={() => saveAnd(onExit)}
        busy={busy}
        error={error}
      >
        <TextArea
          label="Your account"
          hint="Only what you want to write down. You can add to it any time."
          value={account + (interim ? ` ${interim}` : "")}
          onChange={(v) => {
            setAccount(v);
            setAccountSource("typed");
          }}
          placeholder="Start wherever it makes sense to start."
        />

        {supportsVoice ? (
          <div className="flex flex-wrap items-center gap-3">
            {!recording ? (
              <button onClick={startVoice} className="btn-ghost px-5 py-3 text-[0.9375rem]">
                <Mic size={16} aria-hidden="true" />
                Tell your story by voice
              </button>
            ) : (
              <button onClick={stopVoice} className="btn-primary px-5 py-3 text-[0.9375rem]">
                <Square size={14} aria-hidden="true" />
                Stop recording
              </button>
            )}
            <span aria-live="polite" className="text-[0.8125rem] text-[#6B5B4C]">
              {recording
                ? "Listening. What you say is written into the box above, for you to edit."
                : "Speaking works too. The words go into the box so you stay in control of them."}
            </span>
          </div>
        ) : (
          <p className="text-[0.8125rem] leading-[1.6] text-[#6B5B4C]">
            Speaking instead of typing isn&rsquo;t available in this browser.
            Chrome on Android or Safari on iPhone usually supports it.
          </p>
        )}

        {voiceError && (
          <p role="alert" className="text-[0.875rem] text-[#8A3F20]">
            The microphone couldn&rsquo;t start: {voiceError}. You can still type,
            and anything already written is safe.
          </p>
        )}

        <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          Nothing rewrites or summarises what you put here, and nothing turns it
          into a legal conclusion. It stays in your words, for you to use when
          you talk to a lawyer, a counsellor or an official.
        </p>
      </StepShell>
    );
  }

  return (
    <StepShell
      eyebrow="What happened"
      title="How has this affected you?"
      help="Choose as many as apply. This helps us show which kinds of support may be worth reading about."
      step={4}
      totalSteps={TOTAL}
      onBack={() => setStep(3)}
      onNext={() => saveAnd(onDone)}
      nextLabel="Finish"
      onSaveAndExit={() => saveAnd(onExit)}
      busy={busy}
      error={error}
    >
      <ChoiceList<ImpactType>
        legend="How has this affected you?"
        choices={(Object.keys(IMPACT_LABELS) as ImpactType[]).map((k) => ({
          value: k,
          label: IMPACT_LABELS[k],
        }))}
        selected={impacts}
        onChange={setImpacts}
        multiple
      />

      <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
        This helps us point you at resources that may be relevant. It does not
        decide whether you qualify for anything. That is decided by the
        authority running each scheme.
      </p>
    </StepShell>
  );
};
