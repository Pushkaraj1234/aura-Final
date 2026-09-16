import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  ChoiceList,
  FactRow,
  OfficialLink,
  OfficialSiteNotice,
  SaveButton,
  SectionCard,
  TextField,
  VerificationBadge,
  formatDate,
} from "../../components/Recovery/RecoveryPrimitives";
import { matchResources } from "../../services/officialResources";
import type { RecoveryFir as Fir } from "../../types/recovery";

/**
 * The FIR screen.
 *
 * THE LINE THIS SCREEN CANNOT CROSS
 *
 * AURA does not register FIRs, cannot register FIRs, and has no feed from any
 * police system. Everything a person types here is their own record of what
 * they were told, which is why the verification badge sits beside the number
 * rather than in a footnote, and why the "no FIR" branch explains the official
 * process and links to the police rather than offering a button that looks
 * like it might do it for them.
 *
 * A survivor who believed this app had filed their FIR, and so did not go to
 * the police, would have been harmed by this screen. That possibility is the
 * design constraint.
 */

interface Props {
  fir: Fir | null;
  caseState?: string;
  language: string;
  busy: boolean;
  error: string | null;
  onSave: (patch: Partial<Fir>) => Promise<void>;
  onBack: () => void;
}

const CASE_STAGES = [
  "Complaint made",
  "FIR registered",
  "Investigation",
  "Charge sheet filed",
  "In court",
  "I don't know",
];

export const RecoveryFirScreen: React.FC<Props> = ({
  fir,
  caseState,
  language,
  busy,
  error,
  onSave,
  onBack,
}) => {
  const answered = fir?.hasFir === true || fir?.hasFir === false;
  const [hasFir, setHasFir] = useState<string[]>(
    fir?.hasFir === true ? ["yes"] : fir?.hasFir === false ? ["no"] : []
  );
  const [firNumber, setFirNumber] = useState(fir?.firNumber || "");
  const [firYear, setFirYear] = useState(fir?.firYear ? String(fir.firYear) : "");
  const [policeStation, setPoliceStation] = useState(fir?.policeStation || "");
  const [district, setDistrict] = useState(fir?.district || "");
  const [firDate, setFirDate] = useState(fir?.firDate || "");
  const [caseStage, setCaseStage] = useState<string[]>(
    fir?.caseStage ? [fir.caseStage] : []
  );

  const policeResources = matchResources(
    { state: caseState, financialImpacts: [] },
    "police"
  );

  const yes = hasFir[0] === "yes";
  const no = hasFir[0] === "no";

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          FIR and case
        </span>
        <h1 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          Where the police side stands
        </h1>
      </header>

      <SectionCard title="Do you already have an FIR?">
        <ChoiceList
          legend="Do you already have an FIR?"
          choices={[
            { value: "yes", label: "Yes, an FIR has been registered" },
            { value: "no", label: "No, or I'm not sure whether one was registered" },
          ]}
          selected={hasFir}
          onChange={setHasFir}
        />
      </SectionCard>

      {yes && (
        <SectionCard
          title="FIR details"
          action={<VerificationBadge verification={fir?.verification || "USER_REPORTED"} />}
        >
          <p className="mb-5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            Saved so you have it when an application asks for it. We have no way
            to check these against police records, so they stay marked as
            something you told us.
          </p>

          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="FIR number"
                placeholder="123/2026"
                value={firNumber}
                onChange={setFirNumber}
              />
              <TextField
                label="Year"
                type="number"
                placeholder="2026"
                value={firYear}
                onChange={setFirYear}
                optional
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Police station"
                value={policeStation}
                onChange={setPoliceStation}
                optional
              />
              <TextField
                label="District"
                value={district}
                onChange={setDistrict}
                optional
              />
            </div>
            <TextField
              label="Date on the FIR"
              type="date"
              value={firDate}
              onChange={setFirDate}
              optional
            />

            <ChoiceList
              legend="Where do you understand the case has got to?"
              hint="As you understand it. This is your note, not a status from the police."
              choices={CASE_STAGES.map((s) => ({ value: s, label: s }))}
              selected={caseStage}
              onChange={setCaseStage}
            />
          </div>

          {error && (
            <p role="alert" className="mt-4 text-[0.875rem] text-[#8A3F20]">
              {error}
            </p>
          )}

          <div className="mt-6">
            <SaveButton
              disabled={busy}
              label="Save FIR details"
              onSave={() =>
                onSave({
                  hasFir: true,
                  firNumber: firNumber.trim() || undefined,
                  firYear: firYear ? Number(firYear) : undefined,
                  policeStation: policeStation.trim() || undefined,
                  district: district.trim() || undefined,
                  firDate: firDate || undefined,
                  caseStage: caseStage[0],
                  verification: "USER_REPORTED",
                })
              }
            />
          </div>
        </SectionCard>
      )}

      {no && (
        <SectionCard title="You haven't added an FIR yet">
          <div className="space-y-4 text-[0.9375rem] leading-[1.75] text-[#5A4636]">
            <p>
              An FIR, a First Information Report, is the record the police make
              when they are told about a serious offence. It is what most
              compensation and legal-aid applications ask for, which is why it
              matters so much to the rest of this.
            </p>
            <p>
              Broadly, it is made at the police station for the area where the
              incident happened. Many states also let you start a complaint
              online, and some offences can be reported at any station rather
              than only the local one. What you are told at the station, and
              what is written down, is worth keeping a note of.
            </p>
            <p className="font-semibold text-[#3A2A1E]">
              AURA cannot register an FIR for you, and nothing on this website
              registers one. Only the police can, and the links below go to
              them.
            </p>
            <p>
              This is general information, not legal advice. What applies to
              your situation can differ, and a legal services authority can
              tell you what does.
            </p>
          </div>

          <div className="mt-6">
            <SaveButton
              disabled={busy}
              label="Save this answer"
              onSave={() => onSave({ hasFir: false })}
            />
          </div>
        </SectionCard>
      )}

      {answered && fir?.hasFir && (
        <SectionCard
          title="FIR and case"
          action={<VerificationBadge verification={fir.verification} />}
        >
          <FactRow label="FIR" value={fir.firNumber} />
          <FactRow label="Police station" value={fir.policeStation} />
          <FactRow label="District" value={fir.district} />
          <FactRow label="FIR date" value={formatDate(fir.firDate)} />
          <FactRow label="Where you understand it has got to" value={fir.caseStage} />
          <FactRow label="Last updated" value={formatDate(fir.updatedAt)} />
        </SectionCard>
      )}

      {policeResources.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
            Official FIR information
          </h2>
          <OfficialSiteNotice />
          <div className="grid gap-3 sm:grid-cols-2">
            {policeResources.map((r) => (
              <OfficialLink key={r.key} resource={r} language={language} />
            ))}
          </div>
        </section>
      )}

      {policeResources.length === 0 && caseState && (
        <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          We don&rsquo;t yet have a checked link to the police portal for{" "}
          {caseState}. Rather than guess at an address, we would rather say so:
          your state police website, or the station itself, is the reliable
          route.
        </p>
      )}

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};
