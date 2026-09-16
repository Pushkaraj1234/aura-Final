import React from "react";
import {
  ArrowRight,
  Banknote,
  BellRing,
  Download,
  FileText,
  Gavel,
  ListChecks,
  Scale,
  Trash2,
} from "lucide-react";
import {
  FactRow,
  SectionCard,
  VerificationBadge,
  formatDate,
} from "../../components/Recovery/RecoveryPrimitives";
import type { ChecklistSummary, NextStep, RecoveryDestination, RecoveryProgress } from "../../services/recoveryHub";
import type { RecoveryCaseBundle, RecoveryNotification } from "../../types/recovery";
import { RECOVERY_STATUS_LABELS, TIMELINE_STAGE_LABELS } from "../../types/recovery";

/**
 * My Recovery: the one screen a person lands on after their file exists.
 *
 * THE NEXT STEP IS THE POINT OF THE PAGE
 *
 * It sits above everything, alone, as a single action. Not a list of
 * outstanding items, because a list is the system handing its work back to the
 * person and asking them to plan it, which is precisely the failure mode this
 * feature exists to fix. The cards underneath are there for someone who wants
 * to look around; the next step is there for someone who has no idea what to
 * do and cannot face deciding.
 *
 * THE PROGRESS BAR MEASURES THE FILE, NOT THE CASE
 *
 * It rises as the person records things. It is not a prediction, it does not
 * move when a court does, and it never falls. A bar that tracked "how the case
 * is going" would be reading a court's behaviour off a form, and would drop on
 * a day nothing had actually gone wrong.
 */

interface Props {
  bundle: RecoveryCaseBundle;
  progress: RecoveryProgress;
  checklist: ChecklistSummary;
  step: NextStep;
  notifications: RecoveryNotification[];
  onGo: (destination: RecoveryDestination) => void;
  onDismissNotification: (id: string) => void;
  onExportCase: () => void;
  onDeleteCase: () => void;
}

export const RecoveryDashboard: React.FC<Props> = ({
  bundle,
  progress,
  checklist,
  step,
  notifications,
  onGo,
  onDismissNotification,
  onExportCase,
  onDeleteCase,
}) => {
  const { case: kase, fir, documents, legalAid, compensation } = bundle;
  const unread = notifications.filter((n) => !n.readAt);

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          My recovery
        </span>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
            {kase.displayName ? `Hello, ${kase.displayName}` : "Your recovery file"}
          </h1>
          {/* #6B5B4C, not the lighter grey used on cards: this one sits on the
              body gradient rather than on an opaque surface, where the
              lighter value measured 4.02:1 against 13px text. */}
          <span className="font-mono text-[0.8125rem] font-normal text-[#6B5B4C]">
            {kase.id}
          </span>
        </div>
        <p className="max-w-[58ch] text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          That is your Recovery Hub case ID, for finding this file again. It is
          not an FIR number or a government case number.
        </p>
      </header>

      {/* NEXT STEP -------------------------------------------------------- */}
      <section className="rounded-2xl border border-[#E6D3BC] bg-[#F3E7D8] p-5 sm:p-7">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Your next step
        </span>
        <h2 className="mt-2.5 font-serif text-[1.375rem] leading-[1.3] text-[#3A2A1E] sm:text-[1.5rem]">
          {step.title}
        </h2>
        {step.detail && (
          <p className="mt-2.5 max-w-[56ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
            {step.detail}
          </p>
        )}
        <button
          onClick={() => onGo(step.destination)}
          className="btn-primary mt-5 px-6 py-3.5 text-[0.9375rem]"
        >
          {step.actionLabel}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>

      {/* REMINDERS -------------------------------------------------------- */}
      {unread.length > 0 && (
        <section className="space-y-2.5">
          {unread.map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <BellRing size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#8A4A20]" />
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-[#3A2A1E]">{n.title}</p>
                  {n.body && (
                    <p className="mt-1 text-[0.875rem] leading-[1.6] text-[#6B5B4C]">{n.body}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDismissNotification(n.id)}
                className="shrink-0 min-h-[44px] px-2 text-[0.8125rem] font-semibold text-[#7A6A5A] hover:text-[#3A2A1E]"
              >
                Dismiss
              </button>
            </div>
          ))}
        </section>
      )}

      {/* PROGRESS --------------------------------------------------------- */}
      <SectionCard title="Recovery progress">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-[0.875rem] text-[#6B5B4C]">
            Currently at: {TIMELINE_STAGE_LABELS[progress.stage]}
          </span>
          <span className="text-[0.875rem] font-semibold text-[#8A4A20]">
            {progress.percent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How much of your recovery file is filled in"
          className="h-2 w-full overflow-hidden rounded-full bg-[#EDE2D4]"
        >
          <div
            className="h-full rounded-full bg-[#A85D2E] transition-[width] duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-3 text-[0.8125rem] leading-[1.6] text-[#7A6A5A]">
          This shows how much of your file you&rsquo;ve filled in. It is not a
          prediction about your case.
        </p>
        <button
          onClick={() => onGo("recovery_timeline")}
          className="btn-ghost mt-4 px-5 py-2.5 min-h-[44px] text-[0.875rem]"
        >
          View the full timeline
        </button>
      </SectionCard>

      {/* CARDS ------------------------------------------------------------ */}
      {/* items-start: without it the grid stretches every card to the
          tallest in the row, and the Documents card ended up a third
          full beside the FIR card. Let each one be its own height. */}
      <div className="grid gap-4 sm:grid-cols-2 items-start">
        <SectionCard
          title="FIR and case"
          action={fir ? <VerificationBadge verification={fir.verification} /> : undefined}
        >
          {fir?.hasFir ? (
            <>
              <FactRow label="FIR" value={fir.firNumber} />
              <FactRow label="Police station" value={fir.policeStation} />
              <FactRow label="District" value={fir.district} />
              <FactRow label="FIR date" value={formatDate(fir.firDate)} />
              <FactRow label="Last updated" value={formatDate(fir.updatedAt)} />
            </>
          ) : (
            <p className="text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
              {fir?.hasFir === false
                ? "You told us there isn't an FIR yet. We've set out how the process usually works."
                : "No FIR has been added yet."}
            </p>
          )}
          <button
            onClick={() => onGo("recovery_fir")}
            className="btn-ghost mt-4 px-5 py-2.5 min-h-[44px] text-[0.875rem]"
          >
            <Gavel size={15} aria-hidden="true" />
            {fir?.hasFir ? "Update FIR details" : "Add FIR"}
          </button>
        </SectionCard>

        <SectionCard title="Documents">
          <p className="text-[0.9375rem] text-[#3A2A1E]">
            <span className="font-semibold">
              {checklist.completed} of {checklist.total}
            </span>{" "}
            of the documents usually asked for
          </p>
          <p className="mt-1.5 text-[0.875rem] text-[#6B5B4C]">
            {documents.length === 0
              ? "Your document centre is empty."
              : `${documents.length} file${documents.length === 1 ? "" : "s"} saved.`}
          </p>
          <button
            onClick={() => onGo("recovery_documents")}
            className="btn-ghost mt-4 px-5 py-2.5 min-h-[44px] text-[0.875rem]"
          >
            <FileText size={15} aria-hidden="true" />
            Open document centre
          </button>
        </SectionCard>

        <SectionCard title="Legal aid">
          {legalAid.length === 0 ? (
            <p className="text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
              You haven&rsquo;t added a legal-aid application.
            </p>
          ) : (
            <>
              <FactRow
                label="Application"
                value={legalAid[0].applicationNumber || "No number added yet"}
              />
              <FactRow label="Status" value={RECOVERY_STATUS_LABELS[legalAid[0].status]} />
              <FactRow label="Next follow-up" value={formatDate(legalAid[0].nextFollowUpOn)} />
            </>
          )}
          <button
            onClick={() => onGo("recovery_legal_aid")}
            className="btn-ghost mt-4 px-5 py-2.5 min-h-[44px] text-[0.875rem]"
          >
            <Scale size={15} aria-hidden="true" />
            {legalAid.length === 0 ? "Explore legal aid" : "Open legal aid"}
          </button>
        </SectionCard>

        <SectionCard title="Financial support">
          {compensation.length === 0 ? (
            <p className="text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
              {kase.financialImpacts.length === 0
                ? "You haven't explored financial-support options yet."
                : "Nothing prepared yet. We can fill in most of an application from what you've told us."}
            </p>
          ) : (
            <>
              <FactRow
                label="Application"
                value={compensation[0].applicationNumber || "Prepared, not yet submitted"}
              />
              <FactRow label="Status" value={RECOVERY_STATUS_LABELS[compensation[0].status]} />
              <FactRow
                label="Next follow-up"
                value={formatDate(compensation[0].nextFollowUpOn)}
              />
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onGo("recovery_financial")}
              className="btn-ghost px-5 py-2.5 min-h-[44px] text-[0.875rem]"
            >
              <Banknote size={15} aria-hidden="true" />
              Explore support
            </button>
            <button
              onClick={() => onGo("recovery_compensation")}
              className="btn-ghost px-5 py-2.5 min-h-[44px] text-[0.875rem]"
            >
              <ListChecks size={15} aria-hidden="true" />
              Applications
            </button>
          </div>
        </SectionCard>
      </div>

      {/* §21: the person can take their file with them, and can delete it.
          Together, and in that order: being able to leave without losing what
          you recorded is what makes deletion a real choice rather than a
          threat. Neither is hidden behind a settings page. */}
      <section className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-5">
        <h2 className="text-[0.9375rem] font-semibold text-[#3A2A1E]">
          Your copy, and deleting this file
        </h2>
        <p className="mt-2 max-w-[62ch] text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          You can download everything you&rsquo;ve recorded here at any time.
          You can also remove this file and everything in it, including the
          documents you uploaded; that cannot be undone, and it does not affect
          anything else in your AURA account.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={onExportCase}
            className="btn-ghost min-h-[44px] px-4 py-2.5 text-[0.875rem]"
          >
            <Download size={15} aria-hidden="true" />
            Download my copy
          </button>
          <button
            onClick={onDeleteCase}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E4C3B4] bg-white px-4 py-2.5 text-[0.875rem] font-semibold text-[#8A3F20] transition-colors hover:bg-[#FBEFE9]"
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete my recovery file
          </button>
        </div>
      </section>
    </div>
  );
};
