import React, { useMemo } from "react";
import { Clock, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Alert } from "../types";
import { SLA_TARGETS, slaStatus, summariseSla } from "../services/slaEngine";

/**
 * Response-time clocks, on screen.
 *
 * slaEngine has existed for a while and nothing rendered it, which made it a
 * metric nobody could see and therefore a metric that changed nothing. This
 * is the breach view: overdue alerts, longest overdue first, with the promise
 * each one missed.
 *
 * Two things are kept deliberately blunt.
 *
 * `metRate` is null until at least one clock has finished, and renders as
 * "nothing judged yet" rather than as 100%. A fresh queue with no answered
 * alerts is not a perfect record, and a panel that opens on a green 100% is
 * one nobody looks at again.
 *
 * Breaches are listed individually rather than counted. "Four overdue" is a
 * statistic; four names with the number of hours each has been waiting is a
 * queue, and only the second one gets worked.
 */

interface Props {
  alerts: Alert[];
  onSelectParticipant?: (participantId: string) => void;
  onNavigateAlerts?: () => void;
}

const overdueLabel = (minutesRemaining: number): string => {
  const overdue = Math.abs(minutesRemaining);
  if (overdue < 60) return `${Math.round(overdue)} min overdue`;
  if (overdue < 60 * 48) return `${Math.round(overdue / 60)} h overdue`;
  return `${Math.round(overdue / (60 * 24))} days overdue`;
};

const bandLabel: Record<keyof typeof SLA_TARGETS, string> = {
  urgent: "within 1 hour",
  contact: "within 24 hours",
  watch: "within 7 days",
};

export const ResponseClockPanel: React.FC<Props> = ({
  alerts,
  onSelectParticipant,
  onNavigateAlerts,
}) => {
  const summary = useMemo(() => summariseSla(alerts), [alerts]);

  return (
    <section className="card-elev rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8A4A20]">
            <Clock size={13} aria-hidden="true" />
            Response times
          </span>
          <h2 className="font-serif text-2xl text-[#3A2A1E]">How quickly alerts get picked up</h2>
          <p className="text-[14px] text-[#6F5F4F] leading-relaxed max-w-2xl">
            The clock stops when someone opens the alert, not when the case closes. That is the
            part the team actually controls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#FAF7F4] px-5 py-4">
          <span className="text-[12px] text-[#6F5F4F] block">Answered in time</span>
          <span className="font-serif text-2xl text-[#3A2A1E]">
            {summary.metRate === null ? (
              <span className="text-base text-[#6F5F4F]">nothing judged yet</span>
            ) : (
              `${summary.metRate}%`
            )}
          </span>
        </div>
        <div className="rounded-2xl bg-[#FAF7F4] px-5 py-4">
          <span className="text-[12px] text-[#6F5F4F] block">Typical pick-up</span>
          <span className="font-serif text-2xl text-[#3A2A1E]">
            {summary.medianMinutesToAcknowledge === null ? (
              <span className="text-base text-[#6F5F4F]">no data</span>
            ) : summary.medianMinutesToAcknowledge < 60 ? (
              `${summary.medianMinutesToAcknowledge}m`
            ) : (
              `${Math.round(summary.medianMinutesToAcknowledge / 60)}h`
            )}
          </span>
        </div>
        <div className="rounded-2xl bg-[#FAF7F4] px-5 py-4">
          <span className="text-[12px] text-[#6F5F4F] block">Still waiting</span>
          <span className="font-serif text-2xl text-[#3A2A1E]">{summary.pending}</span>
        </div>
        <div
          className={`rounded-2xl px-5 py-4 ${
            summary.breached > 0 ? "bg-[#FBEDE7]" : "bg-[#FAF7F4]"
          }`}
        >
          <span className="text-[12px] text-[#6F5F4F] block">Overdue</span>
          <span
            className={`font-serif text-2xl ${
              summary.breached > 0 ? "text-[#9A3E1E]" : "text-[#3A2A1E]"
            }`}
          >
            {summary.breached}
          </span>
        </div>
      </div>

      {summary.breachedAlerts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-[#3A2A1E] flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#B3541E]" aria-hidden="true" />
            Waiting longest
          </h3>
          <ul className="space-y-2">
            {summary.breachedAlerts.slice(0, 6).map((alert) => {
              const status = slaStatus(alert);
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => onSelectParticipant?.(alert.participantId)}
                    disabled={!onSelectParticipant}
                    className="w-full text-left rounded-2xl border border-[#F0D9CE] bg-[#FDF6F2] px-5 py-4 hover:bg-[#FBEDE7] transition-colors disabled:cursor-default flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#3A2A1E] truncate">
                        {alert.participantName || alert.participantId}
                      </p>
                      <p className="text-[13px] text-[#6F5F4F] truncate">{alert.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold text-[#9A3E1E]">
                        {overdueLabel(status.minutesRemaining)}
                      </p>
                      <p className="text-[11px] text-[#6F5F4F]">
                        promised {bandLabel[status.band]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {summary.breachedAlerts.length > 6 && onNavigateAlerts && (
            <button
              onClick={onNavigateAlerts}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#A85D2E] hover:text-[#7E4420] transition-colors"
            >
              <span>{summary.breachedAlerts.length - 6} more overdue</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-[#F3F7F2] px-5 py-4">
          <CheckCircle2 size={16} className="text-[#4A7C59] shrink-0" aria-hidden="true" />
          <p className="text-[14px] text-[#5A5049]">
            {summary.total === 0
              ? "No alerts have been raised yet."
              : "Nothing is overdue right now."}
          </p>
        </div>
      )}

      <p className="text-[12px] text-[#6B635C] leading-relaxed pt-1 border-t border-[#EFE8E2]">
        Closed and still-waiting alerts are left out of the answered-in-time figure. Leaving an
        alert open, or resolving one without reading it, cannot improve the number.
      </p>
    </section>
  );
};
