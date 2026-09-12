import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Heart,
  Moon,
  Users,
  Activity,
  ArrowRight,
  LifeBuoy,
  UserCheck,
  HelpCircle,
  Clock,
  Compass,
  FileText,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { CheckInAnalysis, CheckIn, User, Recommendation, Participant } from "../types";
import { ALERT_CONFIG } from "../services/alertConfig";
import { ScoreFormulaCard } from "../components/ScoreFormulaCard";
import { explainFactorPercentages } from "../services/recommendationEngine";
import { RecommendationActionModal } from "../components/RecommendationActionModal";
import { apiService } from "../services/apiService";
import { notificationService } from "../services/notificationService";

interface Props {
  analysis: CheckInAnalysis;
  user: User;
  checkIn: CheckIn;
  /**
   * The participant's record, which is what says whether anyone is actually
   * assigned to them. This screen used to not receive it, which is precisely
   * how it ended up confirming a request to a counsellor who did not exist.
   */
  participantRecord: Participant | null;
  onNavigate: (view: string) => void;
  onOpenEmergency: () => void;
}

export const CheckInResults: React.FC<Props> = ({
  analysis,
  user,
  checkIn,
  participantRecord,
  onNavigate,
  onOpenEmergency
}) => {
  // 1-2 second loading animation sequence for demo and authentic UX
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [supportRequestedConfirmed, setSupportRequestedConfirmed] = useState(false);
  const [requestingSupport, setRequestingSupport] = useState(false);
  const [supportError, setSupportError] = useState("");
  const assignedWorker = participantRecord?.assignedWorker || null;
  // Which recommendation's action panel is open, if any.
  const [openAction, setOpenAction] = useState<Recommendation | null>(null);

  /**
   * Actually asks for a counsellor, rather than only looking as though it did.
   *
   * This button previously set a piece of local state and nothing else: no
   * message, no notification, nothing persisted. It reported "Request Received"
   * to every participant, including those with nobody assigned to receive it,
   * and the claim vanished on refresh. It now sends the same message and raises
   * the same notification as the request flow in the profile page, and is only
   * offered when there is a counsellor to send it to.
   */
  const handleRequestSupport = async () => {
    if (!participantRecord?.id || !assignedWorker) return;
    setRequestingSupport(true);
    setSupportError("");
    try {
      // send() resolves to null on failure rather than throwing, so a bare
      // await would "succeed" for a message that never left the browser —
      // which is the same false confirmation this screen is being fixed for.
      const sent = await apiService.messages.send({
        participantId: participantRecord.id,
        senderId: user.id,
        senderRole: "participant",
        body: "I'd like to talk to a counsellor — sent from my check-in results.",
      });
      if (!sent) {
        setSupportError(
          "We could not send that just now. Please check your connection and try again, or use Messages."
        );
        return;
      }
      notificationService.createNotification({
        userId: assignedWorker,
        participantId: participantRecord.id,
        category: "SUPPORT_REQUEST",
        severity: "YELLOW",
        title: "Support requested",
        message: `${user.name || "A participant"} asked to talk after completing a check-in.`,
      });
      setSupportRequestedConfirmed(true);
    } catch (err: any) {
      // Say so, rather than showing a confirmation for something that failed.
      setSupportError(
        err?.message || "We could not send that just now. Please try again, or use Messages."
      );
    } finally {
      setRequestingSupport(false);
    }
  };

  useEffect(() => {
    const timer1 = setTimeout(() => setLoadingStage(1), 500);
    const timer2 = setTimeout(() => setLoadingStage(2), 1100);
    const timer3 = setTimeout(() => setLoadingStage(3), 1700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Visual Level styling
  const getLevelColor = (level: string) => {
    switch (level) {
      case "VERY_HIGH":
        return {
          bg: "bg-[#A55D25]/15",
          border: "border-[#A55D25]/40",
          text: "text-[#A55D25]",
          badge: "bg-[#A55D25] text-white",
          gauge: "stroke-[#A55D25]"
        };
      case "HIGH":
        return {
          bg: "bg-[#D49B6A]/15",
          border: "border-[#D49B6A]/40",
          text: "text-[#D49B6A]",
          badge: "bg-[#D49B6A] text-white",
          gauge: "stroke-[#D49B6A]"
        };
      case "ELEVATED":
        return {
          bg: "bg-[#D49B6A]/10",
          border: "border-[#D49B6A]/30",
          text: "text-[#D49B6A]",
          badge: "bg-[#D49B6A]/20 text-[#D49B6A]",
          gauge: "stroke-[#D49B6A]"
        };
      case "MODERATE":
        return {
          bg: "bg-[#DBC3B2]/20",
          border: "border-[#DBC3B2]/50",
          text: "text-[#5A5049]",
          badge: "bg-[#DBC3B2]/30 text-[#3C3530]",
          gauge: "stroke-[#5A5049]"
        };
      case "MILD":
        return {
          bg: "bg-[#EFE8E2]",
          border: "border-[#DBC3B2]/40",
          text: "text-[#5A5049]",
          badge: "bg-[#5A5049]/15 text-[#5A5049]",
          gauge: "stroke-[#5A5049]"
        };
      default:
        return {
          bg: "bg-[#5A5049]/10",
          border: "border-[#5A5049]/30",
          text: "text-[#5A5049]",
          badge: "bg-[#5A5049] text-white",
          gauge: "stroke-[#5A5049]"
        };
    }
  };

  const style = getLevelColor(analysis.level);

  // The rule behind each bar, with this participant's rating substituted.
  // Shown under each bar because "55%" on its own invites being read as a
  // share of the score, which it is not — every factor has its own band.
  const factorFormula = explainFactorPercentages(checkIn);

  // Loading Screen Animation
  if (loadingStage < 3) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center space-y-8 animate-in fade-in duration-300">
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-[#EFE8E2] border-t-[#5A5049] animate-spin" />
        </div>

        <div className="space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] bg-[#DBC3B2]/20 px-3 py-1 rounded-full">
            AURA Prototype Analysis Engine
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
            {loadingStage === 0 && "Reviewing your responses..."}
            {loadingStage === 1 && "Identifying wellbeing patterns..."}
            {loadingStage === 2 && "Preparing your personalized summary..."}
          </h2>
          <p className="text-xs sm:text-sm text-[#7F8C8D] max-w-md mx-auto">
            Processing voluntary self-reflection data to generate transparent, non-clinical wellbeing signals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
      {/* Top Header Card */}
      <div className="bg-[#3C3530] text-white rounded-3xl p-6 sm:p-10 shadow-xs border border-[#3F4E4E] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2] text-xs font-bold">
            <CheckCircle2 size={14} className="text-[#DBC3B2]" />
            <span>Check-in Complete ✓</span>
          </div>

          <span className="text-xs text-[#EFE8E2]/70 font-mono">
            ID: {analysis.participantId} • {new Date(analysis.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Your Wellbeing Analysis
          </h1>
          <p className="text-[#EFE8E2]/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Thank you for completing your check-in. Here is a summary of what your responses suggest. This is a non-clinical assistive signal to support your personal reflection and proactive human connection.
          </p>
        </div>
      </div>

      {/* Primary Score & Gauge Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-[#EFE8E2]">
          {/* Circular Visual Gauge */}
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#EFE8E2"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={style.gauge}
                strokeWidth="8"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * analysis.distressScore) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl sm:text-4xl font-black text-[#3C3530]">
                {analysis.distressScore}
              </span>
              <span className="text-[10px] font-bold text-[#7F8C8D]">out of 100</span>
            </div>
          </div>

          {/* Level & Trend Narrative */}
          <div className="space-y-3 text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${style.badge}`}>
                {analysis.levelLabel}
              </span>
              {analysis.requiresHumanReview && (
                <span className="text-xs font-bold text-[#D49B6A] bg-[#D49B6A]/15 px-3 py-1 rounded-full border border-[#D49B6A]/30">
                  Priority Human Review Recommended
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-[#3C3530]">
              {analysis.level === "LOW" && "Your current reported distress indicator is calm."}
              {analysis.level === "MILD" && "Your current reported distress indicator is in the mild monitoring range."}
              {analysis.level === "MODERATE" && "Your current reported distress indicator is moderate."}
              {analysis.level === "ELEVATED" && "Your current reported distress indicator is elevated."}
              {analysis.level === "HIGH" && "Your current reported distress indicator is high."}
              {analysis.level === "VERY_HIGH" && "High-priority wellbeing signal recorded."}
            </h3>

            <p className="text-xs sm:text-sm text-[#7A726C] leading-relaxed">
              Higher scores indicate higher reported distress in this prototype. This signal is dynamically calculated from your voluntary questionnaire responses.
            </p>

            {/* Historical Comparison Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <div className="bg-[#FDF9F5] px-3 py-1.5 rounded-xl border border-[#EFE8E2] text-xs">
                <span className="text-[#7F8C8D]">Previous: </span>
                <strong className="text-[#3C3530]">
                  {analysis.previousScore !== undefined ? `${analysis.previousScore}` : "Baseline"}
                </strong>
              </div>

              <div className="bg-[#FDF9F5] px-3 py-1.5 rounded-xl border border-[#EFE8E2] text-xs">
                <span className="text-[#7F8C8D]">Current: </span>
                <strong className="text-[#3C3530]">{analysis.distressScore}</strong>
              </div>

              {analysis.change !== undefined && (
                <div className="bg-[#FDF9F5] px-3 py-1.5 rounded-xl border border-[#EFE8E2] text-xs flex items-center space-x-1">
                  <span className="text-[#7F8C8D]">Change: </span>
                  <strong className={`font-bold flex items-center ${analysis.change > 0 ? "text-[#A55D25]" : analysis.change < 0 ? "text-[#5A5049]" : "text-[#7F8C8D]"}`}>
                    {analysis.change > 0 ? (
                      <>
                        <TrendingUp size={12} className="mr-0.5" /> +{analysis.change}
                      </>
                    ) : analysis.change < 0 ? (
                      <>
                        <TrendingDown size={12} className="mr-0.5" /> {analysis.change}
                      </>
                    ) : (
                      <>
                        <Minus size={12} className="mr-0.5" /> 0
                      </>
                    )}
                  </strong>
                </div>
              )}

              <div className="bg-[#FDF9F5] px-3 py-1.5 rounded-xl border border-[#EFE8E2] text-xs">
                <span className="text-[#7F8C8D]">Trend: </span>
                <strong className="text-[#3C3530]">
                  {analysis.trend === "RAPID_INCREASE" && "↑ Rapid Increase"}
                  {analysis.trend === "INCREASING" && "↑ Increasing"}
                  {analysis.trend === "IMPROVING" && "↓ Improving"}
                  {analysis.trend === "STABLE" && "→ Stable"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Contributing Factors & Response Patterns */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-[#3C3530] flex items-center space-x-2">
              <Activity size={18} className="text-[#5A5049]" />
              <span>What contributed to this signal?</span>
            </h4>
            <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider">
              Reported Areas of Concern
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Stress Factor */}
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#3C3530] flex items-center space-x-1.5">
                  <Activity size={14} className="text-[#D49B6A]" />
                  <span>Reported Stress Level</span>
                </span>
                <span className="text-[#3C3530]">{analysis.factorPercentages.stress}%</span>
              </div>
              <div className="w-full bg-[#EFE8E2] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#D49B6A] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${analysis.factorPercentages.stress}%` }}
                />
              </div>
              <span className="text-[10px] text-[#7F8C8D] block">
                Questionnaire rating: {analysis.factors.stress}/5
              </span>
              <span className="text-[10px] font-mono text-[#A99A8A] block leading-snug">
                {factorFormula.stress} = {analysis.factorPercentages.stress}%
              </span>
            </div>

            {/* Sleep Factor */}
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#3C3530] flex items-center space-x-1.5">
                  <Moon size={14} className="text-[#5A5049]" />
                  <span>Sleep & Rest Quality</span>
                </span>
                <span className="text-[#3C3530]">{analysis.factorPercentages.sleep}%</span>
              </div>
              <div className="w-full bg-[#EFE8E2] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#5A5049] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${analysis.factorPercentages.sleep}%` }}
                />
              </div>
              <span className="text-[10px] text-[#7F8C8D] block">
                Restfulness rating: {analysis.factors.sleep}/5
              </span>
              <span className="text-[10px] font-mono text-[#A99A8A] block leading-snug">
                {factorFormula.sleep} = {analysis.factorPercentages.sleep}%
              </span>
            </div>

            {/* Emotional Wellbeing */}
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#3C3530] flex items-center space-x-1.5">
                  <Heart size={14} className="text-[#A55D25]" />
                  <span>Emotional Wellbeing</span>
                </span>
                <span className="text-[#3C3530]">{analysis.factorPercentages.emotionalWellbeing}%</span>
              </div>
              <div className="w-full bg-[#EFE8E2] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#A55D25] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${analysis.factorPercentages.emotionalWellbeing}%` }}
                />
              </div>
              <span className="text-[10px] text-[#7F8C8D] block">
                Day rating: {analysis.factors.mood}/5
              </span>
              <span className="text-[10px] font-mono text-[#A99A8A] block leading-snug">
                {factorFormula.emotionalWellbeing} = {analysis.factorPercentages.emotionalWellbeing}%
              </span>
            </div>

            {/* Social Connection */}
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#3C3530] flex items-center space-x-1.5">
                  <Users size={14} className="text-[#7F8C8D]" />
                  <span>Social Connection</span>
                </span>
                <span className="text-[#3C3530]">{analysis.factorPercentages.socialConnection}%</span>
              </div>
              <div className="w-full bg-[#EFE8E2] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#7F8C8D] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${analysis.factorPercentages.socialConnection}%` }}
                />
              </div>
              <span className="text-[10px] text-[#7F8C8D] block">
                Peer support rating: {analysis.factors.socialConnection}/5
              </span>
              <span className="text-[10px] font-mono text-[#A99A8A] block leading-snug">
                {factorFormula.socialConnection} = {analysis.factorPercentages.socialConnection}%
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#7F8C8D] text-center italic">
            Note: These percentages represent voluntary self-reported response patterns and are not clinical or medical measurements.
          </p>

          {/* The arithmetic behind the score, drawn straight from the scoring
              function so it always matches the number shown above. */}
          <ScoreFormulaCard
            checkIn={checkIn}
            displayedScore={analysis.distressScore}
            aiAdjustment={analysis.aiAdjustment ?? 0}
            aiConsulted={analysis.aiConsulted ?? false}
            aiClamped={analysis.aiClamped ?? false}
            aiEvidenceChars={analysis.aiEvidenceChars}
            aiAdjustmentCap={analysis.aiAdjustmentCap}
          />
        </div>
      </div>

      {/* Explainable AI (Why did AURA generate this result?) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-xl font-bold text-[#3C3530]">
            Why did AURA generate this result?
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-[#3C3530] font-medium leading-relaxed bg-[#FDF9F5] p-4 rounded-2xl border border-[#EFE8E2]">
          "{analysis.explanation}"
        </p>

        {analysis.explanationPoints && analysis.explanationPoints.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wider block">
              Key Contributing Highlights:
            </span>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {analysis.explanationPoints.map((pt, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-2 p-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#7A726C]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A5049] mt-1.5 shrink-0" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[#7F8C8D]">
          AURA uses your voluntary responses to identify broad wellbeing patterns. It does not access external private data or make clinical diagnoses.
        </p>
      </div>

      {/* Primary Action Card: "What you can do now" */}
      <div className="bg-[#DBC3B2]/20 border-2 border-[#5A5049]/30 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center space-x-2">
          <Compass className="text-[#5A5049]" size={22} />
          <h3 className="text-xl font-black text-[#3C3530]">
            What you can do now
          </h3>
        </div>

        <p className="text-sm sm:text-base font-bold text-[#3C3530] leading-relaxed">
          {analysis.primaryAction}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {assignedWorker ? (
            <button
              onClick={handleRequestSupport}
              disabled={requestingSupport || supportRequestedConfirmed}
              className="px-5 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-all flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-default"
            >
              <UserCheck size={15} />
              <span>
                {supportRequestedConfirmed
                  ? "✓ Request Sent"
                  : requestingSupport
                    ? "Sending…"
                    : "Talk to a Counselor"}
              </span>
            </button>
          ) : (
            /* Nobody is assigned, so there is no one to receive a request.
               Offer the thing that actually helps instead of a confirmation. */
            <button
              onClick={() => onNavigate("choose_counsellor")}
              className="px-5 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
            >
              <UserCheck size={15} />
              <span>Choose a Counselor</span>
            </button>
          )}

          <button
            onClick={() => onNavigate("participant_home")}
            className="px-5 py-3 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] font-bold text-xs hover:bg-[#FDF9F5] transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Clock size={15} />
            <span>View My Trajectory</span>
          </button>

          {analysis.isExplicitSafetyConcern && (
            <button
              onClick={onOpenEmergency}
              className="px-5 py-3 rounded-xl bg-[#A55D25] text-white font-bold text-xs hover:bg-[#A55D25]/90 transition-all flex items-center space-x-2 cursor-pointer shadow-xs"
            >
              <LifeBuoy size={15} />
              <span>Immediate Emergency Help</span>
            </button>
          )}
        </div>

        {supportError && (
          <div className="p-3 rounded-xl bg-[#A65D52]/10 border border-[#A65D52]/30 text-xs text-[#8A463C] font-medium">
            {supportError}
          </div>
        )}

        {supportRequestedConfirmed && assignedWorker && (
          <div className="p-3 rounded-xl bg-[#5A5049]/15 border border-[#5A5049]/30 text-xs text-[#3C3530] font-medium animate-in fade-in">
            ✓ Your counsellor has been told you'd like to talk. They'll reply in Messages to
            arrange a time.
          </div>
        )}

        {!assignedWorker && (
          <div className="p-3 rounded-xl bg-[#DBC3B2]/30 border border-[#DBC3B2]/60 text-xs text-[#3C3530] font-medium">
            You don't have a counsellor yet, so there's nobody to arrange a conversation. You can
            pick one yourself — it takes a minute and you can change your mind later.
          </div>
        )}
      </div>

      {/* Personalized Recommendations List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
            Tailored Suggestions
          </span>
          <h3 className="text-xl font-bold text-[#3C3530]">
            Personalized Recommendations
          </h3>
          <p className="text-xs text-[#7F8C8D]">
            Prioritized suggestions based on your specific stress, sleep, connection, and wellbeing responses.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {analysis.recommendations.map((rec, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3 flex flex-col justify-between hover:border-[#DBC3B2] transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-[#EFE8E2] text-[#7A726C]">
                    {rec.category.replace("_", " ")}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rec.priority === "HIGH"
                        ? "bg-[#A55D25]/20 text-[#A55D25]"
                        : rec.priority === "MEDIUM"
                        ? "bg-[#D49B6A]/20 text-[#D49B6A]"
                        : "bg-[#DBC3B2]/20 text-[#5A5049]"
                    }`}
                  >
                    {rec.priority} Priority
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#3C3530]">
                  {rec.title}
                </h4>

                <p className="text-xs text-[#7A726C] leading-relaxed">
                  {rec.description}
                </p>
              </div>

              {rec.actionLabel && (
                <div className="pt-2 border-t border-[#EFE8E2]/60">
                  <button
                    type="button"
                    onClick={() => setOpenAction(rec)}
                    className="w-full text-left text-xs font-bold text-[#5A5049] hover:text-[#3C3530] flex items-center space-x-1 group cursor-pointer"
                  >
                    <span>{rec.actionLabel}</span>
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AURA's Supportive Reflection */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <Heart className="text-[#A55D25]" size={20} />
          <h3 className="text-xl font-bold text-[#3C3530]">
            AURA's Supportive Reflection
          </h3>
        </div>

        <div className="p-5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs sm:text-sm text-[#3C3530] leading-relaxed italic space-y-2">
          <p>"{analysis.supportiveMessage}"</p>
          <span className="block text-[11px] text-[#7F8C8D] not-italic">
            — AURA Non-Clinical Support Assistant
          </span>
        </div>

        <p className="text-[11px] text-[#7F8C8D]">
          This is compassionate non-clinical emotional support, not psychotherapy. AURA does not diagnose or make medical promises.
        </p>
      </div>

      {/* AI Transparency & Prototype Disclaimer */}
      <div className="bg-[#FDF9F5] p-6 rounded-3xl border border-[#EFE8E2] space-y-3">
        <div className="flex items-center space-x-2">
          <Shield className="text-[#5A5049]" size={18} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5049]">
            About this Result & Ethics
          </h4>
        </div>
        <p className="text-xs text-[#7A726C] leading-relaxed">
          AURA analyzes your voluntary check-in responses to identify broad patterns in reported wellbeing and distress. This result is intended to support conversations and early human follow-up. It is not a diagnosis or replacement for professional care.
        </p>
        <p className="text-[11px] text-[#7F8C8D]">
          {ALERT_CONFIG.THRESHOLD_DISCLAIMER}
        </p>
      </div>

      {/* Bottom Navigation Buttons */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("participant_home")}
          className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border border-[#EFE8E2] text-[#3C3530] font-bold text-xs hover:bg-[#FDF9F5] transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
        >
          <Clock size={16} />
          <span>View My Trajectory</span>
        </button>

        <button
          onClick={() => onNavigate("participant_home")}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
        >
          <span>Return to Dashboard</span>
          <ArrowRight size={16} />
        </button>
      </div>
      <RecommendationActionModal
        recommendation={openAction}
        onClose={() => setOpenAction(null)}
        onNavigate={onNavigate}
        onOpenEmergency={onOpenEmergency}
      />
    </div>
  );
};
