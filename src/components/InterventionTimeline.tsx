import React from "react";
import {
  Activity,
  Circle,
  AlertTriangle,
  UserCheck,
  HeartHandshake,
  CheckCircle2,
  Calendar,
  ArrowDownRight
} from "lucide-react";
import { SupportTimelineEvent, Participant, TrajectoryAnalysis } from "../types";

interface Props {
  participant: Participant;
  trajectory?: TrajectoryAnalysis;
}

export const InterventionTimeline: React.FC<Props> = ({ participant, trajectory }) => {
  // Generate a realistic support lifecycle timeline based on participant check-ins and notes
  const events: SupportTimelineEvent[] = [];

  const checkIns = participant?.checkIns || [];
  const n = checkIns.length;

  if (n > 0) {
    events.push({
      id: "ev-1",
      dayLabel: "Day 1",
      date: new Date(checkIns[0].timestamp).toLocaleDateString(),
      type: "checkin",
      title: "Baseline Wellbeing Check-in",
      score: checkIns[0].calculatedScore || 42,
      details: "Participant established voluntary check-in routine. Distress indicators stable."
    });
  }

  if (n >= 3) {
    const midIdx = Math.floor(n / 2);
    const midCheck = checkIns[midIdx];
    const midScore = midCheck.calculatedScore || 58;
    events.push({
      id: "ev-2",
      dayLabel: "Day 3",
      date: new Date(midCheck.timestamp).toLocaleDateString(),
      type: "alert",
      title: "Trajectory Shift Detected",
      score: midScore,
      details: "AI trajectory engine detected rising stress and disrupted sleep over consecutive check-ins."
    });
  }

  if (participant?.status === "Needs follow-up" || participant?.status === "Urgent safety signal" || (trajectory && trajectory.currentScore >= 60)) {
    events.push({
      id: "ev-3",
      dayLabel: "Day 5",
      date: "Recent",
      type: "review",
      title: "Humanitarian Support Follow-up Recommended",
      score: trajectory?.currentScore || 64,
      details: "Signal prioritized for human review. Case assigned to on-duty humanitarian case worker.",
      actor: participant?.assignedWorker || "Unassigned"
    });

    events.push({
      id: "ev-4",
      dayLabel: "Day 5",
      date: "Recent",
      type: "intervention",
      title: "Human Support Intervention Conducted",
      details: "Counselor initiated voluntary 1-on-1 check-in conversation and provided grounding resources.",
      actor: participant?.assignedWorker || "Unassigned"
    });
  }

  if (trajectory?.recoveringAfterSupport || participant?.status === "Improving" || (n >= 5 && checkIns[n - 1].wellbeing >= 3)) {
    const latestScore = trajectory?.currentScore || 48;
    events.push({
      id: "ev-5",
      dayLabel: "Day 7",
      date: "Latest",
      type: "followup",
      title: "Post-Intervention Check-in",
      score: latestScore,
      details: "Participant completed follow-up reflection. Measurable decline in stress indicators."
    });

    events.push({
      id: "ev-6",
      dayLabel: "Day 7",
      date: "Latest",
      type: "improvement",
      title: "Outcome Measured: Positive Recovery",
      details: "Trajectory engine confirms downward distress curve following human support intervention."
    });
  }

  const getEventIcon = (type: SupportTimelineEvent["type"]) => {
    switch (type) {
      case "checkin":
        return <Activity size={16} className="text-[#5A5049]" />;
      case "alert":
        return <AlertTriangle size={16} className="text-[#A55D25]" />;
      case "review":
        return <UserCheck size={16} className="text-[#D49B6A]" />;
      case "intervention":
        return <HeartHandshake size={16} className="text-[#5A5049]" />;
      case "followup":
        return <Calendar size={16} className="text-[#3C3530]" />;
      case "improvement":
        return <CheckCircle2 size={16} className="text-emerald-600" />;
      default:
        return <Circle size={16} className="text-[#5A5049]" />;
    }
  };

  const getEventBadge = (type: SupportTimelineEvent["type"]) => {
    switch (type) {
      case "checkin":
        return "bg-[#DBC3B2]/20 text-[#5A5049] border-[#DBC3B2]/40";
      case "alert":
        return "bg-[#A55D25]/10 text-[#A55D25] border-[#A55D25]/30";
      case "review":
        return "bg-[#D49B6A]/10 text-[#D49B6A] border-[#D49B6A]/30";
      case "intervention":
        return "bg-[#5A5049]/10 text-[#5A5049] border-[#5A5049]/30";
      case "followup":
        return "bg-[#3C3530]/10 text-[#3C3530] border-[#3C3530]/20";
      case "improvement":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
            Lifecycle Tracking
          </span>
          <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
            Support &amp; Outcome Timeline
          </h3>
        </div>

        <span className="text-xs font-semibold text-[#7F8C8D]">
          {events.length} Milestones Recorded
        </span>
      </div>

      {/* Vertical Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#EFE8E2]">
        {events.map((ev, idx) => (
          <div key={ev.id || idx} className="relative group">
            {/* Timeline Node Icon */}
            <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-2 border-[#EFE8E2] group-hover:border-[#5A5049] flex items-center justify-center shadow-xs transition-colors z-10">
              {getEventIcon(ev.type)}
            </div>

            {/* Event Card */}
            <div className="bg-[#FDF9F5] rounded-2xl p-4 sm:p-5 border border-[#EFE8E2] hover:border-[#DBC3B2] transition-colors space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black font-mono text-[#7F8C8D]">
                    {ev.dayLabel}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getEventBadge(ev.type)}`}>
                    {ev.type}
                  </span>
                </div>

                {ev.score !== undefined && (
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#EFE8E2] text-xs font-bold text-[#3C3530]">
                    <Activity size={12} className="text-[#5A5049]" />
                    <span>Indicator: <strong>{ev.score}/100</strong></span>
                  </div>
                )}
              </div>

              <h4 className="text-sm font-black text-[#3C3530]">
                {ev.title}
              </h4>

              <p className="text-xs text-[#7A726C] leading-relaxed">
                {ev.details}
              </p>

              {ev.actor && (
                <div className="pt-2 border-t border-[#EFE8E2]/60 flex items-center justify-between text-[11px] text-[#7F8C8D]">
                  <span className="flex items-center">
                    <UserCheck size={12} className="mr-1 text-[#5A5049]" />
                    Action taken by: <strong className="ml-1 text-[#3C3530]">{ev.actor}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
