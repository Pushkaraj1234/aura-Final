import React from "react";
import { AlertTriangle, Clock, Eye, CheckCircle2, ListChecks } from "lucide-react";
import { Escalation } from "../services/escalationEngine";
import { EngagementAssessment } from "../services/engagementSignals";

interface Props {
  escalation: Escalation;
  engagement: EngagementAssessment;
}

/**
 * The escalation recommendation, as a counsellor reads it.
 *
 * Written to be argued with. The headline states a window rather than a mood
 * — "contact within 24 hours" is actionable in a way "this person seems
 * stressed" is not — and directly under it sits every fact that produced it,
 * so a counsellor who knows something the system does not can dismiss it on
 * the spot instead of guessing what it noticed.
 *
 * Nothing here acts. It cannot message the participant and does not try:
 * reaching out to someone under threat at the wrong moment can itself be the
 * harm, so the decision stays with the person who knows the case.
 */
const STYLES: Record<
  Escalation["level"],
  { bg: string; border: string; text: string; badge: string; Icon: typeof AlertTriangle }
> = {
  urgent: {
    bg: "bg-[#A55D25]/10",
    border: "border-[#A55D25]/40",
    text: "text-[#A55D25]",
    badge: "bg-[#A55D25] text-white",
    Icon: AlertTriangle,
  },
  contact: {
    bg: "bg-[#D49B6A]/10",
    border: "border-[#D49B6A]/40",
    text: "text-[#B0713C]",
    badge: "bg-[#D49B6A] text-white",
    Icon: Clock,
  },
  watch: {
    bg: "bg-[#FDF9F5]",
    border: "border-[#EFE8E2]",
    text: "text-[#5A5049]",
    badge: "bg-[#DBC3B2]/40 text-[#5A5049]",
    Icon: Eye,
  },
  none: {
    bg: "bg-white",
    border: "border-[#EFE8E2]",
    text: "text-[#7F8C8D]",
    badge: "bg-[#EFE8E2] text-[#5A5049]",
    Icon: CheckCircle2,
  },
};

const BASIS_LABEL: Record<string, string> = {
  safety: "safety answers",
  engagement: "how they have been using the app",
  concordance: "self-report vs. other signals",
  distress: "questionnaire score",
  case: "hearings and incidents on their case",
};

export const EscalationCard: React.FC<Props> = ({ escalation, engagement }) => {
  const style = STYLES[escalation.level];
  const { Icon } = style;

  return (
    <div className={`rounded-3xl border p-6 sm:p-7 space-y-5 ${style.bg} ${style.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon size={20} className={`${style.text} shrink-0 mt-0.5`} />
          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7F8C8D] block">
              Passive monitoring
            </span>
            <h3 className={`text-lg sm:text-xl font-black leading-snug ${style.text}`}>
              {escalation.headline}
            </h3>
          </div>
        </div>
        {escalation.withinHours !== null && (
          <span
            className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${style.badge}`}
          >
            {escalation.withinHours}h
          </span>
        )}
      </div>

      {escalation.evidence.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#7F8C8D] flex items-center gap-1.5">
            <ListChecks size={12} />
            <span>What this is based on</span>
          </p>
          <ul className="space-y-1.5">
            {escalation.evidence.map((line, i) => (
              <li key={i} className="text-[13px] text-[#3C3530] leading-relaxed flex gap-2">
                <span className="text-[#A99A8A] shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-[#7A726C] leading-relaxed">
          Their check-in rhythm, messages and last answers are all within their own normal range.
        </p>
      )}

      {/* The measured facts, separate from the recommendation drawn from them,
          so a counsellor can read the numbers without reading the argument. */}
      {(engagement.daysSinceLastCheckIn !== null || engagement.baselineCadenceDays !== null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-[#EFE8E2]">
          {engagement.daysSinceLastCheckIn !== null && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A99A8A] block">
                Last check-in
              </span>
              <span className="text-sm font-black text-[#3C3530]">
                {engagement.daysSinceLastCheckIn === 0
                  ? "Today"
                  : `${engagement.daysSinceLastCheckIn}d ago`}
              </span>
            </div>
          )}
          {engagement.baselineCadenceDays !== null && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A99A8A] block">
                Their usual rhythm
              </span>
              <span className="text-sm font-black text-[#3C3530]">
                every {engagement.baselineCadenceDays.toFixed(0)}d
              </span>
            </div>
          )}
          {engagement.daysSinceAnyContact !== null && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A99A8A] block">
                Any contact
              </span>
              <span className="text-sm font-black text-[#3C3530]">
                {engagement.daysSinceAnyContact === 0
                  ? "Today"
                  : `${engagement.daysSinceAnyContact}d ago`}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-[#7F8C8D] leading-relaxed pt-1 border-t border-[#EFE8E2]">
        {escalation.basis.length > 0 && (
          <>
            Drawn from {escalation.basis.map((b) => BASIS_LABEL[b] || b).join(", ")}.{" "}
          </>
        )}
        This is a prompt for you to decide, not an instruction and not a clinical judgement. Nobody
        has been contacted. Reaching out at the wrong moment can carry its own risk, so that call
        is yours.
      </p>
    </div>
  );
};
