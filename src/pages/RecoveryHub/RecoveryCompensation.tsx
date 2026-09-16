import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, Circle, ExternalLink, Plus } from "lucide-react";
import {
  ChoiceList,
  EmptyState,
  ErrorNote,
  FactRow,
  OfficialLink,
  OfficialSiteNotice,
  SaveButton,
  SectionCard,
  TextArea,
  TextField,
  VerificationBadge,
  formatDate,
} from "../../components/Recovery/RecoveryPrimitives";
import {
  localisedUrl,
  matchResources,
  officialResource,
} from "../../services/officialResources";
import { DOCUMENT_LABELS, FINANCIAL_IMPACT_LABELS } from "../../services/recoveryHub";
import type {
  CompensationApplication,
  RecoveryCaseBundle,
  RecoveryStatus,
} from "../../types/recovery";
import { RECOVERY_STATUS_LABELS } from "../../types/recovery";

/**
 * Compensation: preparing an application, then tracking it.
 *
 * NOTHING IS TYPED TWICE
 *
 * The brief's requirement, and the one that decides whether this screen is
 * worth having. By the time someone reaches it they have already given their
 * name, state, district, FIR number, police station and incident date. Asking
 * again is not neutral: re-entering the details of an assault is re-living it,
 * and a form that does that will be abandoned. Everything below is pre-filled
 * from the file and every field stays editable, because the pre-filled value
 * is our guess at what they meant, not a fact they have to live with.
 *
 * AURA DOES NOT SUBMIT ANYTHING
 *
 * This prepares answers and then sends the person to the official portal to
 * submit them there. The step is labelled as leaving, the ladder afterwards
 * tracks what they tell us happened, and every rung carries whose claim it is.
 * There is no authorised API behind any of it, so the alternative to being
 * explicit about that is inventing a status, which is the one thing this
 * feature must never do.
 */

const LADDER: { status: RecoveryStatus; label: string }[] = [
  { status: "IN_PROGRESS", label: "Application prepared" },
  { status: "SUBMITTED", label: "Application submitted" },
  { status: "VERIFICATION_REQUIRED", label: "Documents under verification" },
  { status: "UNDER_REVIEW", label: "Authority review" },
  { status: "APPROVED", label: "Sanctioned" },
  { status: "COMPLETED", label: "Payment received" },
];

const LADDER_ORDER: RecoveryStatus[] = LADDER.map((l) => l.status);

interface Props {
  bundle: RecoveryCaseBundle;
  language: string;
  busy: boolean;
  error: string | null;
  onSave: (patch: Partial<CompensationApplication> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

export const RecoveryCompensationScreen: React.FC<Props> = ({
  bundle,
  language,
  busy,
  error,
  onSave,
  onDelete,
  onBack,
}) => {
  const { case: kase, incident, fir, documents } = bundle;
  const [mode, setMode] = useState<"list" | "prepare" | "track">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Pre-filled from the file. Held in state so every one stays editable.
  const [name, setName] = useState(kase.displayName || "");
  const [phone, setPhone] = useState(kase.contactPhone || "");
  const [state, setState] = useState(kase.state || "");
  const [district, setDistrict] = useState(kase.district || "");
  const [firNumber, setFirNumber] = useState(fir?.firNumber || "");
  const [policeStation, setPoliceStation] = useState(
    fir?.policeStation || incident?.policeStation || ""
  );
  const [incidentDate, setIncidentDate] = useState(incident?.occurredOn || "");
  const [medicalNote, setMedicalNote] = useState("");
  const [courtNote, setCourtNote] = useState("");

  // Tracking fields
  const active = bundle.compensation.find((a) => a.id === activeId);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [appliedOn, setAppliedOn] = useState("");
  const [authority, setAuthority] = useState("");
  const [status, setStatus] = useState<RecoveryStatus[]>(["SUBMITTED"]);
  const [nextFollowUpOn, setNextFollowUpOn] = useState("");
  const [notes, setNotes] = useState("");

  const applyResource = officialResource("nalsa_victim_compensation_apply")!;
  const trackResource = officialResource("nalsa_track_application")!;
  const schemes = useMemo(
    () =>
      matchResources(
        {
          state: kase.state,
          category: incident?.category,
          financialImpacts: kase.financialImpacts,
        },
        "state_scheme"
      ),
    [kase.state, kase.financialImpacts, incident?.category]
  );

  const openTracker = (app?: CompensationApplication) => {
    setActiveId(app?.id ?? null);
    setApplicationNumber(app?.applicationNumber || "");
    setAppliedOn(app?.appliedOn || "");
    setAuthority(app?.authority || "");
    setStatus([app?.status || "SUBMITTED"]);
    setNextFollowUpOn(app?.nextFollowUpOn || "");
    setNotes(app?.notes || "");
    setMode("track");
  };

  // -------------------------------------------------------------------------
  // Prepare
  // -------------------------------------------------------------------------
  if (mode === "prepare") {
    const heldDocs = documents.map((d) => d.docType);
    return (
      <div className="space-y-7">
        <header className="space-y-3">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            Preparing an application
          </span>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
            Everything in one place, before you apply
          </h2>
          <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
            We&rsquo;ve filled in what you already told us. Check it, change
            anything that isn&rsquo;t right, and then you&rsquo;ll have it all
            together when you fill in the official form.
          </p>
        </header>

        <SectionCard title="1. About you">
          <div className="space-y-5">
            <TextField label="Name" value={name} onChange={setName} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Phone" type="tel" value={phone} onChange={setPhone} optional />
              <TextField label="State" value={state} onChange={setState} />
            </div>
            <TextField label="District" value={district} onChange={setDistrict} optional />
          </div>
        </SectionCard>

        <SectionCard title="2. The incident">
          <div className="space-y-5">
            <TextField
              label="Date it happened"
              type="date"
              value={incidentDate}
              onChange={setIncidentDate}
              optional
            />
            {incident?.account && (
              <div>
                <p className="text-[0.9375rem] font-semibold text-[#3A2A1E]">
                  Your account
                </p>
                <p className="mt-2 max-w-[62ch] whitespace-pre-wrap rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5 text-[0.9375rem] leading-[1.7] text-[#5A4636]">
                  {incident.account}
                </p>
                <p className="mt-2 text-[0.8125rem] text-[#7A6A5A]">
                  Kept exactly as you wrote it. Edit it on the incident screen
                  if you want to change anything.
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="3. FIR">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="FIR number" value={firNumber} onChange={setFirNumber} optional />
            <TextField
              label="Police station"
              value={policeStation}
              onChange={setPoliceStation}
              optional
            />
          </div>
        </SectionCard>

        <SectionCard title="4. Financial impact">
          {kase.financialImpacts.length === 0 ? (
            <p className="text-[0.9375rem] text-[#6B5B4C]">
              Nothing recorded yet. The financial support screen is where this
              is set.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {kase.financialImpacts.map((f) => (
                <li key={f} className="text-[0.9375rem] text-[#3A2A1E]">
                  {FINANCIAL_IMPACT_LABELS[f]}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="5. Medical and court">
          <div className="space-y-5">
            <TextArea
              label="Anything about medical treatment"
              rows={3}
              hint="Where you were treated, and roughly when. Only if it applies."
              value={medicalNote}
              onChange={setMedicalNote}
            />
            <TextArea
              label="Anything about the court case"
              rows={3}
              hint="Case number or which court, if it has reached one."
              value={courtNote}
              onChange={setCourtNote}
            />
          </div>
        </SectionCard>

        <SectionCard title="6. Documents you have">
          {heldDocs.length === 0 ? (
            <EmptyState message="You haven't added any documents yet. You can still apply, and add them when they're asked for." />
          ) : (
            <ul className="space-y-1.5">
              {heldDocs.map((d, i) => (
                <li key={`${d}-${i}`} className="flex items-center gap-2 text-[0.9375rem] text-[#3A2A1E]">
                  <Check size={14} aria-hidden="true" className="text-[#5E7A4A]" />
                  {DOCUMENT_LABELS[d]}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="7. Applying">
          <p className="mb-4 text-[0.9375rem] leading-[1.7] text-[#6B5B4C]">
            The application is made on the official portal, not here. AURA
            can&rsquo;t submit it for you and doesn&rsquo;t send anything on your
            behalf. Open the form, use what you&rsquo;ve just checked, and when
            you get a diary number come back and save it.
          </p>
          <OfficialSiteNotice />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <OfficialLink resource={applyResource} language={language} />
            {schemes.map((r) => (
              <OfficialLink key={r.key} resource={r} language={language} />
            ))}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorNote message={error} />
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <SaveButton
              disabled={busy}
              label="Save this preparation"
              onSave={async () => {
                await onSave({
                  status: "IN_PROGRESS",
                  schemeKey: schemes[0]?.key || "nalsa_victim_compensation",
                  draft: {
                    name,
                    phone,
                    state,
                    district,
                    firNumber,
                    policeStation,
                    incidentDate,
                    medicalNote,
                    courtNote,
                    financialImpacts: kase.financialImpacts,
                    documents: heldDocs,
                  },
                });
                setMode("list");
              }}
            />
            <button onClick={() => setMode("list")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
              Cancel
            </button>
          </div>
        </SectionCard>

        <button onClick={() => setMode("list")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Track
  // -------------------------------------------------------------------------
  if (mode === "track") {
    const currentIndex = LADDER_ORDER.indexOf(status[0]);
    return (
      <div className="space-y-7">
        <header className="space-y-3">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            Compensation status
          </span>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
            Where your application stands
          </h2>
        </header>

        {/* The ladder. Drawn from what the person has told us, and labelled as
            such directly above it, because a ladder of ticks is the most
            official-looking thing on the page. */}
        <section className="card-elev rounded-2xl p-5 sm:p-6">
          <p className="mb-5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            This reflects what you&rsquo;ve told us. AURA has no connection to
            the compensation system and cannot see your real status. For that,
            use the official tracking page below with your diary number.
          </p>

          <ol className="space-y-1 border-l-2 border-[#EDE2D4] pl-6">
            {LADDER.map((rung, i) => {
              const reached = currentIndex >= i;
              return (
                <li key={rung.status} className="relative py-2.5">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      reached
                        ? "border-[#A85D2E] bg-[#A85D2E] text-white"
                        : "border-[#E0D0BB] bg-white"
                    }`}
                  >
                    {reached ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Circle size={6} className="fill-current opacity-40" />
                    )}
                  </span>
                  <span
                    className={`text-[0.9375rem] font-semibold ${
                      reached ? "text-[#3A2A1E]" : "text-[#A99A8A]"
                    }`}
                  >
                    {rung.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <SectionCard title="Your record of it">
          <div className="space-y-5">
            <TextField
              label="Application number"
              hint="The diary number from the official portal."
              value={applicationNumber}
              onChange={setApplicationNumber}
              optional
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Submitted on"
                type="date"
                value={appliedOn}
                onChange={setAppliedOn}
                optional
              />
              <TextField
                label="Which authority"
                value={authority}
                onChange={setAuthority}
                optional
              />
            </div>

            <ChoiceList<RecoveryStatus>
              legend="Where has it got to?"
              hint="As you understand it. This is your own note, not a status from the authority."
              choices={LADDER.map((l) => ({
                value: l.status,
                label: `${l.label} (${RECOVERY_STATUS_LABELS[l.status]})`,
              }))}
              selected={status}
              onChange={setStatus}
            />

            <TextField
              label="Remind me to follow up on"
              type="date"
              value={nextFollowUpOn}
              onChange={setNextFollowUpOn}
              optional
            />
            <TextArea label="Notes" rows={3} value={notes} onChange={setNotes} />

            {error && <ErrorNote message={error} />}

            <div className="flex flex-wrap gap-3">
              <SaveButton
                disabled={busy}
                label="Save"
                onSave={async () => {
                  await onSave({
                    id: active?.id,
                    applicationNumber: applicationNumber.trim() || undefined,
                    appliedOn: appliedOn || undefined,
                    authority: authority.trim() || undefined,
                    status: status[0],
                    nextFollowUpOn: nextFollowUpOn || undefined,
                    notes: notes.trim() || undefined,
                  });
                  setMode("list");
                }}
              />
              <button onClick={() => setMode("list")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
                Cancel
              </button>
            </div>
          </div>
        </SectionCard>

        <section className="space-y-3">
          <h3 className="font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
            Track on the official portal
          </h3>
          <OfficialSiteNotice />
          <OfficialLink resource={trackResource} language={language} />
          <a
            href={localisedUrl(trackResource.url, language)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-6 py-3.5 text-[0.9375rem]"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Open official tracking
          </a>
        </section>

        <button onClick={() => setMode("list")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Compensation
        </span>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          Applications you&rsquo;ve prepared
        </h2>
      </header>

      <SectionCard
        title="Your applications"
        action={
          <button
            onClick={() => setMode("prepare")}
            className="btn-ghost px-4 py-2.5 text-[0.8125rem]"
          >
            <Plus size={14} aria-hidden="true" />
            Prepare one
          </button>
        }
      >
        {bundle.compensation.length === 0 ? (
          <EmptyState
            message="You haven't explored financial-support options yet."
            actionLabel="Prepare an application"
            onAction={() => setMode("prepare")}
          />
        ) : (
          <ul className="space-y-3">
            {bundle.compensation.map((a) => (
              <li key={a.id} className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-serif text-[1rem] text-[#3A2A1E]">
                    {a.applicationNumber || "Prepared, not yet submitted"}
                  </span>
                  <VerificationBadge verification={a.verification} />
                </div>
                <FactRow label="Status" value={RECOVERY_STATUS_LABELS[a.status]} />
                <FactRow label="Submitted on" value={formatDate(a.appliedOn)} />
                <FactRow label="Authority" value={a.authority} />
                <FactRow label="Next follow-up" value={formatDate(a.nextFollowUpOn)} />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openTracker(a)}
                    className="btn-ghost px-4 py-2 text-[0.8125rem]"
                  >
                    Update status
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="px-3 py-2 text-[0.8125rem] font-semibold text-[#7A6A5A] hover:text-[#8A3F20]"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};
