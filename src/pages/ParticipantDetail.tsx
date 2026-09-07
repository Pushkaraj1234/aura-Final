import React, { useState } from "react";
import {
  ArrowLeft,
  Shield,
  Activity,
  Calendar,
  Clock,
  HeartHandshake,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Send,
  MessageSquare,
  User,
  ExternalLink,
  LifeBuoy,
  Sparkles,
  UserCheck,
  Trash2,
  FileDown
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Participant, SupportNote, User as AppUser } from "../types";
import { analyzeDistress } from "../services/riskEngine";
import { analyzeParticipantTrajectory, generateEarlyWarningForecast } from "../services/trajectoryEngine";
import { generateSupportRecommendation } from "../services/supportRecommendationEngine";
import { ExplainableAISignal } from "../components/ExplainableAISignal";
import { EarlyWarningForecastCard } from "../components/EarlyWarningForecastCard";
import { SuggestedSupportPlanCard } from "../components/SuggestedSupportPlanCard";
import { InterventionTimeline } from "../components/InterventionTimeline";
import { SignalStrengthVsHumanCard } from "../components/ResponsibleAIBadges";
import { AICaseSummaryCard } from "../components/AICaseSummaryCard";
import { PredictiveMLCard } from "../components/PredictiveMLCard";

interface Props {
  participant: Participant;
  onBack: () => void;
  onUpdateStatus: (participantId: string, newStatus: string) => void;
  onAddNote: (participantId: string, note: SupportNote) => void;
  onDeleteNote?: (participantId: string, noteId: string) => void;
  onOpenEmergency: () => void;
  onAssignWorker?: (participantId: string, workerName: string) => void;
  // Optional: only used to attribute case notes/overrides to whoever is
  // actually logged in. Falls back to a generic label rather than a made-up
  // name if this is ever rendered without a session (shouldn't happen in
  // practice — this page is only reachable by a signed-in counselor).
  currentUser?: AppUser | null;
}

export const ParticipantDetail: React.FC<Props> = ({
  participant,
  onBack,
  onUpdateStatus,
  onAddNote,
  onDeleteNote,
  onOpenEmergency,
  onAssignWorker,
  currentUser
}) => {
  const workerDisplayName = currentUser?.name || "Counselor";
  const [newNoteText, setNewNoteText] = useState("");
  const [actionCategory, setActionCategory] = useState("Voluntary counseling call");
  const [selectedDecision, setSelectedDecision] = useState(participant.status);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  // Human Override State
  const [overrideScore, setOverrideScore] = useState<number | "">("");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [isOverridden, setIsOverridden] = useState(false);
  const [activeScore, setActiveScore] = useState<number | null>(null);
  
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Direct worker -> admin/crisis-team escalation
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [escalateDone, setEscalateDone] = useState(false);

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      const { apiService } = await import("../services/apiService");
      const reason =
        escalateNote.trim() ||
        `${workerDisplayName} escalated ${participant.name || participant.id} for review beyond the assigned caseload.`;
      await apiService.alerts.create({
        id: `esc-${participant.id}-${Date.now()}`,
        participantId: participant.id,
        category: "SAFETY_CONCERN",
        severity: "RED",
        title: "Escalated by counselor",
        reason,
        description: `Manual escalation. Current distress indicator ${trajectory.currentScore}/100.`,
        recommendedAction: "Admin / crisis team to review and coordinate response.",
        status: "SAFETY_ESCALATED",
        score: trajectory.currentScore,
        assignedTo: currentUser?.id,
        requiresHumanReview: true,
      });
      await apiService.notifications.create({
        userId: "broadcast",
        participantId: participant.id,
        category: "SAFETY_CONCERN",
        filterCategory: "priority",
        severity: "RED",
        title: "Case escalated by a counselor",
        message: `${participant.name || participant.id} — ${reason}`,
        actionLabel: "Open profile",
        actionView: "detail",
        actionParticipantId: participant.id,
      });
      await apiService.auditLogs.create({
        actorId: currentUser?.id || "SW-unknown",
        actorRole: "SUPPORT_WORKER",
        actorName: workerDisplayName,
        action: "ESCALATED_TO_ADMIN",
        category: "SAFETY",
        participantId: participant.id,
        description: `${workerDisplayName} escalated ${participant.name || participant.id} to the admin / crisis team.`,
        severity: "HIGH",
        metadata: { reason },
      });
      onAddNote(participant.id, {
        id: `esc-note-${Date.now()}`,
        author: workerDisplayName,
        timestamp: new Date().toISOString(),
        text: `[Escalated to admin / crisis team] ${reason}`,
        actionTaken: "Escalation",
      });
      onUpdateStatus(participant.id, "Urgent safety signal");
      setEscalateDone(true);
      setEscalateOpen(false);
    } catch (e) {
      console.error("Escalation failed", e);
    } finally {
      setEscalating(false);
    }
  };


  // Initialize activeScore
  React.useEffect(() => {
    if (participant && !activeScore) {
      const trajectory = analyzeParticipantTrajectory(participant);
      setActiveScore(trajectory.currentScore);
    }
  }, [participant, activeScore]);

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAi(true);
    try {
      const { apiService } = await import('../services/apiService');
      const response = await apiService.ai.summarizeCase(participant.id);
      setAiSummary(response.summary);
    } catch (e: any) {
      console.error("AI Summary generation failed", e);
      setAiSummary("Failed to generate AI summary. Error: " + (e.message || "Unknown"));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const checkIns = participant?.checkIns || [];
  const latestCheckIn = checkIns.length > 0 ? checkIns[checkIns.length - 1] : null;
  const previousCheckIn = checkIns.length > 1 ? checkIns[checkIns.length - 2] : null;

  // Run explainable analysis & dynamic trajectory engine
  const riskAnalysis = latestCheckIn ? analyzeDistress(latestCheckIn, previousCheckIn) : null;
  const trajectory = analyzeParticipantTrajectory(participant);
  const forecast = generateEarlyWarningForecast(participant?.checkIns || [], trajectory);
  const supportPlan = generateSupportRecommendation(
    latestCheckIn,
    trajectory,
    (participant.checkIns || []).filter((c) => c.supportRequested).length,
    participant.preferredSupport
  );

  // Prepare chart data
  const trendData = checkIns.map((c, idx) => ({
    day: `Check-in ${idx + 1}`,
    score: c.calculatedScore || 0,
    stress: c.stress * 20,
    sleep: c.sleep * 20,
    date: new Date(c.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }));

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const note: SupportNote = {
      id: `n-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      author: workerDisplayName,
      timestamp: new Date().toISOString(),
      text: newNoteText.trim(),
      actionTaken: actionCategory
    };

    onAddNote(participant.id, note);
    setNewNoteText("");
  };

  const handleOverrideScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideScore === "" || !overrideRationale.trim()) return;
    
    // Log the override as an audit note
    const note: SupportNote = {
      id: `override-${Date.now()}`,
      author: workerDisplayName,
      timestamp: new Date().toISOString(),
      text: `[AI Score Overridden] Changed from ${trajectory.currentScore} to ${overrideScore}. Rationale: ${overrideRationale}`,
      actionTaken: "Clinical AI Override"
    };
    onAddNote(participant.id, note);
    
    // Update local state
    setActiveScore(Number(overrideScore));
    setIsOverridden(true);
    setOverrideScore("");
    setOverrideRationale("");
  };

  const handleStatusChange = (newStatus: string) => {
    setSelectedDecision(newStatus);
    onUpdateStatus(participant.id, newStatus);
  };

  // Printable referral / session-summary for handoff to a psychiatrist, NGO,
  // or a legal / human-rights body. Opens a formatted page and triggers the
  // browser's print dialog (print-to-PDF). No PII beyond what staff already see.
  const handleExportReferral = () => {
    const esc = (s: any) =>
      String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const ci = participant.checkIns || [];
    const recent = ci.slice(-6);
    const rows = recent
      .map(
        (c) => `<tr>
          <td>${esc(new Date(c.timestamp).toLocaleDateString())}</td>
          <td>${esc(c.calculatedScore ?? "—")}</td>
          <td>${esc(c.wellbeing)}/5</td>
          <td>${esc(c.stress)}/5</td>
          <td>${esc(c.sleep)}/5</td>
          <td>${esc(c.safety)}</td>
          <td>${esc(c.connection)}/5</td>
          <td>${c.supportRequested ? "Yes" : "—"}</td>
        </tr>`
      )
      .join("");
    const notes = (participant.notes || [])
      .slice(0, 12)
      .map(
        (n) =>
          `<li><strong>${esc(new Date(n.timestamp).toLocaleDateString())}</strong> — ${esc(n.text)}${
            n.actionTaken ? ` <em>(${esc(n.actionTaken)})</em>` : ""
          } <span class="muted">— ${esc(n.author)}</span></li>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>AURA referral summary — ${esc(
      participant.name || participant.id
    )}</title>
    <style>
      *{box-sizing:border-box} body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2b2622;margin:32px;max-width:720px}
      h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8a5a2b;margin:22px 0 6px;border-bottom:1px solid #e7ddd3;padding-bottom:4px}
      .meta{color:#6b625a;font-size:12px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:6px}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px} th,td{border:1px solid #e7ddd3;padding:5px 7px;text-align:left} th{background:#faf5ef}
      ul{margin:6px 0;padding-left:18px} .muted{color:#8a827a} .disclaimer{margin-top:26px;padding:10px 12px;background:#faf5ef;border:1px solid #e7ddd3;border-radius:8px;font-size:11px;color:#6b625a}
      @media print{body{margin:12mm}}
    </style></head><body>
      <h1>AURA — Referral / Session Summary</h1>
      <div class="meta">Generated ${esc(new Date().toLocaleString())} · Prepared by ${esc(workerDisplayName)}</div>

      <h2>Participant</h2>
      <div class="grid">
        <div><strong>Name</strong>: ${esc(participant.name || "—")}</div>
        <div><strong>Case ID</strong>: ${esc(participant.id)}</div>
        <div><strong>Language</strong>: ${esc(participant.language || "—")}</div>
        <div><strong>Age group</strong>: ${esc(participant.ageGroup || "—")}</div>
        <div><strong>Region</strong>: ${esc(participant.region || "—")}</div>
        <div><strong>Assigned worker</strong>: ${esc(participant.assignedWorker || "Unassigned")}</div>
        <div><strong>Current status</strong>: ${esc(participant.status)}</div>
        <div><strong>Support preference</strong>: ${esc(participant.preferredSupport || "—")}</div>
      </div>

      <h2>Current wellbeing signal (non-diagnostic)</h2>
      <div class="grid">
        <div><strong>Distress indicator</strong>: ${esc(trajectory.currentScore)}/100</div>
        <div><strong>Trajectory</strong>: ${esc(trajectory.classification || trajectory.category)}</div>
        <div><strong>Rate of change</strong>: ${esc(riskAnalysis?.change ?? "—")} pts</div>
        <div><strong>Requires human review</strong>: ${riskAnalysis?.requiresHumanReview ? "Yes" : "No"}</div>
      </div>
      <p class="muted">${esc(trajectory.summaryDescription || trajectory.summary || "")}</p>

      <h2>Recent check-ins</h2>
      <table><thead><tr><th>Date</th><th>Score</th><th>Wellbeing</th><th>Stress</th><th>Sleep</th><th>Safety</th><th>Connection</th><th>Support req.</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No check-ins recorded.</td></tr>'}</tbody></table>

      <h2>Counselor notes</h2>
      <ul>${notes || "<li>No notes recorded.</li>"}</ul>

      <div class="disclaimer">
        AURA produces AI-assisted, human-reviewed wellbeing indicators for humanitarian support prioritisation.
        <strong>These are not clinical diagnoses</strong> and must not be used as the sole basis for any clinical,
        legal, or protection decision. Prepared for authorised handoff at the participant's request or in their interest.
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      alert("Please allow pop-ups for this site to generate the referral summary.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const isUrgent = participant.status === "Urgent safety signal" || riskAnalysis?.level === "Urgent";

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="text-xs font-bold text-[#7F8C8D] hover:text-[#3C3530] transition-colors flex items-center space-x-1.5 self-start cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Case Hub</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportReferral}
            className="px-4 py-2 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] text-xs font-bold hover:bg-[#FDF9F5] transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <FileDown size={14} />
            <span>Referral summary</span>
          </button>
          {isUrgent && (
            <button
              onClick={onOpenEmergency}
              className="px-4 py-2 rounded-xl bg-[#A55D25] text-white text-xs font-bold hover:bg-[#A55D25]/90 transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <LifeBuoy size={14} />
              <span>Emergency Protocols</span>
            </button>
          )}
          <span className="text-xs font-mono font-bold text-[#7F8C8D]">
            Case ID: {participant.id}
          </span>
        </div>
      </div>

      {/* Participant Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Counselors see the participant's real name here; the
                anonymous case ID stays visible in the breadcrumb above and as
                a small reference line below, since it's still the unique
                identifier used everywhere else (notes, alerts, audit trail). */}
            <span className="text-2xl font-black text-[#3C3530]">{participant.name || participant.id}</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-xl ${
              isUrgent ? "bg-[#A55D25]/15 text-[#A55D25] border border-[#A55D25]/30" :
              participant.status === "Needs follow-up" ? "bg-[#D49B6A]/15 text-[#D49B6A] border border-[#D49B6A]/30" :
              participant.status === "Improving" ? "bg-[#DBC3B2]/25 text-[#5A5049]" :
              "bg-[#EFE8E2] text-[#7A726C]"
            }`}>
              {participant.status}
            </span>

            {/* Trajectory classification badge */}
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#5A5049]/10 text-[#5A5049] border border-[#5A5049]/20 flex items-center space-x-1">
              <span>Trajectory: {trajectory.classification}</span>
            </span>
          </div>

          {participant.name && (
            <p className="text-[11px] font-mono font-bold text-[#B9B0A6] tracking-wide">
              Case ID: {participant.id}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#7F8C8D] pt-1">
            <span>Language: <strong className="text-[#3C3530]">{participant.language}</strong></span>
            <span>Age Group: <strong className="text-[#3C3530]">{participant.ageGroup}</strong></span>
            <span>Support Preference: <strong className="text-[#3C3530]">{participant.preferredSupport}</strong></span>
            <span>Assigned: <strong className="text-[#3C3530]">{participant.assignedWorker || "Unassigned"}</strong></span>
          </div>
        </div>

        {/* Score & Change Stats */}
        <div className="flex items-center space-x-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-8 border-[#EFE8E2] shrink-0">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7F8C8D] block">
              Current Distress Indicator
            </span>
            {checkIns.length === 0 ? (
              <div className="text-xl font-black text-[#7F8C8D]">
                Not assessed
              </div>
            ) : (
              <div className="text-3xl font-black text-[#3C3530]">
                {trajectory.currentScore || (riskAnalysis?.score ?? 0)}
                <span className="text-sm font-semibold text-[#7F8C8D]">/100</span>
              </div>
            )}
          </div>

          <div className={`p-3 rounded-2xl ${
            checkIns.length === 0
              ? "bg-[#FDF9F5] text-[#7F8C8D] border border-[#EFE8E2]"
              : riskAnalysis && riskAnalysis.change > 0
              ? "bg-[#A55D25]/15 text-[#A55D25] border border-[#A55D25]/30"
              : riskAnalysis && riskAnalysis.change < 0
              ? "bg-[#DBC3B2]/20 text-[#5A5049] border border-[#DBC3B2]/40"
              : "bg-[#FDF9F5] text-[#7F8C8D] border border-[#EFE8E2]"
          }`}>
            <div className="text-xs font-bold flex items-center">
              {checkIns.length === 0 ? (
                <span>Awaiting Check-in</span>
              ) : checkIns.length === 1 ? (
                <span>Baseline (1st entry)</span>
              ) : riskAnalysis && riskAnalysis.change > 0 ? (
                <>
                  <TrendingUp size={14} className="mr-1" /> +{riskAnalysis.change} pts
                </>
              ) : riskAnalysis && riskAnalysis.change < 0 ? (
                <>
                  <TrendingDown size={14} className="mr-1" /> {riskAnalysis.change} pts
                </>
              ) : (
                <span>0 pts (Stable)</span>
              )}
            </div>
            <span className="text-[10px] block opacity-80 mt-0.5">Rate of Change</span>
          </div>
        </div>
      </div>

      {/* Signal Strength vs Human Review Mandate */}
      <SignalStrengthVsHumanCard
        signalText={trajectory.summaryDescription}
        score={trajectory.currentScore}
      />

      {/* Suggested Support Plan Card (Requirement #5) */}
      <SuggestedSupportPlanCard
        plan={supportPlan}
        participant={participant}
        participantId={participant?.id}
        onAssignWorker={onAssignWorker}
        onScheduleFollowUp={(pId, date, reason) => {
          const note: SupportNote = {
            id: `n-${Date.now()}`,
            author: workerDisplayName,
            timestamp: new Date().toISOString(),
            text: `Scheduled proactive follow-up for ${date}: ${reason}`,
            actionTaken: "Scheduled Follow-up"
          };
          onAddNote(pId, note);
        }}
      />

      {/* Main Analysis Grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left 7 Cols: Trajectory Graph + Explainable Factor Breakdown + Early Warning */}
        <div className="lg:col-span-7 space-y-8">
          {/* Trend Chart */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#3C3530]">Multi-Check-in Trend Trajectory</h3>
                <p className="text-xs text-[#7F8C8D]">Dynamic score calculation across consecutive voluntary reflections</p>
              </div>
              <span className="text-xs font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-2.5 py-1 rounded-lg">
                {checkIns.length} Entries
              </span>
            </div>

            {checkIns.length === 0 ? (
              <div className="py-12 px-6 rounded-2xl bg-[#FDF9F5] border border-dashed border-[#DBC3B2] text-center space-y-2">
                <span className="text-xs font-bold text-[#5A5049] uppercase tracking-wider block">
                  No Reflections Logged
                </span>
                <p className="text-sm font-bold text-[#3C3530]">
                  Participant has not submitted any check-ins yet.
                </p>
                <p className="text-xs text-[#7F8C8D] max-w-sm mx-auto">
                  Distress indicator signals and trend trajectories will appear here once reflections are recorded.
                </p>
              </div>
            ) : (
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5A5049" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#5A5049" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE8E2" vertical={false} />
                    <XAxis dataKey="date" stroke="#7F8C8D" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#7F8C8D" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#3C3530", border: "1px solid #3F4E4E", borderRadius: "1rem", color: "#fff", fontSize: "12px" }}
                      formatter={(val: number) => [`${val}/100`, "Distress Indicator"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#5A5049"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#detailGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Explainable AI (XAI) Signal Component (Requirement #4) */}
          <ExplainableAISignal
            factors={supportPlan?.contributingFactors}
            overallConfidence="High (92%)"
            summaryStatement={trajectory?.summaryDescription}
          />

          {/* Early-Warning Forecast Card (Requirement #3) */}
          <EarlyWarningForecastCard
            forecast={forecast}
            trajectory={trajectory}
            participantId={participant.id}
          />
        </div>

        {/* Right 5 Cols: Timeline & Human-in-the-Loop Case Management */}
        <div className="lg:col-span-5 space-y-8">
          {/* Phase 4: Predictive ML Card */}
          <PredictiveMLCard participantId={participant.id} />
          {/* AI Case Summary (Phase 3) */}
          <AICaseSummaryCard participantId={participant.id} />
          {/* Support and Outcome Timeline (Requirement #7) */}
          <InterventionTimeline
            participant={participant}
            trajectory={trajectory}
          />

          {/* Human Review Decision & Status Control */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
            <h3 className="text-base font-bold text-[#3C3530] flex items-center justify-between">
              <span>Human Review & Escalation</span>
              {isOverridden && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A55D25]/15 text-[#A55D25]">
                  AI Score Overridden
                </span>
              )}
            </h3>

            {/* Escalate to admin / crisis team — raises a platform-wide
                escalation the admin sees in their oversight feed. */}
            <div className="p-4 rounded-2xl bg-[#F7E7E4] border border-[#B0413E]/25 space-y-3">
              {escalateDone ? (
                <p className="text-xs font-bold text-[#B0413E] flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Escalated to the admin / crisis team. They can see this in the oversight feed.
                </p>
              ) : !escalateOpen ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#3C3530]">Escalate to admin / crisis team</p>
                    <p className="text-[11px] text-[#7A726C]">For a high-risk case that needs attention beyond this caseload.</p>
                  </div>
                  <button
                    onClick={() => setEscalateOpen(true)}
                    className="px-3 py-2 rounded-xl bg-[#B0413E] text-white text-xs font-bold hover:bg-[#963632] transition-colors cursor-pointer shrink-0"
                  >
                    Escalate
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Briefly, why does this need escalation? (optional)"
                    value={escalateNote}
                    onChange={(e) => setEscalateNote(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#B0413E]/25 bg-white text-xs text-[#3C3530] focus:ring-2 focus:ring-[#B0413E] focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEscalate}
                      disabled={escalating}
                      className="px-3 py-2 rounded-xl bg-[#B0413E] text-white text-xs font-bold hover:bg-[#963632] transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {escalating ? "Escalating…" : "Confirm escalation"}
                    </button>
                    <button
                      onClick={() => { setEscalateOpen(false); setEscalateNote(""); }}
                      className="px-2 py-2 text-xs font-bold text-[#7A726C] hover:text-[#3C3530] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Manual AI Override Form (Requirement #3) */}
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider flex items-center space-x-1.5">
                  <Activity size={14} />
                  <span>Clinical Risk Score Calibration</span>
                </label>
                <div className="flex items-center space-x-2 text-xs font-bold">
                  {isOverridden && (
                    <span className="line-through text-[#7F8C8D] opacity-60">AI: {trajectory.currentScore}</span>
                  )}
                  <span className={`text-[#A55D25] ${isOverridden ? 'text-sm' : ''}`}>Active: {activeScore || trajectory.currentScore}</span>
                </div>
              </div>
              <form onSubmit={handleOverrideScore} className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    placeholder="New Score (0-100)"
                    value={overrideScore}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setOverrideScore("");
                        return;
                      }
                      // The number input's min/max only affect the spinner
                      // arrows and native validation styling — a value can
                      // still be typed or pasted outside 0-100, so clamp it
                      // explicitly rather than trusting the HTML attributes.
                      const num = Number(raw);
                      if (Number.isNaN(num)) return;
                      setOverrideScore(Math.min(100, Math.max(0, Math.round(num))));
                    }}
                    className="w-1/3 p-2.5 rounded-xl border border-[#EFE8E2] bg-white text-xs text-[#3C3530] focus:ring-2 focus:ring-[#A55D25] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Clinical rationale for override..."
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    className="w-2/3 p-2.5 rounded-xl border border-[#EFE8E2] bg-white text-xs text-[#3C3530] focus:ring-2 focus:ring-[#A55D25] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={overrideScore === "" || !overrideRationale.trim()}
                  className="w-full px-4 py-2 rounded-xl bg-[#A55D25] text-white text-xs font-bold hover:bg-[#8F4F20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Shield size={12} />
                  <span>Override AI Score</span>
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider">
                Case Disposition Status
              </label>
              <select
                value={selectedDecision}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-xs font-bold text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none cursor-pointer"
              >
                <option value="Needs follow-up">Needs follow-up (Schedule Outreach)</option>
                <option value="Human review pending">Human review pending</option>
                <option value="Urgent safety signal">Urgent safety signal (Emergency Protocol)</option>
                <option value="Improving">Improving (Continue Observation)</option>
                <option value="Stable">Stable (Routine Monitoring)</option>
              </select>
            </div>

            {/* Notes Log */}
            <div className="space-y-3 pt-2 border-t border-[#EFE8E2]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7F8C8D] flex items-center justify-between">
                <span>Support Case Notes ({(participant?.notes || []).length})</span>
                <MessageSquare size={13} />
              </h4>

              <div className="space-y-2.5 max-h-48 overflow-y-auto">
                {(participant?.notes || []).length > 0 ? (
                  (participant.notes || []).map((n) => (
                    <div key={n.id} className="p-3 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-[#7F8C8D] font-bold">
                        <div className="flex space-x-2">
                          <span>{n.author}</span>
                          <span>{new Date(n.timestamp).toLocaleDateString()}</span>
                        </div>
                        {onDeleteNote && (
                          <button
                            onClick={() => setNoteToDelete(n.id)}
                            className="text-[#7F8C8D] hover:text-[#A55D25] transition-colors cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[#3C3530] font-medium">{n.text}</p>
                      {n.actionTaken && (
                        <span className="inline-block text-[10px] font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-2 py-0.5 rounded-md">
                          Action: {n.actionTaken}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#7F8C8D] italic">No notes recorded yet for this participant.</p>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2 pt-2">
                <textarea
                  rows={2}
                  placeholder="Record counseling conversation notes or actions..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-xs text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={actionCategory}
                    onChange={(e) => setActionCategory(e.target.value)}
                    className="p-2 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[11px] font-medium text-[#3C3530] cursor-pointer"
                  >
                    <option value="Voluntary counseling call">Voluntary counseling call</option>
                    <option value="In-person check-in">In-person check-in</option>
                    <option value="Grounding exercise provided">Grounding exercise provided</option>
                    <option value="Peer group referral">Peer group referral</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#3F4E4E] transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Send size={12} />
                    <span>Add Note</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Delete Note Confirm */}
      <ConfirmDialog
        isOpen={!!noteToDelete}
        title="Delete Support Note"
        message="Are you sure you want to delete this case note? This action cannot be undone and will be logged in the audit trail."
        confirmText="Delete Note"
        onConfirm={() => {
          if (noteToDelete && onDeleteNote) {
            onDeleteNote(participant.id, noteToDelete);
          }
          setNoteToDelete(null);
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
