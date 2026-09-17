import React, { useMemo, useState } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  X,
  HeartHandshake,
  Check,
  Filter
} from "lucide-react";
import { Alert, Participant, AlertStatus, AlertCategory, User } from "../types";
import { participantStore } from "../services/participantStore";
import { ALERT_CONFIG } from "../services/alertConfig";

interface Props {
  alerts: Alert[];
  participants: Participant[];
  onSelectParticipant: (participantId: string) => void;
  onUpdateAlert: (alertId: string, decision: any, notes: string) => void;
  // Attributes the review decision to whoever is actually logged in, instead
  // of a hardcoded placeholder name.
  currentUser?: User | null;
}

export const AlertsPage: React.FC<Props> = ({
  alerts,
  participants,
  onSelectParticipant,
  onUpdateAlert,
  currentUser
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "priority" | "support_requests" | "all" | "reviewed">("pending");
  const [selectedAction, setSelectedAction] = useState<AlertStatus>("FOLLOW_UP_ASSIGNED");
  const [actionLabel, setActionLabel] = useState("Scheduled 1-on-1 counselor check-in");
  const [decisionNotes, setDecisionNotes] = useState("");
  const reviewerName = currentUser?.name || "Counselor";

  // Alerts only carry a participantId — look the real name up so this queue
  // shows a person's name instead of their anonymous case ID, matching
  // SupportDashboard's priority queue.
  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach(p => {
      if (p.name) map.set(p.id, p.name);
    });
    return map;
  }, [participants]);

  // Resolve a display name for an alert: prefer the name the data layer
  // attached, then the local participants list, then a short readable
  // reference (never a raw 36-char id).
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const nameFor = (alt: Alert) =>
    alt.participantName ||
    participantNameById.get(alt.participantId) ||
    (isUuid(alt.participantId) ? `Participant ${alt.participantId.slice(0, 8)}` : alt.participantId);

  // Action options mapping
  const actionOptions: { status: AlertStatus; label: string; actionText: string }[] = [
    {
      status: "FOLLOW_UP_ASSIGNED",
      label: "Assign Voluntary Follow-up",
      actionText: "Scheduled 1-on-1 voluntary counselor check-in"
    },
    {
      status: "IN_REVIEW",
      label: "Mark In Active Review",
      actionText: "Under clinical review and case assessment"
    },
    {
      status: "MONITORING",
      label: "Continue Monitoring",
      actionText: "Continued routine longitudinal monitoring"
    },
    {
      status: "RESOLVED",
      label: "Resolve & Close Alert",
      actionText: "Case resolved after support interaction"
    },
    {
      status: "SAFETY_ESCALATED",
      label: "Emergency Protocol Escalation",
      actionText: "Escalated to humanitarian safety emergency protocol"
    }
  ];

  const handleOpenActionModal = (alt: Alert) => {
    setSelectedAlert(alt);
    if (alt.severity === "urgent" || alt.category === "SAFETY_CONCERN") {
      setSelectedAction("SAFETY_ESCALATED");
      setActionLabel("Escalated to humanitarian safety emergency protocol");
    } else if (alt.category === "SUPPORT_REQUEST") {
      setSelectedAction("FOLLOW_UP_ASSIGNED");
      setActionLabel("Connected with requested support resources");
    } else {
      setSelectedAction("FOLLOW_UP_ASSIGNED");
      setActionLabel("Scheduled 1-on-1 voluntary counselor check-in");
    }
    setDecisionNotes("");
  };

  const handleConfirmDecision = () => {
    if (selectedAlert) {
      participantStore.updateAlertStatus(
        selectedAlert.id,
        selectedAction,
        decisionNotes || "Human review verified and action recorded.",
        actionLabel,
        reviewerName
      );
      setSelectedAlert(null);
      setDecisionNotes("");
    }
  };

  // Caseload scoping — a counselor sees alerts for participants assigned to
  // THEM, plus any alert for an UNASSIGNED participant (safety net so nothing
  // critical is invisible), plus alerts explicitly routed to them. The
  // participant's current counsellor is read from the alert itself
  // (participantAssignedWorker, resolved at the data layer), falling back to
  // the local participants list only when that isn't present.
  const assignedWorkerByParticipant = useMemo(() => {
    const m = new Map<string, string | undefined>();
    participants.forEach(p => m.set(p.id, p.assignedWorker));
    return m;
  }, [participants]);
  const isCounselor = currentUser?.role === "support_worker";
  const inMyScope = (alt: Alert): boolean => {
    if (!isCounselor || !currentUser) return true; // admins / non-counsellors: no scope
    const pw =
      alt.participantAssignedWorker !== undefined
        ? alt.participantAssignedWorker
        : assignedWorkerByParticipant.get(alt.participantId);
    return !pw || pw === currentUser.id || alt.assignedTo === currentUser.id;
  };

  const scopedAlerts = alerts.filter(inMyScope);

  // Filtered alerts
  const filteredAlerts = scopedAlerts.filter(alt => {
    const isPending = alt.status === "pending_review" || alt.status === "NEW" || alt.status === "escalated" || alt.status === "IN_REVIEW";
    if (activeTab === "pending") return isPending;
    if (activeTab === "priority") return (alt.severity === "urgent" || alt.category === "SAFETY_CONCERN") && isPending;
    if (activeTab === "support_requests") return alt.category === "SUPPORT_REQUEST" || alt.reason.toLowerCase().includes("support");
    if (activeTab === "reviewed") return alt.status === "reviewed" || alt.status === "RESOLVED" || alt.status === "FOLLOW_UP_ASSIGNED";
    return true; // "all"
  });

  const pendingCount = scopedAlerts.filter(a => a.status === "pending_review" || a.status === "NEW" || a.status === "escalated").length;
  const urgentCount = scopedAlerts.filter(a => a.severity === "urgent" || a.category === "SAFETY_CONCERN").length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-[#3C3530] text-white rounded-3xl p-6 sm:p-10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#3F4E4E]">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#A55D25]/20 text-[#A55D25] text-xs font-bold">
            <Bell size={13} />
            <span>Human-in-the-Loop Decision Support</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Alerts & Escalation Workflow
          </h1>
          <p className="text-[#EFE8E2]/90 text-xs sm:text-sm max-w-xl leading-relaxed">
            Every distress signal generated by AURA is a non-diagnostic assistive indicator. Trained counselors review context, verify factors, and determine compassionate next steps.
          </p>
          {isCounselor && (
            <p className="text-[10px] text-[#EFE8E2]/70">
              Showing alerts for your caseload and any unassigned participant.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#FDF9F5]/10 p-4 rounded-2xl border border-[#EFE8E2]/20 text-center">
            <div className="text-3xl font-black text-[#A55D25]">{urgentCount}</div>
            <span className="text-xs font-bold text-[#EFE8E2]/80">Priority Signals</span>
          </div>
          <div className="bg-[#FDF9F5]/10 p-4 rounded-2xl border border-[#EFE8E2]/20 text-center">
            <div className="text-3xl font-black text-[#D49B6A]">{pendingCount}</div>
            <span className="text-xs font-bold text-[#EFE8E2]/80">Pending Action</span>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#EFE8E2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "pending"
                ? "bg-[#3C3530] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#6B635C] hover:bg-[#EFE8E2]"
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("priority")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "priority"
                ? "bg-[#A55D25] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#A55D25] hover:bg-[#A55D25]/10"
            }`}
          >
            Priority Signals ({urgentCount})
          </button>
          <button
            onClick={() => setActiveTab("support_requests")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "support_requests"
                ? "bg-[#D49B6A] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#D49B6A] hover:bg-[#D49B6A]/10"
            }`}
          >
            Support Requests
          </button>
          <button
            onClick={() => setActiveTab("reviewed")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "reviewed"
                ? "bg-[#5A5049] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#5A5049] hover:bg-[#5A5049]/10"
            }`}
          >
            Review History
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#3C3530] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#6B635C] hover:bg-[#EFE8E2]"
            }`}
          >
            All Alerts ({scopedAlerts.length})
          </button>
        </div>
      </div>

      {/* Alerts Stream List */}
      <div className="space-y-4">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map(alt => {
            const isUrgent = alt.severity === "urgent" || alt.category === "SAFETY_CONCERN";
            const isElevated = alt.severity === "elevated" || alt.category === "HIGH" || alt.category === "PERSISTENT_INCREASE";
            const isReviewed = alt.status === "reviewed" || alt.status === "RESOLVED" || alt.status === "FOLLOW_UP_ASSIGNED";

            return (
              <div
                key={alt.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                  isUrgent
                    ? "bg-[#A55D25]/10 border-[#A55D25]/30 shadow-xs"
                    : isElevated
                    ? "bg-[#D49B6A]/10 border-[#D49B6A]/30 shadow-xs"
                    : "bg-white border-[#EFE8E2] hover:border-[#DBC3B2]"
                }`}
              >
                <div className="space-y-2.5 max-w-3xl">
                  {/* Category, ID, Score, Delta Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isUrgent
                          ? "bg-[#A55D25] text-white"
                          : isElevated
                          ? "bg-[#D49B6A] text-white"
                          : alt.category === "SUPPORT_REQUEST"
                          ? "bg-[#D49B6A]/20 text-[#D49B6A] border border-[#D49B6A]/30"
                          : "bg-[#DBC3B2]/30 text-[#5A5049]"
                      }`}
                    >
                      {alt.category ? alt.category.replace("_", " ") : `${alt.severity} Alert`}
                    </span>

                    <span className="font-bold text-xs text-[#3C3530] bg-white px-2 py-0.5 rounded-md border border-[#EFE8E2]">
                      {nameFor(alt)}
                    </span>

                    <span className="text-xs font-bold text-[#6B635C]">
                      Distress Indicator: <strong className="text-[#3C3530]">{alt.score}/100</strong>
                    </span>

                    {alt.changeDelta !== undefined && alt.changeDelta !== 0 && (
                      <span className={`text-xs font-bold flex items-center ${alt.changeDelta > 0 ? "text-[#A55D25]" : "text-[#5A5049]"}`}>
                        <TrendingUp size={12} className="mr-0.5" /> {alt.changeDelta > 0 ? `+${alt.changeDelta}` : alt.changeDelta} pts change
                      </span>
                    )}

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EFE8E2] text-[#5A5049]">
                      Status: {alt.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Reason / Explainability text */}
                  <p className="text-xs sm:text-sm font-semibold text-[#3C3530] leading-relaxed">
                    {alt.reason}
                  </p>

                  {/* XAI Contributing Factors Chips */}
                  {alt.contributingFactors && alt.contributingFactors.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-[#68625D]">Flagged Factors:</span>
                      {alt.contributingFactors.map((f, i) => (
                        <span key={i} className="text-[10px] bg-white border border-[#EFE8E2] px-2 py-0.5 rounded-md text-[#6B635C] font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer review metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#68625D]">
                    <span className="flex items-center">
                      <Clock size={12} className="mr-1" /> {new Date(alt.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span>•</span>
                    <span>Assigned: {alt.assignedTo || "Humanitarian Triage Queue"}</span>
                    {alt.reviewedBy && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-[#5A5049]">Reviewed by {alt.reviewedBy}</span>
                      </>
                    )}
                  </div>

                  {/* Decision notes if reviewed */}
                  {alt.decisionNotes && (
                    <div className="p-3 rounded-xl bg-white/80 border border-[#EFE8E2] text-xs text-[#6B635C] mt-2">
                      <strong className="text-[#3C3530] block text-[11px]">Human Review Decision Notes:</strong>
                      {alt.decisionNotes}
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0 md:self-center">
                  <button
                    onClick={() => onSelectParticipant(alt.participantId)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-[#EFE8E2] hover:bg-[#FDF9F5] text-[#3C3530] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Inspect Profile
                  </button>

                  <button
                    onClick={() => handleOpenActionModal(alt)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer ${
                      isReviewed
                        ? "bg-[#EFE8E2] text-[#3C3530] hover:bg-[#DBC3B2]/40"
                        : "bg-[#3C3530] hover:bg-[#3F4E4E] text-white"
                    }`}
                  >
                    <span>{isReviewed ? "Update Review" : "Take Action"}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#EFE8E2] space-y-3">
            <CheckCircle2 size={32} className="text-[#5A5049] mx-auto" />
            <h3 className="text-base font-bold text-[#3C3530]">Queue Clear</h3>
            <p className="text-xs text-[#68625D] max-w-sm mx-auto">
              No alerts matching the selected tab filter. All cases are currently triaged or in active monitoring.
            </p>
          </div>
        )}
      </div>

      {/* Human Decision Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3C3530]/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 border border-[#EFE8E2]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
                  Human-in-the-Loop Decision Action
                </span>
                <h3 className="text-2xl font-bold text-[#3C3530] mt-1">
                  Review Case: {nameFor(selectedAlert)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-2 rounded-xl text-[#68625D] hover:text-[#3C3530] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#6B635C] space-y-1">
              <strong className="block text-[#3C3530]">Signal Trigger & Factors:</strong>
              <p>{selectedAlert.reason}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider">
                Select Human Review Decision *
              </label>
              <div className="space-y-2">
                {actionOptions.map((opt) => (
                  <label
                    key={opt.status}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedAction === opt.status
                        ? "bg-[#3C3530] text-white border-[#3C3530]"
                        : "bg-[#FDF9F5] text-[#3C3530] border-[#EFE8E2] hover:bg-[#EFE8E2]"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="radio"
                        name="action_decision"
                        checked={selectedAction === opt.status}
                        onChange={() => {
                          setSelectedAction(opt.status);
                          setActionLabel(opt.actionText);
                        }}
                        className="hidden"
                      />
                      <span className="font-bold">{opt.label}</span>
                    </div>
                    <span className={`text-[10px] ${selectedAction === opt.status ? "text-[#DBC3B2]" : "text-[#68625D]"}`}>
                      {opt.actionText}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider">
                Reviewer / Counselor Notes
              </label>
              <textarea
                rows={3}
                placeholder="Document human context, clinical verification, communication record, or referral details..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-xs text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2.5 rounded-xl border border-[#EFE8E2] text-[#6B635C] font-bold text-xs hover:bg-[#FDF9F5] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                className="px-6 py-2.5 rounded-xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-colors cursor-pointer"
              >
                Save Decision & Update State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsible AI Disclaimer Footer */}
      <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-center space-y-1">
        <p className="text-[11px] text-[#68625D]">
          {ALERT_CONFIG.DISCLAIMER}
        </p>
      </div>
    </div>
  );
};
