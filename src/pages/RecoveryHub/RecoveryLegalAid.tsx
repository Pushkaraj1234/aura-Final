import React, { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
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
import { resourcesByCategory } from "../../services/officialResources";
import type { LegalAidApplication, RecoveryStatus } from "../../types/recovery";
import { RECOVERY_STATUS_LABELS } from "../../types/recovery";

/**
 * Legal assistance.
 *
 * Free legal aid through the legal services authorities is the single most
 * useful thing on this page, and the one people most often do not know exists.
 * It is not means-tested for everyone: women and children are entitled to it
 * regardless of income under the Legal Services Authorities Act. Rather than
 * restate the rules here, where they would go stale and could be wrong for a
 * given person, the page links to NALSA's own page and says plainly that the
 * authority decides.
 *
 * AURA is not the authority, does not file the application, and does not know
 * the status. What it does is hold the diary number so somebody is not looking
 * for a scrap of paper the day they need it.
 */

const TRACKABLE: RecoveryStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFICATION_REQUIRED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

interface Props {
  applications: LegalAidApplication[];
  language: string;
  busy: boolean;
  error: string | null;
  onSave: (patch: Partial<LegalAidApplication> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

export const RecoveryLegalAidScreen: React.FC<Props> = ({
  applications,
  language,
  busy,
  error,
  onSave,
  onDelete,
  onBack,
}) => {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const current = applications.find((a) => a.id === editing);

  const [applicationNumber, setApplicationNumber] = useState("");
  const [appliedOn, setAppliedOn] = useState("");
  const [authority, setAuthority] = useState("");
  const [lawyerName, setLawyerName] = useState("");
  const [lawyerContact, setLawyerContact] = useState("");
  const [status, setStatus] = useState<RecoveryStatus[]>(["IN_PROGRESS"]);
  const [nextFollowUpOn, setNextFollowUpOn] = useState("");
  const [notes, setNotes] = useState("");

  const openEditor = (app?: LegalAidApplication) => {
    setApplicationNumber(app?.applicationNumber || "");
    setAppliedOn(app?.appliedOn || "");
    setAuthority(app?.authority || "");
    setLawyerName(app?.lawyerName || "");
    setLawyerContact(app?.lawyerContact || "");
    setStatus([app?.status || "IN_PROGRESS"]);
    setNextFollowUpOn(app?.nextFollowUpOn || "");
    setNotes(app?.notes || "");
    setEditing(app ? app.id : "new");
  };

  const resources = resourcesByCategory("legal_aid");

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Legal assistance
        </span>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          Getting a lawyer
        </h2>
        <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
          You may be able to access legal assistance through legal services
          authorities. It is free, it runs from the lowest court up to the
          Supreme Court, and many people who qualify never find out they do.
        </p>
      </header>

      <section className="space-y-3">
        <OfficialSiteNotice />
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((r) => (
            <OfficialLink key={r.key} resource={r} language={language} />
          ))}
        </div>
        <p className="text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          Whether you qualify is decided by the legal services authority, not by
          AURA. Their page explains the rules, and applying costs nothing.
        </p>
      </section>

      <SectionCard
        title="Your applications"
        action={
          editing === null && (
            <button
              onClick={() => openEditor()}
              className="btn-ghost px-4 py-2.5 text-[0.8125rem]"
            >
              <Plus size={14} aria-hidden="true" />
              Add
            </button>
          )
        }
      >
        {applications.length === 0 && editing === null && (
          <EmptyState
            message="You haven't added a legal-aid application."
            actionLabel="Add an application"
            onAction={() => openEditor()}
          />
        )}

        {applications.length > 0 && (
          <ul className="space-y-3">
            {applications.map((a) => (
              <li key={a.id} className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-serif text-[1rem] text-[#3A2A1E]">
                    {a.applicationNumber || "No application number yet"}
                  </span>
                  <VerificationBadge verification={a.verification} />
                </div>
                <FactRow label="Status" value={RECOVERY_STATUS_LABELS[a.status]} />
                <FactRow label="Applied on" value={formatDate(a.appliedOn)} />
                <FactRow label="Authority" value={a.authority} />
                <FactRow label="Lawyer" value={a.lawyerName} />
                <FactRow label="Next follow-up" value={formatDate(a.nextFollowUpOn)} />
                {a.notes && (
                  <p className="mt-3 text-[0.875rem] leading-[1.6] text-[#6B5B4C]">{a.notes}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEditor(a)}
                    className="btn-ghost px-4 py-2 text-[0.8125rem]"
                  >
                    Update
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

        {editing !== null && (
          <div className="mt-5 space-y-5 border-t border-[#F1E7DA] pt-5">
            <h4 className="text-[0.9375rem] font-semibold text-[#3A2A1E]">
              {current ? "Update this application" : "Add an application"}
            </h4>

            <TextField
              label="Application number"
              hint="The diary number you were given when you applied. It is what tracking asks for."
              value={applicationNumber}
              onChange={setApplicationNumber}
              optional
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Applied on"
                type="date"
                value={appliedOn}
                onChange={setAppliedOn}
                optional
              />
              <TextField
                label="Which authority"
                placeholder="District Legal Services Authority"
                value={authority}
                onChange={setAuthority}
                optional
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Lawyer's name"
                value={lawyerName}
                onChange={setLawyerName}
                optional
              />
              <TextField
                label="Lawyer's contact"
                value={lawyerContact}
                onChange={setLawyerContact}
                optional
              />
            </div>

            <ChoiceList<RecoveryStatus>
              legend="Where has it got to?"
              hint="As you understand it. AURA has no connection to the legal services system, so this is your own note."
              choices={TRACKABLE.map((s) => ({ value: s, label: RECOVERY_STATUS_LABELS[s] }))}
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
                label={current ? "Save changes" : "Add application"}
                onSave={async () => {
                  await onSave({
                    id: current?.id,
                    applicationNumber: applicationNumber.trim() || undefined,
                    appliedOn: appliedOn || undefined,
                    authority: authority.trim() || undefined,
                    lawyerName: lawyerName.trim() || undefined,
                    lawyerContact: lawyerContact.trim() || undefined,
                    status: status[0],
                    nextFollowUpOn: nextFollowUpOn || undefined,
                    notes: notes.trim() || undefined,
                  });
                  setEditing(null);
                }}
              />
              <button
                onClick={() => setEditing(null)}
                className="btn-ghost px-5 py-3 text-[0.9375rem]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};
