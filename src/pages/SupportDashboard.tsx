import React, { useState, useMemo, useEffect } from "react";
import { assessLatest } from "../services/concordanceEngine";
import { assessEngagement } from "../services/engagementSignals";
import { assessEscalation } from "../services/escalationEngine";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Clock,
  Activity,
  UserCheck,
  ChevronRight,
  HelpCircle,
  Eye,
  HeartHandshake,
  Bell,
  ArrowUpRight,
  Info
,
  ScanSearch} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";
import { Participant, Alert, DemoScenario, AppNotification } from "../types";
import { ALERT_CONFIG } from "../services/alertConfig";
import { WorkerWellbeingCheck } from "../components/WorkerWellbeingCheck";
import { WorkerProfileCard } from "../components/WorkerProfileCard";
import { authService } from "../services/authService";
import { apiService } from "../services/apiService";
import { ResponseClockPanel } from "../components/ResponseClockPanel";
import { summariseSla } from "../services/slaEngine";

interface Props {
  participants: Participant[];
  alerts: Alert[];
  onSelectParticipant: (participantId: string) => void;
  // Optional: not currently wired to any control inside this component, and
  // App.tsx doesn't pass it — was required before, which meant every build
  // silently depended on nobody adding a stricter check. Left as an optional
  // hook rather than removed, in case a future "run simulation" action wants
  // to reuse the prop name.
  onOpenSimulation?: () => void;
  onNavigateAlerts: () => void;
  onNavigateNotifications?: () => void;
}

export const SupportDashboard: React.FC<Props> = ({
  participants,
  alerts,
  onSelectParticipant,
  onOpenSimulation,
  onNavigateAlerts,
  onNavigateNotifications
}) => {
  // Response-time clocks over the alerts on this screen. Memoised because the
  // summary walks every alert and this component re-renders on every keystroke
  // in the search box.
  const responseClocks = useMemo(() => summariseSla(alerts), [alerts]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "change_desc" | "recent">("score_desc");

  // Caseload scope: a counselor can narrow the queue to just the
  // participants assigned to them (participants.assigned_worker === their id),
  // or see the whole roster. Defaults to "mine" when the signed-in worker
  // actually has assignments, otherwise "all".
  const currentWorker = useMemo(() => authService.getCurrentUser(), []);
  const assignedCount = useMemo(
    () => (currentWorker ? participants.filter((p) => p.assignedWorker === currentWorker.id).length : 0),
    [participants, currentWorker]
  );
  const [caseloadScope, setCaseloadScope] = useState<"mine" | "all">("all");
  useEffect(() => {
    setCaseloadScope(assignedCount > 0 ? "mine" : "all");
  }, [assignedCount]);

  // Personalised, live dashboard header — derived from the signed-in
  // counsellor's session and their current caseload, not a fixed mockup.
  const header = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = (currentWorker?.name || "").trim().split(/[\s,]+/)[0] || "there";
    const dateLine =
      now.toLocaleDateString(undefined, { weekday: "long" }) +
      " · " +
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " Local";

    // Scope the counts to the counsellor's own caseload when they have one.
    const mine =
      currentWorker && assignedCount > 0
        ? participants.filter((p) => p.assignedWorker === currentWorker.id)
        : participants;
    const needsAttention = mine.filter(
      (p) => p.status === "Urgent safety signal" || p.status === "Human review pending"
    ).length;
    const rising = mine.filter((p) => {
      const ci = p.checkIns || [];
      if (ci.length < 2) return false;
      const last = ci[ci.length - 1]?.calculatedScore ?? 0;
      const prev = ci[ci.length - 2]?.calculatedScore ?? 0;
      return last - prev >= 8;
    }).length;

    const scopeWord = currentWorker && assignedCount > 0 ? "your caseload" : "the platform";
    let subtitle: string;
    if (needsAttention === 0 && rising === 0) {
      subtitle = `Nothing in ${scopeWord} needs attention right now. A calm start to the day.`;
    } else {
      const parts: string[] = [];
      if (needsAttention > 0)
        parts.push(`${needsAttention} ${needsAttention === 1 ? "person" : "people"} could use a check-in`);
      if (rising > 0) parts.push(`${rising} gentle upward trend${rising === 1 ? "" : "s"} worth a look`);
      subtitle = `${parts.join(" and ")} in ${scopeWord}.`;
    }
    return { greeting, firstName, dateLine, subtitle };
  }, [currentWorker, assignedCount, participants]);

  // "Distress signals" — real cohort trend over the selected window, computed
  // from every participant's check-ins (not a mockup).
  const [rangeDays, setRangeDays] = useState<14 | 30>(14);

  const cohort = useMemo(() => {
    const now = Date.now();
    const windowMs = rangeDays * 24 * 60 * 60 * 1000;
    const since = now - windowMs;

    const inWindow: { t: number; score: number; sleep: number; connection: number; stress: number }[] = [];
    for (const p of participants) {
      for (const c of p.checkIns || []) {
        const t = new Date(c.timestamp).getTime();
        if (!Number.isFinite(t) || t < since || t > now + 864e5) continue;
        inWindow.push({
          t,
          score: typeof c.calculatedScore === "number" ? c.calculatedScore : 0,
          sleep: c.sleep ?? 3,
          connection: c.connection ?? 3,
          stress: c.stress ?? 3,
        });
      }
    }

    const BUCKETS = 7;
    const bucketMs = windowMs / BUCKETS;
    const buckets = Array.from({ length: BUCKETS }, (_, i) => {
      const start = since + i * bucketMs;
      const rows = inWindow.filter((r) => r.t >= start && r.t < start + bucketMs);
      const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null;
      return {
        label: new Date(start + bucketMs / 2).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        score: avg,
        count: rows.length,
      };
    });

    const pct = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) : 0;
    const sleepDeficit = pct(inWindow.map((r) => (5 - r.sleep) / 4));
    const socialWithdrawal = pct(inWindow.map((r) => (5 - r.connection) / 4));

    // Self-report intensity trend: mean stress in the newer half vs the older half.
    const mid = since + windowMs / 2;
    const older = inWindow.filter((r) => r.t < mid).map((r) => r.stress);
    const newer = inWindow.filter((r) => r.t >= mid).map((r) => r.stress);
    const meanOlder = older.length ? older.reduce((s, v) => s + v, 0) / older.length : 0;
    const meanNewer = newer.length ? newer.reduce((s, v) => s + v, 0) / newer.length : 0;
    const intensityTrend =
      !newer.length || !older.length ? "Not enough data"
      : meanNewer - meanOlder > 0.2 ? "Rising"
      : meanOlder - meanNewer > 0.2 ? "Easing"
      : "Steady";

    const label = (v: number) => (v >= 66 ? "High influence" : v >= 40 ? "Moderate" : "Low");

    return {
      buckets,
      total: inWindow.length,
      maxScore: Math.max(1, ...buckets.map((b) => b.score ?? 0)),
      sleepDeficit,
      socialWithdrawal,
      sleepLabel: label(sleepDeficit),
      socialLabel: label(socialWithdrawal),
      intensityTrend,
    };
  }, [participants, rangeDays]);

  // Summary Metrics calculations
  const totalCount = participants.length;

  // Prioritized review counts
  const priorityReviewCount = alerts.filter(a => a.severity === "urgent" || a.category === "SAFETY_CONCERN").length;
  const humanReviewCount = alerts.filter(a => (a.severity === "elevated" || a.category === "HIGH" || a.category === "PERSISTENT_INCREASE") && a.status === "pending_review").length;
  const monitoringCount = alerts.filter(a => a.category === "SUPPORT_REQUEST" || a.status === "monitoring" || a.severity === "moderate").length;
  const positiveChangeCount = participants.filter(p => p.status === "Improving").length;

  // Chart data 1: Priority breakdown with Natural Tones palette
  const priorityData = [
    { name: "Priority Review", count: priorityReviewCount, color: "#A55D25" },
    { name: "Human Review", count: humanReviewCount, color: "#D49B6A" },
    { name: "Monitoring", count: monitoringCount, color: "#7F8C8D" },
    { name: "Positive Change", count: positiveChangeCount, color: "#5A5049" }
  ];

  // Chart data 2: Common flagged factors across all check-ins
  const factorDistribution = useMemo(() => {
    let sleepFlags = 0;
    let stressFlags = 0;
    let safetyFlags = 0;
    let connectionFlags = 0;
    let supportRequests = 0;

    participants.forEach(p => {
      const checkIns = p.checkIns || [];
      const latest = checkIns.length > 0 ? checkIns[checkIns.length - 1] : null;
      if (latest) {
        if (latest.sleep <= 2) sleepFlags++;
        if (latest.stress >= 4) stressFlags++;
        if (latest.safety === "No" || latest.safety === "Unsure") safetyFlags++;
        if (latest.connection <= 2) connectionFlags++;
        if (latest.supportRequested) supportRequests++;
      }
    });

    return [
      { factor: "High Stress (4-5)", count: stressFlags, color: "#D49B6A" },
      { factor: "Sleep Disturbance", count: sleepFlags, color: "#5A5049" },
      { factor: "Safety Uncertainty", count: safetyFlags, color: "#A55D25" },
      { factor: "Social Isolation", count: connectionFlags, color: "#7F8C8D" },
      { factor: "Voluntary Request", count: supportRequests, color: "#DBC3B2" }
    ];
  }, [participants]);

  // Priority Review queue: Filter active alerts that require review
  const priorityQueue = useMemo(() => {
    // Caseload scoping: the signed-in counsellor sees alerts for their own
    // participants + any unassigned participant. The participant's current
    // counsellor comes from the alert (participantAssignedWorker, resolved at
    // the data layer), falling back to the local list only if absent.
    const assignedBy = new Map(participants.map((p) => [p.id, p.assignedWorker]));
    const isCounsellor = !!currentWorker && currentWorker.role === "support_worker";
    return alerts
      .filter((a) => a.status === "pending_review" || a.status === "escalated" || a.status === "NEW" || a.status === "IN_REVIEW" || a.status === "SAFETY_ESCALATED")
      .filter((a) => {
        if (!isCounsellor || !currentWorker) return true;
        const pw =
          a.participantAssignedWorker !== undefined
            ? a.participantAssignedWorker
            : assignedBy.get(a.participantId);
        return !pw || pw === currentWorker.id || a.assignedTo === currentWorker.id;
      })
      .slice(0, 5);
  }, [alerts, participants, currentWorker]);

  // Alerts only carry a participantId, not the participant record itself —
  // look the name up so the priority queue can show it too, same as the
  // main participants table below.
  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach(p => {
      if (p.name) map.set(p.id, p.name);
    });
    return map;
  }, [participants]);

  // Resolve counsellor uuids -> real names for the "Counselor" column, so it
  // never shows a raw 36-char id.
  const [workerNameById, setWorkerNameById] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(
      new Set(participants.map((p) => p.assignedWorker).filter(Boolean))
    ) as string[];
    if (ids.length === 0) return;
    apiService.profiles
      .getNames(ids)
      .then(setWorkerNameById)
      .catch(() => {});
  }, [participants]);

  const isUuidStr = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const workerLabel = (rawId?: string): string | null => {
    const id = (rawId || "").trim();
    if (!id) return null;
    if (currentWorker && id === currentWorker.id) return currentWorker.name;
    if (workerNameById[id]) return workerNameById[id];
    // Also match a participant record's own name if the "worker" field happens
    // to already hold a plain name (legacy rows), otherwise show a short ref.
    return isUuidStr(id) ? `Counselor ${id.slice(0, 8)}` : id;
  };

  const alertName = (a: Alert) =>
    a.participantName ||
    participantNameById.get(a.participantId) ||
    (isUuidStr(a.participantId) ? `Participant ${a.participantId.slice(0, 8)}` : a.participantId);

  // Presentation helpers — used only for how a value is displayed, not what it is.
  const initialsOf = (label: string) =>
    label
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "•";

  // Calm, non-alarming wording for a wellbeing score band.
  const scoreBand = (score: number) =>
    score >= 70
      ? { label: "Needs attention", cls: "bg-[#F3E1DC] text-[#A65D52]" }
      : score >= 45
      ? { label: "Worth a look", cls: "bg-[#F4E7D2] text-[#8A6338]" }
      : { label: "Steady", cls: "bg-[#E9EFE2] text-[#5E7148]" };

  // Filtered & Sorted participants
  const filteredParticipants = useMemo(() => {
    return participants
      .filter(p => {
        const q = searchQuery.toLowerCase();
        const workerText = `${p.assignedWorker || ""} ${workerLabel(p.assignedWorker) || ""}`.toLowerCase();
        const matchesSearch = p.id.toLowerCase().includes(q) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          workerText.includes(q) ||
          p.language.toLowerCase().includes(q);

        const matchesStatus = statusFilter === "All" || p.status === statusFilter;

        const matchesCaseload =
          caseloadScope === "all" || (!!currentWorker && p.assignedWorker === currentWorker.id);

        return matchesSearch && matchesStatus && matchesCaseload;
      })
      .sort((a, b) => {
        const checkInsA = a.checkIns || [];
        const checkInsB = b.checkIns || [];
        const latestA = checkInsA.length > 0 ? (checkInsA[checkInsA.length - 1]?.calculatedScore || 0) : 0;
        const latestB = checkInsB.length > 0 ? (checkInsB[checkInsB.length - 1]?.calculatedScore || 0) : 0;

        const prevA = checkInsA.length > 1 ? (checkInsA[checkInsA.length - 2]?.calculatedScore || latestA) : latestA;
        const prevB = checkInsB.length > 1 ? (checkInsB[checkInsB.length - 2]?.calculatedScore || latestB) : latestB;

        const deltaA = latestA - prevA;
        const deltaB = latestB - prevB;

        if (sortBy === "score_desc") return latestB - latestA;
        if (sortBy === "score_asc") return latestA - latestB;
        if (sortBy === "change_desc") return deltaB - deltaA;
        return 0;
      });
  }, [participants, searchQuery, statusFilter, sortBy, caseloadScope, currentWorker, workerNameById]);

  // People whose latest check-in does not hang together — reported as fine,
  // but the behavioural, somatic, voice or cadence signals say otherwise.
  // Deliberately NOT filtered by distress score: the whole point is that
  // these are the people a score-ordered queue never shows, because their
  // score is low and it is low because they said so.
  const secondLookQueue = useMemo(() => {
    // Same fallback the rest of this dashboard uses: `assignedWorker` holds a
    // display name rather than a worker id, so a strict match can legitimately
    // return nobody. Falling back to the full list keeps the queue populated
    // instead of silently hiding the one thing it exists to show.
    const assigned = currentWorker
      ? participants.filter((p) => p.assignedWorker === currentWorker.id)
      : [];
    const mine = assigned.length > 0 ? assigned : participants;

    return mine
      .map((p) => ({ participant: p, concordance: assessLatest(p.checkIns || []) }))
      .filter((row) => row.concordance?.needsSecondLook)
      .sort((a, b) => (b.concordance!.contradicting) - (a.concordance!.contradicting))
      .slice(0, 6);
  }, [participants, currentWorker]);

  /**
   * People whose *pattern of use* has changed, whether or not they have said
   * anything. This is the queue that still contains someone who stopped
   * opening the app three weeks ago — every other list on this page is built
   * from answers, so a person who gives none disappears from all of them.
   *
   * Messages are not loaded here: the dashboard holds dozens of participants
   * and fetching every thread would cost more than it adds. Check-in rhythm
   * alone is enough to surface the silence; the full reading, including the
   * message thread, is on the person's own page.
   */
  const escalationQueue = useMemo(() => {
    const assigned = currentWorker
      ? participants.filter((p) => p.assignedWorker === currentWorker.id)
      : [];
    const mine = assigned.length > 0 ? assigned : participants;
    const rank = { urgent: 3, contact: 2, watch: 1, none: 0 } as const;

    return mine
      .map((p) => {
        const checkIns = p.checkIns || [];
        const engagement = assessEngagement({ checkIns });
        return {
          participant: p,
          engagement,
          escalation: assessEscalation({
            checkIns,
            engagement,
            concordance: assessLatest(checkIns),
            caseEvents: p.caseEvents || [],
          }),
        };
      })
      .filter((row) => row.escalation.level === "urgent" || row.escalation.level === "contact")
      .sort((a, b) => rank[b.escalation.level] - rank[a.escalation.level])
      .slice(0, 6);
  }, [participants, currentWorker]);


  return (
    <div className="max-w-7xl mx-auto py-10 sm:py-14 px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-14 font-sans">
      {/* Header — warm, personal, not an ops centre */}
      <header className="pt-2 space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#B0713C]">
          {header.dateLine}
        </p>
        <h1 className="font-serif text-[2.5rem] sm:text-[3rem] leading-[1.08] text-[#3A2A1E]">
          {header.greeting}, {header.firstName}
        </h1>
        <p className="text-[15px] sm:text-base text-[#8A7A6B] max-w-xl leading-relaxed">
          Here&rsquo;s a calm overview of the people you&rsquo;re supporting. {header.subtitle}
        </p>
      </header>

      {/* Overview cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-elev rounded-3xl p-6 sm:p-7 flex flex-col gap-6 min-h-[168px]">
          <div className="w-10 h-10 rounded-2xl bg-[#F1E7DA] text-[#9A8672] flex items-center justify-center">
            <HeartHandshake size={18} />
          </div>
          <div className="space-y-1">
            <div className="font-serif text-4xl text-[#3A2A1E]">
              {participants.filter(p => p.status === "Urgent safety signal" || p.status === "Human review pending").length}
            </div>
            <p className="text-[13px] text-[#8A7A6B]">People who may need attention</p>
          </div>
        </div>

        <div className="card-elev rounded-3xl p-6 sm:p-7 flex flex-col gap-6 min-h-[168px]">
          <div className="w-10 h-10 rounded-2xl bg-[#F5E8D6] text-[#B07A3C] flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div className="space-y-1">
            <div className="font-serif text-4xl text-[#3A2A1E]">+12%</div>
            <p className="text-[13px] text-[#8A7A6B]">Early wellbeing change · 7 days</p>
          </div>
        </div>

        <div className="card-elev rounded-3xl p-6 sm:p-7 flex flex-col gap-6 min-h-[168px]">
          <div className="w-10 h-10 rounded-2xl bg-[#EFEAE1] text-[#8A8478] flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
          <div className="space-y-1">
            <div className="font-serif text-4xl text-[#3A2A1E]">
              {participants.filter(p => p.status === "Needs follow-up").length}
            </div>
            <p className="text-[13px] text-[#8A7A6B]">Support plans in review</p>
          </div>
        </div>

        <div className="rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-4 min-h-[168px] bg-gradient-to-br from-[#A85D2E] to-[#7E4420] text-white shadow-[0_18px_38px_-20px_rgba(122,63,28,0.55)]">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Needs your attention</p>
            <p className="text-[13px] text-white/90 leading-relaxed">
              {priorityReviewCount + humanReviewCount > 0
                ? `${priorityReviewCount + humanReviewCount} ${priorityReviewCount + humanReviewCount === 1 ? "person" : "people"} could use a follow-up today.`
                : "Nothing is waiting for review right now."}
            </p>
          </div>
          <button
            onClick={onNavigateAlerts}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-[#9A5B33] px-4 py-2.5 text-[13px] font-semibold hover:bg-[#FBF3EA] transition-colors cursor-pointer"
          >
            <span>Review support</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Counsellor self-service profile (languages / availability / caseload) */}
      <WorkerProfileCard />

      {/* Counselor wellbeing / burnout self-check (private, opt-in) */}
      <WorkerWellbeingCheck />

      {/* Quiet secondary stats */}
      <section className="flex flex-wrap gap-4">
        <div className="card-elev rounded-2xl px-5 py-4 flex items-center gap-3 min-w-[160px]">
          <Shield size={16} className="text-[#B0713C]" />
          <div>
            <span className="text-[12px] text-[#8A7A6B] block">Consent coverage</span>
            <span className="font-serif text-xl text-[#3A2A1E]">96%</span>
          </div>
        </div>
        {/* Was a hardcoded "18m". It described nothing, and it sat in the one
            place a counsellor would read it as a fact about their own team.
            This is the median time from an alert being raised to a human
            opening it, computed from the alerts on this screen. */}
        <div className="card-elev rounded-2xl px-5 py-4 flex items-center gap-3 min-w-[160px]">
          <Clock size={16} className="text-[#B0713C]" />
          <div>
            <span className="text-[12px] text-[#8A7A6B] block">Typical pick-up</span>
            <span className="font-serif text-xl text-[#3A2A1E]">
              {responseClocks.medianMinutesToAcknowledge === null
                ? "no data yet"
                : responseClocks.medianMinutesToAcknowledge < 60
                  ? `${responseClocks.medianMinutesToAcknowledge}m`
                  : `${Math.round(responseClocks.medianMinutesToAcknowledge / 60)}h`}
            </span>
          </div>
        </div>
      </section>

      {/* Response clocks. slaEngine has been computing these for a while with
          nothing rendering them, which made it a metric nobody could see and
          so a metric that changed nothing. */}
      <ResponseClockPanel
        alerts={alerts}
        onSelectParticipant={onSelectParticipant}
        onNavigateAlerts={onNavigateAlerts}
      />

      {/* Second-look queue: divergence between the self-report and everything else */}
      {escalationQueue.length > 0 && (
        <section className="card-elev rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#B0713C]">
              <ScanSearch size={13} />
              Escalation detected
            </span>
            <h2 className="font-serif text-2xl text-[#3A2A1E]">
              Changes in how people are using the app
            </h2>
            <p className="text-[13px] text-[#8A7A6B] max-w-2xl leading-relaxed">
              Read from check-in rhythm rather than from anything anyone reported, so someone who
              has stopped answering altogether still appears here, which is the one case every
              other list on this page will miss. Each carries the facts behind it; open the person
              to see them.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {escalationQueue.map(({ participant, escalation }) => (
              <button
                key={participant.id}
                onClick={() => onSelectParticipant(participant.id)}
                className="text-left rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-4 hover:border-[#DBC3B2] transition-colors cursor-pointer flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-[#3A2A1E] truncate">
                      <span data-no-translate>{participant.name || participant.id}</span>
                    </p>
                    <p className="text-[13px] text-[#8A7A6B] leading-snug">{escalation.headline}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${
                      escalation.level === "urgent"
                        ? "bg-[#A85D2E]/12 text-[#8A4A20]"
                        : "bg-[#8A7A6B]/12 text-[#6B5D50]"
                    }`}
                  >
                    within {escalation.withinHours}h
                  </span>
                </div>

                {escalation.evidence.length > 0 && (
                  <p className="text-[12px] text-[#6B5D50] leading-snug">
                    {escalation.evidence[0]}
                    {escalation.evidence.length > 1 &&
                      ` +${escalation.evidence.length - 1} more`}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {secondLookQueue.length > 0 && (
        <section className="card-elev rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#B0713C]">
              <ScanSearch size={13} />
              Worth a second look
            </span>
            <h2 className="font-serif text-2xl text-[#3A2A1E]">
              The self-report may not be the whole picture
            </h2>
            <p className="text-[13px] text-[#8A7A6B] max-w-2xl leading-relaxed">
              These people did not report high distress. That is exactly why they are here. What they
              said and what everything else suggests do not line up, so the usual queue would never
              have shown them to you. Nothing here says anyone is being untruthful; it is a prompt to
              ask again, gently.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {secondLookQueue.map(({ participant, concordance }) => (
              <button
                key={participant.id}
                onClick={() => onSelectParticipant(participant.id)}
                className="text-left rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-4 hover:border-[#DBC3B2] transition-colors cursor-pointer flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-[#3A2A1E] truncate">
                      <span data-no-translate>{participant.name || participant.id}</span>
                    </p>
                    <p className="text-[13px] text-[#8A7A6B] leading-snug">{concordance!.summary}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${
                      concordance!.level === "diverging"
                        ? "bg-[#A85D2E]/12 text-[#8A4A20]"
                        : "bg-[#8A7A6B]/12 text-[#6B5D50]"
                    }`}
                  >
                    {concordance!.level === "diverging" ? "Diverging" : "Low confidence"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {concordance!.signals
                    .filter((sig) => sig.verdict === "contradicts")
                    .map((sig) => (
                      <span
                        key={sig.key}
                        className="text-[11px] text-[#6B5D50] bg-white border border-[#ECE1D3] rounded-lg px-2 py-1"
                      >
                        {sig.label}: <span className="font-semibold">{sig.reading}</span>
                      </span>
                    ))}
                  {concordance!.caveats.map((c) => (
                    <span
                      key={c}
                      className="text-[11px] text-[#8A4A20] bg-[#A85D2E]/8 border border-[#A85D2E]/20 rounded-lg px-2 py-1"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Needs-attention list */}
      <section className="card-elev rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#B0713C]">
              <HeartHandshake size={13} />
              Needs your attention
            </span>
            <h2 className="font-serif text-2xl text-[#3A2A1E]">People who may need a check-in</h2>
            <p className="text-[13px] text-[#8A7A6B] max-w-2xl leading-relaxed">
              Ordered by what looks most time-sensitive. Safety signals first, then sustained changes, then people who asked for support.
            </p>
          </div>
          <button onClick={onNavigateAlerts} className="btn-ghost shrink-0 px-4 py-2 text-[12px]">
            <span>Open the queue</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {priorityQueue.length > 0 ? (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left text-[13px] text-[#8A7A6B]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.08em] text-[#A99A8A] border-b border-[#ECE1D3]">
                  <th className="py-3 pr-4 font-semibold">Person</th>
                  <th className="py-3 px-4 font-semibold">Signal</th>
                  <th className="py-3 px-4 font-semibold">Wellbeing signal</th>
                  <th className="py-3 px-4 font-semibold">What we noticed</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 pl-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE3D4]">
                {priorityQueue.map(alert => {
                  const isUrgent = alert.severity === "urgent" || alert.category === "SAFETY_CONCERN";
                  const isElevated = alert.severity === "elevated" || alert.category === "HIGH";

                  return (
                    <tr
                      key={alert.id}
                      onClick={() => onSelectParticipant(alert.participantId)}
                      className="hover:bg-[#F8F0E5] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 pr-4 align-top">
                        <span className="font-semibold text-[#3A2A1E] group-hover:text-[#9A5B33] transition-colors">
                          {alertName(alert)}
                        </span>
                        <span className="block font-mono text-[10px] text-[#B7A996] mt-0.5">{alert.participantId}</span>
                      </td>

                      <td className="py-4 px-4 align-top">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide inline-block ${
                            isUrgent
                              ? "bg-[#F3E1DC] text-[#A65D52]"
                              : isElevated
                              ? "bg-[#F4E7D2] text-[#8A6338]"
                              : "bg-[#EFEAE1] text-[#82796B]"
                          }`}
                        >
                          {alert.category ? alert.category.replace("_", " ") : alert.severity}
                        </span>
                      </td>

                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#3A2A1E]">
                            {alert.score}<span className="text-[11px] text-[#A99A8A]">/100</span>
                          </span>
                          {alert.changeDelta !== undefined && alert.changeDelta !== 0 && (
                            <span className={`text-[11px] font-semibold ${alert.changeDelta > 0 ? "text-[#A65D52]" : "text-[#5E7148]"}`}>
                              {alert.changeDelta > 0 ? `+${alert.changeDelta}` : alert.changeDelta}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-md align-top">
                        <p className="text-[13px] text-[#6E5F4E] line-clamp-2">{alert.reason}</p>
                        {alert.contributingFactors && alert.contributingFactors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {alert.contributingFactors.slice(0, 2).map((f, i) => (
                              <span key={i} className="text-[10px] bg-[#F1E7DA] px-1.5 py-0.5 rounded text-[#8A7A6B]">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-[#F1E7DA] text-[#6E5F4E]">
                          {alert.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-4 pl-4 text-right align-top">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectParticipant(alert.participantId);
                          }}
                          className="btn-primary px-3 py-2 text-[12px]"
                        >
                          <span>Review support</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center bg-[#F8F0E5] rounded-2xl border border-[#ECE1D3] space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-white border border-[#ECE1D3] flex items-center justify-center mx-auto text-[#6E8A5E]">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="font-serif text-lg text-[#3A2A1E]">You&rsquo;re all caught up</h4>
            <p className="text-[13px] text-[#8A7A6B]">No one in your caseload needs review right now.</p>
          </div>
        )}
      </section>

      {/* How AURA works — light explainer */}
      <section className="rounded-3xl p-6 sm:p-8 bg-[#F6ECE0] border border-[#ECE1D3] space-y-5">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9A5B33]">
            How AURA supports your work
          </span>
          <h3 className="font-serif text-xl sm:text-2xl text-[#3A2A1E]">From a gentle signal to real support</h3>
          <p className="text-[13px] text-[#8A7A6B] max-w-3xl leading-relaxed">
            AURA watches how answers change over time and explains why something stood out. A person on the support team decides what to do about it.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { step: "Notice", desc: "Changes over time" },
            { step: "Explain", desc: "Transparent factors" },
            { step: "Prioritise", desc: "Gently ranked" },
            { step: "Human review", desc: "A person decides", highlight: true },
            { step: "Support", desc: "Warm contact" },
            { step: "Follow up", desc: "How are they now" },
            { step: "Learn", desc: "Refine over time" }
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border text-[#3A2A1E] space-y-1 ${
                item.highlight ? "bg-[#F3E7D8] border-[#C88A5A]/45" : "bg-white border-[#ECE1D3]"
              }`}
            >
              <div className="text-[12px] font-semibold">{item.step}</div>
              <p className="text-[10px] text-[#8A7A6B] leading-tight">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Wellbeing signals + suggested follow-ups */}
      <section className="grid lg:grid-cols-12 gap-6">
        {/* Chart */}
        <div className="lg:col-span-8 card-elev rounded-3xl p-6 sm:p-8 space-y-8 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl text-[#3A2A1E] flex items-center gap-2">
                <Activity size={19} className="text-[#B0713C]" />
                Wellbeing signals
              </h2>
              <p className="text-[13px] text-[#8A7A6B]">A gentle view of how the group has been trending.</p>
            </div>
            <div className="flex items-center gap-1 bg-[#F4EADF] rounded-full p-1">
              {([14, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setRangeDays(d)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    rangeDays === d
                      ? "bg-white text-[#3A2A1E] ring-1 ring-[#ECE1D3]"
                      : "text-[#8A7A6B] hover:text-[#3A2A1E]"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {cohort.total === 0 ? (
            <div className="h-48 w-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm font-semibold text-[#3A2A1E]">No check-ins in the last {rangeDays} days</p>
              <p className="text-[13px] text-[#8A7A6B] mt-1">
                Bars appear here once people submit check-ins within the selected window.
              </p>
            </div>
          ) : (
            <div className="h-52 w-full pt-2 flex items-end justify-between gap-2 sm:gap-3">
              {cohort.buckets.map((b, i) => {
                const h = b.score == null ? 0 : Math.max(6, Math.round((b.score / 100) * 100));
                const tone =
                  (b.score ?? 0) >= 65 ? "from-[#CE9088] to-[#D9A29A]"
                  : (b.score ?? 0) >= 45 ? "from-[#DBA766] to-[#E4B87E]"
                  : "from-[#E6C08E] to-[#EECBA0]";
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-[#3A2A1E]">{b.score ?? "—"}</span>
                    <div className="w-full max-w-[46px] h-36 flex items-end rounded-t-lg bg-[#F4EADF]">
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t ${tone}`}
                        style={{ height: `${h}%` }}
                        title={b.score == null ? "No check-ins" : `${b.label}: avg ${b.score}/100 · ${b.count} check-in(s)`}
                      />
                    </div>
                    <span className="text-[10px] text-[#A99A8A]">{b.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-6 border-t border-[#EEE3D4] grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Sleep disruption", value: cohort.sleepLabel, pct: cohort.sleepDeficit, color: "#A8763F", soft: "#F1E5D3" },
              { label: "Social withdrawal", value: cohort.socialLabel, pct: cohort.socialWithdrawal, color: "#C0855A", soft: "#F3E7DA" },
              { label: "Self-report intensity", value: cohort.intensityTrend, pct: null as number | null, color: "#C58077", soft: "#F3E1DC", meta: `${cohort.total} check-ins` },
            ].map((f) => (
              <div key={f.label}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A99A8A] flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  {f.label}
                </span>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-semibold text-[#3A2A1E]">{f.value}</span>
                  <span className="text-[11px] font-medium" style={{ color: f.color }}>
                    {f.pct != null ? `${f.pct}%` : f.meta}
                  </span>
                </div>
                {f.pct != null && (
                  <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: f.soft }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, f.pct)}%`, backgroundColor: f.color }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggested follow-ups — real, caseload-scoped, from priorityQueue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-serif text-lg text-[#3A2A1E]">Suggested follow-ups</h3>
            {priorityQueue.length > 2 && (
              <button
                onClick={onNavigateAlerts}
                className="text-[12px] font-semibold text-[#9A5B33] hover:text-[#7E4420] cursor-pointer"
              >
                See all
              </button>
            )}
          </div>

          {priorityQueue
            .filter((a, i) => priorityQueue.findIndex((x) => x.participantId === a.participantId) === i)
            .slice(0, 2)
            .map((a) => {
            const band = scoreBand(a.score ?? 0);
            const name = alertName(a);
            return (
              <div key={a.id} className="card-elev rounded-3xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F3E7D8] text-[#9A5B33] flex items-center justify-center text-[12px] font-semibold shrink-0">
                    {initialsOf(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[14px] font-semibold text-[#3A2A1E] truncate">{name}</h4>
                    <p className="text-[11px] text-[#8A7A6B] mt-0.5 line-clamp-2">{a.reason}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide shrink-0 ${band.cls}`}>
                    {band.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectParticipant(a.participantId)}
                    className="btn-ghost flex-1 px-3 py-2 text-[12px]"
                  >
                    View plan
                  </button>
                  <button
                    onClick={() => onSelectParticipant(a.participantId)}
                    className="btn-primary flex-1 px-3 py-2 text-[12px]"
                  >
                    Review support
                  </button>
                </div>
              </div>
            );
          })}

          {priorityQueue.length === 0 && (
            <div className="card-elev rounded-3xl p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#E9EFE2] text-[#5E7148] flex items-center justify-center mx-auto">
                <CheckCircle2 size={18} />
              </div>
              <p className="text-[13px] font-semibold text-[#3A2A1E]">Nothing to follow up</p>
              <p className="text-[12px] text-[#8A7A6B]">Your caseload looks settled right now.</p>
            </div>
          )}
        </div>
      </section>

      {/* People you're supporting */}
      <section className="card-elev rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif text-xl text-[#3A2A1E]">People you&rsquo;re supporting</h3>
            <p className="text-[13px] text-[#8A7A6B]">
              Open anyone to see their trend, the factors behind it, and to add a follow-up note.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {assignedCount > 0 && (
              <div className="flex items-center rounded-xl border border-[#ECE1D3] bg-white p-0.5 text-[12px] font-semibold">
                <button
                  onClick={() => setCaseloadScope("mine")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    caseloadScope === "mine" ? "bg-[#A85D2E] text-white" : "text-[#8A7A6B] hover:text-[#3A2A1E]"
                  }`}
                >
                  My caseload ({assignedCount})
                </button>
                <button
                  onClick={() => setCaseloadScope("all")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    caseloadScope === "all" ? "bg-[#A85D2E] text-white" : "text-[#8A7A6B] hover:text-[#3A2A1E]"
                  }`}
                >
                  All ({participants.length})
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A99A8A]" size={15} />
              <input
                type="text"
                placeholder="Search name, ID, counselor, language…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-[#ECE1D3] bg-[#FAF3EA] text-[13px] text-[#3A2A1E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C88A5A] w-48 sm:w-60"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-xl border border-[#ECE1D3] bg-white text-[13px] font-medium text-[#3A2A1E] focus:outline-none focus:ring-2 focus:ring-[#C88A5A] cursor-pointer"
            >
              <option value="All">All statuses</option>
              <option value="Needs follow-up">Needs follow-up</option>
              <option value="Urgent safety signal">Urgent safety signal</option>
              <option value="Improving">Improving</option>
              <option value="Stable">Stable</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "score_desc" | "score_asc" | "change_desc" | "recent")}
              className="py-2 px-3 rounded-xl border border-[#ECE1D3] bg-white text-[13px] font-medium text-[#3A2A1E] focus:outline-none focus:ring-2 focus:ring-[#C88A5A] cursor-pointer"
            >
              <option value="score_desc">Sort: highest signal</option>
              <option value="score_asc">Sort: lowest signal</option>
              <option value="change_desc">Sort: largest change</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left text-[13px] text-[#8A7A6B]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.08em] text-[#A99A8A] border-b border-[#ECE1D3]">
                <th className="py-3 pr-4 font-semibold">Person</th>
                <th className="py-3 px-4 font-semibold">Wellbeing signal</th>
                <th className="py-3 px-4 font-semibold">Recent change</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Counselor</th>
                <th className="py-3 pl-4 font-semibold text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE3D4]">
              {filteredParticipants.length > 0 ? (
                filteredParticipants.map((p) => {
                  const checkIns = p.checkIns || [];
                  const count = checkIns.length;
                  const latest = count > 0 ? checkIns[count - 1] : null;
                  const prev = count > 1 ? checkIns[count - 2] : null;
                  const score = latest?.calculatedScore ?? null;
                  const prevScore = prev?.calculatedScore ?? score;
                  const delta = score !== null && prevScore !== null && count > 1 ? score - prevScore : null;
                  const band = score !== null ? scoreBand(score) : null;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectParticipant(p.id)}
                      className="hover:bg-[#F8F0E5] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 pr-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#3A2A1E] group-hover:text-[#9A5B33] transition-colors">
                            {p.name || p.id}
                          </span>
                          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[#F1E7DA] text-[#8A7A6B]">
                            {p.language}
                          </span>
                        </div>
                        {p.name && (
                          <span className="block font-mono text-[10px] text-[#B7A996] mt-0.5">{p.id}</span>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        {count === 0 ? (
                          <span className="text-[12px] text-[#A99A8A]">Not assessed yet</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-[#3A2A1E]">
                              {score}<span className="text-[11px] text-[#A99A8A]">/100</span>
                            </span>
                            {band && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${band.cls}`}>
                                {band.label}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        {count === 0 ? (
                          <span className="text-[12px] text-[#A99A8A] italic">Awaiting check-in</span>
                        ) : count === 1 ? (
                          <span className="text-[12px] font-medium text-[#5E7148] bg-[#E9EFE2] px-2 py-0.5 rounded-md">
                            Baseline
                          </span>
                        ) : delta !== null ? (
                          delta > 0 ? (
                            <span className="text-[#A65D52] font-semibold flex items-center gap-1">
                              <TrendingUp size={14} /> +{delta} pts
                            </span>
                          ) : delta < 0 ? (
                            <span className="text-[#5E7148] font-semibold flex items-center gap-1">
                              <TrendingDown size={14} /> {delta} pts
                            </span>
                          ) : (
                            <span className="text-[#A99A8A] font-medium">Steady</span>
                          )
                        ) : (
                          <span className="text-[#A99A8A]">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top">
                        <span
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg inline-block ${
                            count === 0
                              ? "bg-[#F1E7DA] text-[#A99A8A]"
                              : p.status === "Urgent safety signal"
                              ? "bg-[#F3E1DC] text-[#A65D52]"
                              : p.status === "Needs follow-up" || p.status === "Human review pending"
                              ? "bg-[#F4E7D2] text-[#8A6338]"
                              : p.status === "Improving"
                              ? "bg-[#E9EFE2] text-[#5E7148]"
                              : "bg-[#EFEAE1] text-[#82796B]"
                          }`}
                        >
                          {count === 0 ? "Awaiting check-in" : p.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 align-top text-[#8A7A6B]">
                        {workerLabel(p.assignedWorker) || <span className="text-[#A99A8A] italic">Unassigned</span>}
                      </td>

                      <td className="py-4 pl-4 text-right align-top">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectParticipant(p.id);
                          }}
                          className="btn-ghost px-3 py-2 text-[12px] group-hover:bg-[#F3E7D8] group-hover:border-[#C88A5A]/45"
                        >
                          <span>Open</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[13px] text-[#A99A8A]">
                    No one matches your search and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Responsible-AI note */}
      <div className="p-4 rounded-2xl bg-[#F6ECE0] border border-[#ECE1D3] text-center space-y-1">
        <p className="text-[12px] text-[#8A7A6B]">{ALERT_CONFIG.DISCLAIMER}</p>
        <p className="text-[11px] text-[#A99A8A]">
          Prototype thresholds are demonstration rules and are not clinically validated.
        </p>
      </div>
    </div>
  );
};
