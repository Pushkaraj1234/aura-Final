import React, { useState, useEffect, useMemo } from "react";
import {
  HeartHandshake,
  TrendingDown,
  TrendingUp,
  Minus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Search,
  UserCheck,
  Calendar,
  FileText,
  ShieldCheck
} from "lucide-react";
import { InterventionFollowUp, Participant, User } from "../types";
import { participantStore } from "../services/participantStore";

interface Props {
  participants: Participant[];
  onSelectParticipant: (id: string) => void;
  onOpenEmergency: () => void;
  // Used to scope the outcome list to the logged-in counselor's own caseload
  // instead of showing every counselor's interventions platform-wide.
  currentUser?: User | null;
}

export const FollowUps: React.FC<Props> = ({
  participants,
  onSelectParticipant,
  onOpenEmergency,
  currentUser
}) => {
  const [followUps, setFollowUps] = useState<InterventionFollowUp[]>(
    () => participantStore.getFollowUps()
  );
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline "record the outcome / close this follow-up" editor state, keyed by
  // the follow-up id currently being closed.
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordScore, setRecordScore] = useState("");
  const [recordNote, setRecordNote] = useState("");

  const OUTCOME_LABELS: Record<Exclude<InterventionFollowUp["outcome"], "pending">, string> = {
    improving: "Indicators improved after follow-up",
    no_change: "No significant change",
    worsening: "Worsening indicators observed",
  };

  const openRecorder = (fup: InterventionFollowUp) => {
    setRecordingId(fup.id);
    setRecordScore(fup.followUpScore != null ? String(fup.followUpScore) : "");
    setRecordNote("");
  };

  const recordOutcome = (
    fup: InterventionFollowUp,
    outcome: Exclude<InterventionFollowUp["outcome"], "pending">
  ) => {
    const scoreNum = recordScore.trim() === "" ? undefined : Math.max(0, Math.min(100, Number(recordScore)));
    const delta = scoreNum != null ? scoreNum - fup.originalScore : undefined;
    const closingNote = recordNote.trim()
      ? `${fup.notes ? fup.notes + ". " : ""}Closed by ${currentUser?.name || "counselor"}: ${recordNote.trim()}`
      : `${fup.notes ? fup.notes + ". " : ""}Follow-up closed by ${currentUser?.name || "counselor"}.`;

    participantStore.updateFollowUp(fup.id, {
      outcome,
      outcomeLabel: OUTCOME_LABELS[outcome],
      followUpScore: scoreNum,
      scoreDelta: delta,
      followUpDate: new Date().toISOString(),
      notes: closingNote,
    });

    // Reflect the result on the participant's case status so the dashboard
    // queue stays in sync: an improvement resolves the case, a worsening keeps
    // it open for another intervention.
    if (outcome === "improving") {
      participantStore.updateParticipantStatus(fup.participantId, "Improving");
    } else if (outcome === "no_change") {
      participantStore.updateParticipantStatus(fup.participantId, "Stable");
    }

    setRecordingId(null);
    setRecordScore("");
    setRecordNote("");
    setFollowUps(participantStore.getFollowUps());
  };

  // Follow-up records only carry a participantId — look the real name up so
  // this list shows a person's name instead of their anonymous case ID.
  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach(p => {
      if (p.name) map.set(p.id, p.name);
    });
    return map;
  }, [participants]);

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const nameFor = (id: string) =>
    participantNameById.get(id) || (isUuid(id) ? `Participant ${id.slice(0, 8)}` : id);

  useEffect(() => {
    const sync = () => setFollowUps(participantStore.getFollowUps());
    // Re-read shortly after mount in case a background backend sync lands.
    const t = setTimeout(sync, 800);
    window.addEventListener("aura_data_updated", sync);
    return () => {
      clearTimeout(t);
      window.removeEventListener("aura_data_updated", sync);
    };
  }, []);

  // Caseload scoping — a counselor only sees outcomes for participants assigned
  // to THEM (or interventions they personally ran). Admins / other roles keep
  // the full platform-wide view.
  const isCounselor = currentUser?.role === "support_worker";
  const myParticipantIds = useMemo(() => {
    const s = new Set<string>();
    if (isCounselor && currentUser) {
      participants.forEach(p => {
        if (p.assignedWorker && p.assignedWorker === currentUser.id) s.add(p.id);
      });
    }
    return s;
  }, [participants, isCounselor, currentUser]);

  const mineByName = (workerName: string): boolean => {
    if (!currentUser?.name) return false;
    const a = workerName.toLowerCase();
    const b = currentUser.name.toLowerCase();
    return a.includes(b) || b.includes(a);
  };

  const scopedFollowUps = useMemo(() => {
    if (!isCounselor || !currentUser) return followUps;
    return followUps.filter(
      f => myParticipantIds.has(f.participantId) || mineByName(f.workerName)
    );
  }, [followUps, isCounselor, currentUser, myParticipantIds]);

  const filtered = scopedFollowUps.filter(f => {
    const matchesOutcome = filterOutcome === "all" || f.outcome === filterOutcome;
    const matchesSearch =
      f.participantId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.interventionType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOutcome && matchesSearch;
  });

  const completed = scopedFollowUps.filter(f => f.outcome !== "pending");
  const improvedCount = completed.filter(f => f.outcome === "improving").length;
  const improvementRate = completed.length > 0 ? Math.round((improvedCount / completed.length) * 100) : 0;
  const pendingCount = scopedFollowUps.filter(f => f.outcome === "pending").length;
  const deltas = completed.map(f => f.scoreDelta).filter((d): d is number => typeof d === "number");
  const avgDelta = deltas.length > 0 ? Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 10) / 10 : null;

  const getOutcomeBadge = (outcome: InterventionFollowUp["outcome"]) => {
    switch (outcome) {
      case "improving":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "no_change":
        return "bg-[#FDF9F5] text-[#7A726C] border-[#EFE8E2]";
      case "worsening":
        return "bg-[#A55D25]/10 text-[#A55D25] border-[#A55D25]/30";
      case "pending":
        return "bg-[#D49B6A]/10 text-[#D49B6A] border-[#D49B6A]/30";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Outcome Measurement
            </span>
            <span className="text-xs text-[#7F8C8D] font-mono">
              Intervention Tracking System
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#3C3530] mt-1 tracking-tight">
            Intervention & Support Outcome Tracking
          </h1>
          <p className="text-sm text-[#7A726C] max-w-3xl mt-1 leading-relaxed">
            Measuring whether human care actually helps. AURA tracks post-intervention reflections to verify indicator recovery and optimize humanitarian resource allocation.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs font-bold text-[#7A726C]">
          <span>Prototype dataset</span>
        </div>
      </div>

      {/* Hero Outcome KPI Card */}
      <div className="bg-gradient-to-r from-[#3C3530] to-[#5A5049] rounded-3xl p-6 sm:p-8 text-white shadow-md">
        <div className="grid md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#DBC3B2]">
              Key Performance Indicator
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              {completed.length > 0
                ? `${improvementRate}% of completed follow-ups show improving wellbeing`
                : "No follow-ups completed yet"}
            </h2>
            <p className="text-xs text-[#EFE8E2]/80 leading-relaxed">
              {completed.length > 0 ? (
                <>
                  Based on {completed.length} closed follow-up{completed.length === 1 ? "" : "s"} in your view
                  {avgDelta != null && (
                    <>. Average change in wellbeing indicator: <strong>{avgDelta > 0 ? `+${avgDelta}` : avgDelta} points</strong></>
                  )}
                  .
                </>
              ) : (
                <>Assign a voluntary follow-up from an alert, then record its outcome here to build this measure.</>
              )}
            </p>
          </div>

          <div className="flex sm:justify-end">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center w-full sm:w-auto">
              <span className="text-[11px] font-bold text-[#DBC3B2] block uppercase">
                Active Interventions
              </span>
              <span className="text-3xl font-black text-white block mt-1">
                {scopedFollowUps.length}
              </span>
              <span className="text-[11px] text-[#EFE8E2]/70 mt-1 block">
                {improvedCount} Improving / {pendingCount} Pending
              </span>
            </div>
          </div>
        </div>

        {/* 6-Stage AURA Lifecycle Visual */}
        <div className="mt-6 pt-5 border-t border-white/15 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[650px] text-xs font-bold text-[#EFE8E2]">
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl">
              <span>Alert Triggered</span>
            </div>
            <span>→</span>
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl">
              <span>Human Review</span>
            </div>
            <span>→</span>
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl">
              <span>Support Intervention</span>
            </div>
            <span>→</span>
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl">
              <span>Follow-up Reflection</span>
            </div>
            <span>→</span>
            <div className="flex items-center space-x-1.5 bg-[#DBC3B2] text-[#3C3530] px-3 py-1.5 rounded-xl font-black">
              <span>Measured Outcome</span>
            </div>
          </div>
        </div>
      </div>

      {isCounselor && (
        <div className="flex items-center space-x-2 text-xs text-[#7A726C] bg-[#FDF9F5] border border-[#EFE8E2] rounded-xl px-3 py-2">
          <ShieldCheck size={14} className="text-[#5A5049] shrink-0" />
          <span>
            Showing outcomes for your assigned caseload and interventions you ran.
            Platform-wide outcome data is available to administrators.
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F8C8D]" />
          <input
            type="text"
            placeholder="Search participant ID, worker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#EFE8E2] text-xs focus:outline-none focus:border-[#5A5049]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: "All Outcomes" },
            { id: "improving", label: "Improving" },
            { id: "no_change", label: "No Change" },
            { id: "worsening", label: "Worsening" },
            { id: "pending", label: "Pending" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterOutcome(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                filterOutcome === tab.id
                  ? "bg-[#5A5049] text-white"
                  : "bg-white text-[#7A726C] border border-[#EFE8E2] hover:bg-[#FDF9F5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Follow-up Cases Grid */}
      <div className="grid gap-4">
        {filtered.length === 0 && (
          <div className="bg-white rounded-3xl border border-[#EFE8E2] p-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-center justify-center mx-auto text-[#7F8C8D]">
              <HeartHandshake size={22} />
            </div>
            <h4 className="text-sm font-bold text-[#3C3530]">No outcomes to show</h4>
            <p className="text-xs text-[#7F8C8D] max-w-sm mx-auto">
              {isCounselor
                ? "There are no recorded intervention outcomes for your caseload yet. New follow-ups appear here after you log an intervention."
                : "No intervention outcomes match the current filters."}
            </p>
          </div>
        )}
        {filtered.map(fup => (
          <div
            key={fup.id}
            className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs hover:border-[#DBC3B2] transition-all space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFE8E2] pb-3.5">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onSelectParticipant(fup.participantId)}
                  className="text-sm font-black text-[#3C3530] hover:text-[#5A5049] underline underline-offset-2 flex items-center space-x-1 cursor-pointer"
                >
                  <span>{nameFor(fup.participantId)}</span>
                  <ArrowRight size={14} />
                </button>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${getOutcomeBadge(fup.outcome)}`}>
                  {fup.outcomeLabel}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs text-[#7F8C8D]">
                <span className="flex items-center">
                  <UserCheck size={14} className="mr-1 text-[#5A5049]" />
                  {fup.workerName}
                </span>
                <span>•</span>
                <span>{new Date(fup.interventionDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Indicator Comparison Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
                <span className="text-[10px] font-bold text-[#7F8C8D] uppercase block mb-0.5">
                  Original Indicator
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-black text-[#3C3530]">{fup.originalScore}</span>
                  <span className="text-xs text-[#7F8C8D]">/100</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
                <span className="text-[10px] font-bold text-[#7F8C8D] uppercase block mb-0.5">
                  Follow-up Indicator
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-black text-[#3C3530]">
                    {fup.followUpScore !== undefined ? fup.followUpScore : "—"}
                  </span>
                  {fup.followUpScore !== undefined && <span className="text-xs text-[#7F8C8D]">/100</span>}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
                <span className="text-[10px] font-bold text-[#7F8C8D] uppercase block mb-0.5">
                  Indicator Change (Δ)
                </span>
                <div className="flex items-center space-x-1.5">
                  {fup.scoreDelta !== undefined ? (
                    <>
                      {fup.scoreDelta < 0 ? (
                        <TrendingDown size={20} className="text-emerald-600" />
                      ) : fup.scoreDelta > 0 ? (
                        <TrendingUp size={20} className="text-[#A55D25]" />
                      ) : (
                        <Minus size={20} className="text-[#7F8C8D]" />
                      )}
                      <span className={`text-2xl font-black ${
                        fup.scoreDelta < 0 ? "text-emerald-600" : fup.scoreDelta > 0 ? "text-[#A55D25]" : "text-[#3C3530]"
                      }`}>
                        {fup.scoreDelta > 0 ? `+${fup.scoreDelta}` : fup.scoreDelta} pts
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[#7F8C8D] italic">Pending reflection</span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
                <span className="text-[10px] font-bold text-[#7F8C8D] uppercase block mb-0.5">
                  Intervention Format
                </span>
                <p className="text-xs font-bold text-[#3C3530] line-clamp-2">
                  {fup.interventionType}
                </p>
              </div>
            </div>

            {/* Case Worker Clinical Summary */}
            <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#7A726C] flex items-start space-x-2">
              <FileText size={15} className="text-[#5A5049] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Worker Notes:</strong> {fup.notes}
              </p>
            </div>

            {/* Record the outcome / close this follow-up — only while it's still open */}
            {fup.outcome === "pending" && (
              <div className="pt-1">
                {recordingId === fup.id ? (
                  <div className="rounded-2xl border border-[#DBC3B2]/60 bg-white p-4 space-y-3">
                    <p className="text-xs font-bold text-[#3C3530]">
                      Record the follow-up outcome
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="text-[11px] font-semibold text-[#7A726C] flex items-center gap-2">
                        Follow-up indicator (optional)
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={recordScore}
                          onChange={(e) => setRecordScore(e.target.value)}
                          placeholder="0–100"
                          className="w-24 p-2 rounded-lg border border-[#EFE8E2] text-xs text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2]"
                        />
                      </label>
                      {recordScore.trim() !== "" && (
                        <span className="text-[11px] text-[#7F8C8D]">
                          Δ {Number(recordScore) - fup.originalScore > 0 ? "+" : ""}
                          {Number(recordScore) - fup.originalScore} pts vs. original {fup.originalScore}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={recordNote}
                      onChange={(e) => setRecordNote(e.target.value)}
                      rows={2}
                      placeholder="Closing note (optional): what happened, what's next"
                      className="w-full p-2.5 rounded-lg border border-[#EFE8E2] text-xs text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2] resize-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => recordOutcome(fup, "improving")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Improving, close
                      </button>
                      <button
                        onClick={() => recordOutcome(fup, "no_change")}
                        className="px-3 py-1.5 rounded-lg bg-[#5A5049] text-white text-[11px] font-bold hover:bg-[#3C3530] transition-colors cursor-pointer"
                      >
                        No change, close
                      </button>
                      <button
                        onClick={() => recordOutcome(fup, "worsening")}
                        className="px-3 py-1.5 rounded-lg bg-[#A55D25] text-white text-[11px] font-bold hover:bg-[#8B4D1F] transition-colors cursor-pointer"
                      >
                        Worsening, keep open
                      </button>
                      <button
                        onClick={() => setRecordingId(null)}
                        className="px-3 py-1.5 rounded-lg text-[#7A726C] hover:text-[#3C3530] text-[11px] font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openRecorder(fup)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#5A5049] transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Record outcome &amp; close</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
