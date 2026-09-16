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
 *
 * WHAT HAS TO BE FILLED IN, AND THE WAY ROUND BEING CRUEL ABOUT IT
 *
 * An earlier version of this screen made every field on it optional, so the
 * whole intake could be completed with a category and nothing else. That file
 * is useless for the thing the person came here for: every compensation form
 * asks when and where, the document checklist is built from the impacts, and
 * the resource matcher has nothing to match on. Being asked for those at the
 * counter, months later, is worse than being asked for them here.
 *
 * The date is the hard case. Somebody may genuinely not know it, and a
 * required date picker with no way out is the kind of form that makes people
 * invent an answer or abandon the page. So the date is required, and "I don't
 * remember the exact date" is a real option that asks instead for whatever
 * they do remember: a month, a festival, the week a hearing fell. That is what
 * an official form will accept as an approximate date anyway.
 *
 * "Save and come back later" remains on every step and stores whatever has
 * been typed, so required-to-continue never means work lost.
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
  // A file restored with a note but no date was one where the exact date was
  // not known, so the toggle comes back the way it was left.
  const [dateUnknown, setDateUnknown] = useState(
    Boolean(incident?.occurredTimeNote && !incident?.occurredOn)
  );
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

  // Either an exact date or something they do remember about when; and either
  // a place or a district. Both blank is the state that cannot be right.
  const whenAnswered = dateUnknown ? Boolean(timeNote.trim()) : Boolean(occurredOn);
  const whereAnswered = Boolean(location.trim() || district.trim());

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
        help="When and where, as near as you can say. If you don't remember the exact date there is a way to say so."
        step={2}
        totalSteps={TOTAL}
        onBack={() => setStep(1)}
        onNext={() => saveAnd(() => setStep(3))}
        nextDisabled={!whenAnswered || !whereAnswered}
        onSaveAndExit={() => saveAnd(onExit)}
        busy={busy}
        error={error}
      >
        {!dateUnknown ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Date it happened"
              type="date"
              value={occurredOn}
              onChange={setOccurredOn}
              needed="Every compensation form asks for this, so it is worth having saved."
            />
            <TextField
              label="Roughly what time"
              placeholder="Late evening, around 9pm…"
              value={timeNote}
              onChange={setTimeNote}
              optional
            />
          </div>
        ) : (
          <TextField
            label="When, as near as you can say"
            hint="A month, a season, a festival, the week something else happened. Offices accept an approximate date."
            placeholder="Some time in July, around the time of the first hearing"
            value={timeNote}
            onChange={setTimeNote}
            needed="Whatever you do remember about when. It does not have to be exact."
          />
        )}

        {/* The way out of a required date that is not "leave it blank". A form
            with no escape here makes people invent a date, and an invented
            date on an official application is worse than an approximate one. */}
        <label className="flex cursor-pointer items-center gap-3 text-[0.875rem] text-[#6B5B4C]">
          <input
            type="checkbox"
            checked={dateUnknown}
            onChange={(e) => {
              setDateUnknown(e.target.checked);
              if (e.target.checked) setOccurredOn("");
            }}
            className="h-4 w-4 accent-[#A85D2E]"
          />
          I don&rsquo;t remember the exact date
        </label>

        <TextField
          label="Where it happened"
          hint="A village, a road, a workplace. Whatever describes it."
          value={location}
          onChange={setLocation}
          needed={
            !district.trim()
              ? "Where it happened, or the district below. Applications ask which area it falls in."
              : undefined
          }
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
          <TextField
            label="District"
            value={district}
            onChange={setDistrict}
            needed={
              !location.trim() ? "The district, or where it happened above." : undefined
            }
          />
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
        nextDisabled={!account.trim()}
        onSaveAndExit={() => saveAnd(onExit)}
        busy={busy}
        error={error}
      >
        <TextArea
          label="Your account"
          hint="As much or as little as you want. A few lines is enough, and you can add to it any time."
          needed="In your own words, however short. This is the part no form and no office can write for you."
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
      nextDisabled={impacts.length === 0}
      nextLabel="Finish"
      onSaveAndExit={() => saveAnd(onExit)}
      busy={busy}
      error={error}
    >
      <ChoiceList<ImpactType>
        legend="How has this affected you?"
        hint="At least one. Your document checklist and the schemes we show you are built from these, so an empty answer leaves both empty."
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
