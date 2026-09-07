import React, { useState } from "react";
import {
  HeartHandshake,
  CalendarPlus,
  CheckCircle2,
  BookOpen,
  Users,
  Sparkles,
  ShieldCheck,
  Check,
  UserCheck,
  Info
} from "lucide-react";
import { SupportRecommendation, Participant } from "../types";

interface Props {
  recommendation?: SupportRecommendation | null;
  plan?: SupportRecommendation | null;
  participant?: Participant | null;
  participantId?: string;
  onAssignWorker?: (idOrName: string, name?: string) => void;
  onCreateFollowUp?: (type: string, focus: string) => void;
  onScheduleFollowUp?: (participantId: string, date: string, reason: string) => void;
}

export const SuggestedSupportPlanCard: React.FC<Props> = ({
  recommendation,
  plan,
  participant,
  participantId,
  onCreateFollowUp,
  onScheduleFollowUp
}) => {
  // Support either 'recommendation' or 'plan' prop
  const activePlan = recommendation || plan || null;
  // Read-only here. Assigning / reassigning a counselor is an administrator
  // action (Admin -> User Assignments); a counselor who needs a case moved
  // uses "Escalate to admin" instead.
  const assigned = participant?.assignedWorker || "";

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpType, setFollowUpType] = useState("Support conversation");
  const [followUpFocus, setFollowUpFocus] = useState(
    activePlan?.conversationFocus || "General wellbeing check-in and grounding"
  );
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]
  );
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleConfirmFollowUp = () => {
    if (onScheduleFollowUp && (participant?.id || participantId)) {
      onScheduleFollowUp(participant?.id || participantId || "", followUpDate, `${followUpType}: ${followUpFocus}`);
    } else if (onCreateFollowUp) {
      onCreateFollowUp(followUpType, followUpFocus);
    }
    setShowFollowUpModal(false);
    setActionSuccess(`Intervention follow-up scheduled for ${followUpDate}: "${followUpType}".`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFE8E2] pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-[#DBC3B2]/30 text-[#5A5049] flex items-center justify-center">
            <HeartHandshake size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Decision Support
            </span>
            <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
              Suggested Support Plan
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {assigned ? (
            <span className="text-xs font-bold text-[#5A5049] px-3 py-1 rounded-xl bg-[#DBC3B2]/20 border border-[#DBC3B2]/40 flex items-center">
              <CheckCircle2 size={14} className="mr-1.5" />
              Assigned counselor on file
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#7F8C8D] px-3 py-1 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-center">
              <Info size={13} className="mr-1.5 text-[#7F8C8D]" />
              No counselor assigned
            </span>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-[#DBC3B2]/20 border border-[#5A5049]/30 text-xs font-bold text-[#5A5049] flex items-center space-x-2">
          <Check size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Plan Details Grid or Empty State */}
      {activePlan ? (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Primary Consideration & Suggested Focus */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
              <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
                Primary Consideration
              </span>
              <p className="text-sm font-black text-[#3C3530]">
                {activePlan.primaryRecommendation || "Continue voluntary routine monitoring."}
              </p>
              {activePlan.rationale && (
                <p className="text-xs text-[#7A726C] mt-1.5 leading-relaxed">
                  <strong>Rationale:</strong> {activePlan.rationale}
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
              <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
                Suggested Conversation Focus
              </span>
              <p className="text-xs font-bold text-[#5A5049] leading-relaxed">
                "{activePlan.conversationFocus || "General wellbeing check-in and grounding"}"
              </p>
            </div>
          </div>

          {/* Recommended Resources */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-2">
                Optional Support Resources
              </span>
              {activePlan.resources && activePlan.resources.length > 0 ? (
                <ul className="space-y-2">
                  {activePlan.resources.map((res, i) => (
                    <li key={i} className="flex items-start space-x-2 text-xs text-[#3C3530]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5A5049] mt-1.5 shrink-0"></span>
                      <span>{res}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#7F8C8D] italic">
                  Standard grounding and voluntary counseling resources available.
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#EFE8E2] text-[11px] text-[#7F8C8D]">
              Voluntary participant resources — not clinical prescriptions.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-center space-y-2">
          <p className="text-xs font-bold text-[#3C3530]">
            No support plan has been generated yet.
          </p>
          <p className="text-[11px] text-[#7F8C8D]">
            A suggested plan will be created automatically once check-in reflections or human review signals are received.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFollowUpModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-[#5A5049] hover:bg-[#3C3530] text-white text-xs font-bold transition-colors flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <CalendarPlus size={15} />
            <span>Create Follow-up</span>
          </button>
        </div>

        <span className="text-[11px] text-[#7F8C8D] italic">
          The counselor makes the final decision on all actions. Assignment changes are made by an administrator.
        </span>
      </div>

      {/* Create Follow-Up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h4 className="text-lg font-black text-[#3C3530]">
              Create Intervention Follow-up
            </h4>
            <p className="text-xs text-[#7A726C]">
              Log a planned human intervention to measure subsequent changes in distress indicators.
            </p>
            <div>
              <label className="text-xs font-bold text-[#3C3530] block mb-1">
                Intervention Type
              </label>
              <select
                value={followUpType}
                onChange={(e) => setFollowUpType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#EFE8E2] text-sm focus:outline-none focus:border-[#5A5049]"
              >
                <option value="Support conversation">Support conversation</option>
                <option value="Resource referral">Resource referral & guidance</option>
                <option value="Safety check & grounding">Safety check & grounding</option>
                <option value="Peer community connection">Peer community connection</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#3C3530] block mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#EFE8E2] text-sm focus:outline-none focus:border-[#5A5049]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#3C3530] block mb-1">
                Conversation Focus
              </label>
              <input
                type="text"
                value={followUpFocus}
                onChange={(e) => setFollowUpFocus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#EFE8E2] text-sm focus:outline-none focus:border-[#5A5049]"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#7F8C8D] hover:bg-[#FDF9F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFollowUp}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#5A5049] text-white hover:bg-[#3C3530]"
              >
                Schedule Follow-up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
