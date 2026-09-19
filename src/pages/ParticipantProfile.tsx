import React, { useEffect, useState } from "react";
import { FirstAidKitCard } from "../components/FirstAidKitCard";
import { FirstAidKit } from "../types";
import {
  Activity,
  User as UserIcon,
  Shield,
  Clock,
  Heart,
  Moon,
  Users,
  LifeBuoy,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  RotateCcw,
  Download,
  Phone,
  Pencil,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Mic
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { User, CheckIn, Participant } from "../types";
import { authService } from "../services/authService";
import { participantStore } from "../services/participantStore";
import { apiService } from "../services/apiService";
import { notificationService } from "../services/notificationService";
import { EmptyWellbeingState } from "../components/EmptyWellbeingState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MyRecordings } from "../components/MyRecordings";
import { CheckInDayPanel } from "../components/CheckInDayPanel";
import { useChartDayOpener, SCORE_DOT_CLASS } from "../hooks/useChartDayOpener";
import { ParticipantTestCard } from "../components/ParticipantTestCard";
import { supabaseService } from "../services/supabaseService";
import { who5Due, type InstrumentAdministration, type InstrumentDue } from "../services/instruments";

interface Props {
  user: User;
  participantRecord: Participant | null;
  onStartCheckin: () => void;
  onOpenMessages?: () => void;
  onOpenEmergency: () => void;
  onOpenPrivacy: () => void;
  onOpenChooseCounsellor?: () => void;
  onOpenVoiceCompanion?: () => void;
  onOpenWellbeingIndex?: () => void;
  onOpenWhatToExpect?: () => void;
  onOpenConsent?: () => void;
  onLogout: () => void;
  onUpdateConsent: (status: boolean) => void;
  onDataReset?: () => void;
  onViewResults?: () => void;
}

/** The support preferences currently on offer. */
const SUPPORT_PREFERENCES = ["In-app support information", "Human counselor"];

export const ParticipantProfile: React.FC<Props> = ({
  user,
  participantRecord,
  onStartCheckin,
  onOpenMessages,
  onOpenEmergency,
  onOpenPrivacy,
  onOpenChooseCounsellor,
  onOpenVoiceCompanion,
  onOpenWellbeingIndex,
  onOpenWhatToExpect,
  onOpenConsent,
  onLogout,
  onUpdateConsent,
  onDataReset,
  onViewResults
}) => {
  const [supportPref, setSupportPref] = useState(
    user.supportPreference || participantRecord?.preferredSupport || "In-app support information"
  );
  const [prefSaved, setPrefSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Whether the WHO-5 is worth offering right now. Null while it loads, so the
  // card never flashes in and out on every render of this page.
  const participantId = participantRecord?.id;
  const enrolledAt = participantRecord?.createdAt;
  const [who5Status, setWho5Status] = useState<InstrumentDue | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!participantId) {
      setWho5Status(null);
      return;
    }
    supabaseService.instrumentAdministrations
      .getAll(participantId)
      .then((rows: InstrumentAdministration[]) => {
        if (!cancelled) {
          setWho5Status(who5Due(rows, enrolledAt || new Date().toISOString()));
        }
      })
      .catch(() => {
        // A read that fails should not offer the questionnaire on a guess.
        if (!cancelled) setWho5Status(null);
      });
    return () => {
      cancelled = true;
    };
  }, [participantId, enrolledAt]);

  // participants.assigned_worker holds an id, so the card said "Your
  // Counsellor" and left the person to guess who that was. Resolve it to the
  // name they would recognise. Null while it loads, and null for an id with no
  // profile behind it, which the heading falls back on rather than showing a
  // raw uuid.
  const assignedWorkerId = participantRecord?.assignedWorker;
  const [counsellorName, setCounsellorName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!assignedWorkerId) {
      setCounsellorName(null);
      return;
    }
    apiService.profiles
      .getName(assignedWorkerId)
      .then((name) => {
        if (!cancelled) setCounsellorName(name);
      })
      .catch(() => {
        if (!cancelled) setCounsellorName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assignedWorkerId]);

  // Emergency / trusted contact (optional) — editable inline, persisted to
  // Supabase Auth user_metadata via authService.
  const [ecValue, setEcValue] = useState(user.emergencyContact || "");
  const [ecEditing, setEcEditing] = useState(false);
  const [ecSaved, setEcSaved] = useState(false);

  const handleSaveEmergencyContact = async () => {
    await authService.updateEmergencyContact(ecValue);
    setEcEditing(false);
    setEcSaved(true);
    setTimeout(() => setEcSaved(false), 2500);
  };

  // Everything this participant's account holds (their own rows only).
  const buildDataBundle = () => ({
    exportedAt: new Date().toISOString(),
    note:
      "Personal data export from AURA. Contains only your own account data. " +
      "AURA provides assistive wellbeing signals, not a clinical diagnosis.",
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      language: user.language,
      ageRange: user.ageRange,
      supportPreference: user.supportPreference,
      emergencyContact: ecValue || null,
      consentGiven: user.consentGiven,
      createdAt: user.createdAt
    },
    consentPreferences: participantRecord?.consentPreferences ?? null,
    status: participantRecord?.status ?? null,
    checkIns: checkIns.map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      wellbeing: c.wellbeing,
      stress: c.stress,
      sleep: c.sleep,
      safety: c.safety,
      connection: c.connection,
      supportRequested: c.supportRequested,
      immediateSafetyConcern: c.immediateSafetyConcern,
      calculatedScore: c.calculatedScore ?? null,
      optionalNote: c.optionalNote ?? c.notes ?? null,
      reflection: c.reflection ?? null
    })),
    followUps: participantRecord?.followUps ?? [],
    latestAnalysis: latestAnalysis ?? null
  });

  const downloadBlob = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aura-my-data-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // "Download My Data" — a self-contained, readable HTML document the
  // participant can open in any browser, read, or print/save as PDF.
  const handleExportData = () => {
    const b = buildDataBundle();
    const esc = (s: any) =>
      String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const cp = b.consentPreferences;
    const ciRows = b.checkIns.length
      ? b.checkIns
          .map(
            (c) => `<tr>
        <td>${esc(new Date(c.timestamp).toLocaleDateString())}</td>
        <td>${esc(c.calculatedScore ?? "—")}</td>
        <td>${esc(c.wellbeing)}/5</td><td>${esc(c.stress)}/5</td><td>${esc(c.sleep)}/5</td>
        <td>${esc(c.safety)}</td><td>${esc(c.connection)}/5</td>
        <td>${c.supportRequested ? "Yes" : "—"}</td>
        <td>${esc(c.optionalNote || "")}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="9" style="color:#8a827a">No check-ins recorded.</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>My AURA data: ${esc(b.account.name)}</title><style>
*{box-sizing:border-box} body{font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#2b2622;margin:32px;max-width:820px}
h1{font-size:22px;margin:0 0 2px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8a5a2b;margin:24px 0 8px;border-bottom:1px solid #e7ddd3;padding-bottom:4px}
.muted{color:#6b625a;font-size:12px} dl{display:grid;grid-template-columns:180px 1fr;gap:4px 16px;margin:6px 0}
dt{color:#8a827a} table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}
th,td{border:1px solid #e7ddd3;padding:5px 7px;text-align:left} th{background:#faf5ef}
.disc{margin-top:24px;padding:10px 12px;background:#faf5ef;border:1px solid #e7ddd3;border-radius:8px;font-size:11px;color:#6b625a}
@media print{body{margin:12mm}}
</style></head><body>
<h1>My AURA data</h1>
<div class="muted">Exported ${esc(new Date(b.exportedAt).toLocaleString())}. This is a copy of everything your AURA account holds about you.</div>

<h2>Account</h2>
<dl>
  <dt>Name</dt><dd>${esc(b.account.name)}</dd>
  <dt>Email</dt><dd>${esc(b.account.email)}</dd>
  <dt>Account ID</dt><dd>${esc(b.account.id)}</dd>
  <dt>Language</dt><dd>${esc(b.account.language || "—")}</dd>
  <dt>Age range</dt><dd>${esc(b.account.ageRange || "—")}</dd>
  <dt>Support preference</dt><dd>${esc(b.account.supportPreference || "—")}</dd>
  <dt>Emergency / trusted contact</dt><dd>${esc(b.account.emergencyContact || "None on file")}</dd>
  <dt>Consent given</dt><dd>${b.account.consentGiven ? "Yes" : "No"}</dd>
  <dt>Account created</dt><dd>${esc(b.account.createdAt ? new Date(b.account.createdAt).toLocaleDateString() : "—")}</dd>
  <dt>Current status</dt><dd>${esc(b.status || "—")}</dd>
</dl>

<h2>Privacy & consent settings</h2>
${
  cp
    ? `<dl>
  <dt>Wellbeing check-ins</dt><dd>${cp.wellbeingCheckIns ? "On" : "Off"}</dd>
  <dt>Sharing with counsellor</dt><dd>${cp.supportWorkerSharing ? "On" : "Off"}</dd>
  <dt>Free-text sharing</dt><dd>${cp.optionalFreeTextSharing ? "On" : "Off"}</dd>
  <dt>Speak instead of typing</dt><dd>${cp.voiceTranscription ? "On" : "Off"}</dd>
  <dt>Measure how it was said</dt><dd>${cp.voiceAcousticAnalysis ? "On" : "Off"}</dd>
  <dt>Keep the recording afterwards</dt><dd>${cp.voiceAudioRetention ? "On" : "Off"}</dd>
  <dt>Anonymous community analytics</dt><dd>${cp.communityAggregateAnalytics ? "On" : "Off"}</dd>
</dl>`
    : `<p class="muted">Using default consent settings.</p>`
}

<h2>Your check-ins (${b.checkIns.length})</h2>
<table><thead><tr><th>Date</th><th>Score</th><th>Wellbeing</th><th>Stress</th><th>Sleep</th><th>Safety</th><th>Connection</th><th>Support req.</th><th>Your note</th></tr></thead>
<tbody>${ciRows}</tbody></table>

<h2>Follow-ups (${b.followUps.length})</h2>
${
  b.followUps.length
    ? `<ul>${b.followUps
        .map(
          (f: any) =>
            `<li>${esc(f.interventionType || "Follow-up")}: ${esc(f.outcomeLabel || f.outcome || "")} ${
              f.followUpDate ? `(${esc(new Date(f.followUpDate).toLocaleDateString())})` : ""
            }</li>`
        )
        .join("")}</ul>`
    : `<p class="muted">No follow-ups recorded.</p>`
}

<div class="disc">
  These are wellbeing signals, reviewed by a person. <strong>They are not a clinical diagnosis.</strong>
  You can also download this data as a raw JSON file from the same screen. To delete your check-in history,
  use "Reset My Check-in Data"; to stop all monitoring, use "Withdraw Consent".
</div>
</body></html>`;
    downloadBlob(html, "text/html;charset=utf-8", "html");
  };

  // Secondary: the same data as a raw JSON file (portable / machine-readable).
  const handleExportDataJson = () => {
    downloadBlob(JSON.stringify(buildDataBundle(), null, 2), "application/json", "json");
  };

  const checkIns = participantRecord?.checkIns || [];
  const count = checkIns.length;
  const latestCheckIn = count > 0 ? checkIns[count - 1] : null;
  const previousCheckIn = count > 1 ? checkIns[count - 2] : null;
  const latestAnalysis = participantStore.getLatestAnalysisForParticipant(user.id);

  // Gentle, dignity-first nudge: if recent check-ins show rising or elevated
  // strain, offer a way to reach out — never alarmist, always dismissible.
  const latestScore = latestCheckIn?.calculatedScore ?? null;
  const prevScore = previousCheckIn?.calculatedScore ?? null;
  const scoreRose = latestScore != null && prevScore != null && latestScore - prevScore >= 12;
  const scoreElevated = latestScore != null && latestScore >= 55;
  const askedForSupport = !!latestCheckIn?.supportRequested;
  const nudgeReason = askedForSupport
    ? "You asked to connect with someone on your last check-in."
    : scoreElevated
    ? "Your recent check-ins have been on the heavier side."
    : scoreRose
    ? "Your last check-in showed a bit more strain than the one before."
    : null;
  const nudgeKey = `aura_nudge_dismissed_${user.id}`;
  const [nudgeDismissedFor, setNudgeDismissedFor] = useState<string>(() => {
    try {
      return localStorage.getItem(nudgeKey) || "";
    } catch {
      return "";
    }
  });
  const showNudge = !!nudgeReason && !!latestCheckIn && nudgeDismissedFor !== latestCheckIn.id;
  const dismissNudge = () => {
    if (!latestCheckIn) return;
    try {
      localStorage.setItem(nudgeKey, latestCheckIn.id);
    } catch {
      /* ignore */
    }
    setNudgeDismissedFor(latestCheckIn.id);
  };

  // Chart data
  /**
   * The trajectory, one point per check-in.
   *
   * `i` is the x-axis key, not the formatted date. Several check-ins commonly
   * fall on the same day, and a category axis keyed on "Sep 8" collapses them:
   * hovering anywhere in that band resolves to whichever point recharts
   * matched first, so the tooltip and the highlighted dot disagreed with the
   * cursor. Indices are unique by construction, and tickFormatter puts the
   * date back on the axis where a reader wants it.
   */
  const chartData = checkIns.map((c, idx) => ({
    i: idx,
    date: `Day ${idx + 1}`,
    score: c.calculatedScore ?? 50,
    stress: c.stress * 20,
    sleep: c.sleep * 20,
    timestamp: new Date(c.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }));

  const chartLabel = (i: number) => chartData[i]?.timestamp ?? "";

  /**
   * Which day's breakdown is open, plus the wiring that opens it.
   *
   * The chart quirks live in useChartDayOpener because the counsellor's view
   * of this same trajectory needs identical behaviour, and two copies of a
   * recharts workaround is two places for it to rot.
   */
  const { chartRef, openDay, setOpenDay, openDayFromChart } = useChartDayOpener(checkIns.length);

  const openDayCheckIn = openDay !== null ? checkIns[openDay] : null;

  // Lightweight session request — no calendar/table, just a message to the
  // assigned counsellor plus a notification they can act on from Messages.
  /**
   * Whether audio is actually being kept.
   *
   * Read from the saved consent rather than assumed, and defaulting to off:
   * the card should say "nothing is being kept" when we do not know, not
   * imply a store that may not exist.
   */
  const [retainsAudio, setRetainsAudio] = useState(false);

  useEffect(() => {
    if (!participantRecord?.id) return;
    let cancelled = false;
    supabaseService.consents
      .get(participantRecord.id)
      .then((prefs) => {
        if (!cancelled && prefs) setRetainsAudio(Boolean(prefs.voiceAudioRetention));
      })
      .catch(() => {
        /* off is the safe answer */
      });
    return () => {
      cancelled = true;
    };
  }, [participantRecord?.id]);

  const [sessionNote, setSessionNote] = useState("");
  const [sessionRequested, setSessionRequested] = useState(false);
  const [requestingSession, setRequestingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const handleRequestSession = async () => {
    if (!participantRecord?.id || !participantRecord.assignedWorker) return;
    setRequestingSession(true);
    setSessionError("");
    try {
      const note = sessionNote.trim();
      // send() returns null on failure instead of throwing, so the catch below
      // never fires for a message that was rejected. Without this check the
      // participant is told their counsellor was notified when nothing was
      // delivered.
      const sent = await apiService.messages.send({
        participantId: participantRecord.id,
        senderId: user.id,
        senderRole: "participant",
        body:
          "Session request. I'd like to schedule a time to talk." +
          (note ? `\n\nNote: ${note}` : ""),
      });
      if (!sent) {
        setSessionError("Could not send the request. Please check your connection and try again.");
        return;
      }
      notificationService.createNotification({
        userId: participantRecord.assignedWorker,
        participantId: participantRecord.id,
        category: "SUPPORT_REQUEST",
        severity: "YELLOW",
        title: "Session requested",
        message:
          `${user.name || "A participant"} asked to schedule a session.` +
          (note ? ` "${note}"` : ""),
        filterCategory: "support_request",
        actionLabel: "Open messages",
        actionView: "messages",
        actionParticipantId: participantRecord.id,
      });
      setSessionRequested(true);
      setSessionNote("");
    } catch (e: any) {
      setSessionError(e?.message || "Could not send the request. Please try again.");
    } finally {
      setRequestingSession(false);
    }
  };

  const handleSavePref = async () => {
    // Persist to Supabase Auth metadata + the participant row, not just
    // localStorage, so counsellors and the assignment engine see it too.
    await authService.updateSupportPreference(supportPref);
    if (participantRecord?.id) {
      apiService.participants
        .update(participantRecord.id, { preferredSupport: supportPref })
        .catch((e: any) => console.warn("[Profile] preferredSupport persist:", e?.message));
    }
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  const handleToggleConsent = () => {
    const nextState = !user.consentGiven;
    onUpdateConsent(nextState);
  };

  const handleResetData = () => {
    participantStore.resetParticipantData(user.id);
    setShowResetConfirm(false);
    if (onDataReset) {
      onDataReset();
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 mt-4">
      {/* Welcome Banner */}
      <div className="bg-[#463D36] text-white rounded-[2rem] p-8 sm:p-12 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6 border-none">
        
        <div className="space-y-4 z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 text-[#EFE8E2] text-[10px] font-medium tracking-wide">
            <span>Participant Personal Space • Anonymous ID: {user.id}</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-white mt-2">
            Welcome, <span data-no-translate>{user.name}</span>
          </h1>
          
          <p className="text-[#EFE8E2]/90 text-sm max-w-xl leading-relaxed font-sans">
            Track your personal wellbeing reflections over time. Your responses are voluntary, 
            dignity-first, and never replace medical care.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 z-10 shrink-0 md:pb-2">
          <button
            onClick={onStartCheckin}
            className="px-6 py-3 rounded-full bg-[#E5D7CC] text-[#3C3530] font-bold text-sm hover:bg-white transition-all shadow-sm flex items-center justify-center space-x-2 active:scale-95 cursor-pointer border border-transparent"
          >
            <Plus size={16} />
            <span>{count === 0 ? "Start First Check-in" : "Start Daily Check-in"}</span>
          </button>
          <button
            onClick={onOpenEmergency}
            className="px-6 py-3 rounded-full bg-transparent hover:bg-white/5 border border-white/20 text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LifeBuoy size={16} className="text-[#A55D25]" />
            <span>Crisis Support</span>
          </button>
        </div>
      </div>

      {/* The participant's own coping kit. Placed above the charts because the
          moment it matters is the moment someone opens this page struggling,
          and a list of what helps them should not sit below a graph. */}
      <FirstAidKitCard
        user={user}
        onSave={(kit: FirstAidKit) => {
          void authService.updateFirstAidKit(kit);
        }}
      />

      {/* Gentle check-in nudge — only when recent signals warrant it */}
      {showNudge && (
        <div className="rounded-3xl border border-[#DBC3B2]/50 bg-[#FFF6EC] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#DBC3B2]/40 text-[#8A5A2B] flex items-center justify-center shrink-0">
            <Heart size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#3C3530]">Would you like to talk to someone today?</h3>
            <p className="text-xs text-[#6B635C] mt-0.5 leading-relaxed">
              {nudgeReason} There's no pressure. Reaching out is always your choice.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onOpenMessages && (
              <button
                onClick={onOpenMessages}
                className="px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer"
              >
                Message my counselor
              </button>
            )}
            <button
              onClick={onOpenEmergency}
              className="px-4 py-2 rounded-xl bg-white border border-[#DBC3B2]/60 text-[#5A5049] text-xs font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer"
            >
              Crisis lines
            </button>
            <button
              onClick={dismissNudge}
              className="px-3 py-2 rounded-xl text-[#6B635C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Trajectory & Metrics Grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left 8 Cols. A stack, not a single card: the graph alone left most of
            this column empty while the right rail ran on for another screen. */}
        <div className="lg:col-span-8 space-y-8">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EFE8E2]">
            <div>
              <h3 className="text-xl font-bold text-[#3C3530]">Wellbeing Indicator Trajectory</h3>
              <p className="text-xs text-[#68625D]">
                {count === 0
                  ? "Complete your first check-in to begin building your wellbeing history."
                  : count === 1
                  ? "Your first wellbeing signal has been recorded. More check-ins are needed before a trend can be identified."
                  : count === 2
                  ? "Early comparison: More check-ins will help identify a clearer pattern."
                  : "Visualizing multi-day distress risk scores (0–100 score; lower is calmer)"}
              </p>
            </div>
            <span className="text-xs font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-3 py-1 rounded-full self-start">
              {count === 0 ? "0 Check-ins Logged" : count === 1 ? "1 Check-in Logged" : `${count} Check-ins Logged`}
            </span>
          </div>

          {/* Conditional Display based on Check-in Count */}
          {count === 0 ? (
            <EmptyWellbeingState onStartCheckin={onStartCheckin} />
          ) : count === 1 ? (
            <div className="py-8 px-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-4 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#5A5049] uppercase tracking-wider">
                  Baseline Established
                </span>
                <h4 className="text-xl font-black text-[#3C3530]">
                  First Reflection Logged
                </h4>
                <p className="text-xs text-[#68625D] max-w-md">
                  First score recorded: <strong>{latestCheckIn?.calculatedScore}/100</strong>. After a few more check-ins, this page can show how it has moved.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#EFE8E2] text-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#68625D] block">
                  Today's Signal
                </span>
                <div className="text-3xl font-black text-[#5A5049]">
                  {latestCheckIn?.calculatedScore}
                  <span className="text-xs text-[#68625D] font-normal">/100</span>
                </div>
                <span className="text-[10px] text-[#6B635C] font-semibold block mt-0.5">
                  Single Check-in
                </span>
              </div>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full pt-2" ref={chartRef}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  style={{ cursor: "pointer" }}
                  onClick={openDayFromChart}
                  /* Touch does not go through onClick. A tap sets the active
                     point (the tooltip proves it), so the same opener is
                     hung on touch end, where that index is available. */
                  onTouchEnd={openDayFromChart}
                >
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A5049" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#5A5049" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE8E2" vertical={false} />
                  <XAxis
                    dataKey="i"
                    tickFormatter={chartLabel}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    stroke="#68625D"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 100]} stroke="#68625D" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#3C3530",
                      borderRadius: "1rem",
                      color: "#fff",
                      border: "1px solid #3F4E4E",
                      fontSize: "12px",
                      padding: "8px 12px"
                    }}
                    // Recharts colours the value with the series stroke, which is
                    // #5A5049 here and all but invisible on this dark tooltip
                    // (1.25:1). The reading is the point of hovering, so it is
                    // set explicitly rather than inherited.
                    itemStyle={{ color: "#F5EDE1" }}
                    labelStyle={{ color: "#FFFFFF", fontWeight: 600 }}
                    formatter={(val: number) => [`${val}/100`, "Distress Indicator"]}
                    labelFormatter={(i: number) => chartLabel(i)}
                  />
                  {/* Every check-in gets a visible point, not only the hovered
                      one. Without `dot` the line is a shape with no readable
                      readings on it, and a reader cannot tell how many
                      check-ins it is drawn from. activeDot is the one under
                      the cursor, ringed in white so it reads against both the
                      line and the fill. */}
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#5A5049"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#scoreGradient)"
                    dot={{ r: 2.5, fill: "#5A5049", strokeWidth: 0, className: SCORE_DOT_CLASS }}
                    activeDot={{ r: 6, fill: "#5A5049", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {count >= 2 && (
            <div className="space-y-2">
              <p className="text-xs text-[#6B635C]">
                Tap any point on the line to see that day&rsquo;s reading and how
                it was worked out.
              </p>
              {/* The same days, reachable without a mouse.
                  A chart is a canvas: it cannot be tabbed to and a screen
                  reader finds nothing in it. These buttons carry the identical
                  action, stay out of the layout until focused, and then appear
                  where the focus ring is — so a keyboard user sees where they
                  are instead of chasing an invisible target. */}
              <div className="flex flex-wrap gap-1.5">
                <h4 className="sr-only" id="day-list-label">
                  Open a single day&rsquo;s breakdown
                </h4>
                <ul aria-labelledby="day-list-label" className="flex flex-wrap gap-1.5">
                  {chartData.map((d) => (
                    <li key={d.i}>
                      <button
                        onClick={() => setOpenDay(d.i)}
                        className="sr-only focus:not-sr-only focus:rounded-full focus:border focus:border-[#DBC3B2] focus:bg-[#FDF9F5] focus:px-3 focus:py-1.5 focus:text-xs focus:font-bold focus:text-[#5A5049]"
                      >
                        {d.timestamp} — indicator {d.score} out of 100
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Trend Interpretation Note */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start space-x-3 text-xs text-[#6B635C]">
            <Activity size={18} className="text-[#5A5049] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#3C3530]">How to read this:</strong> A higher indicator score reflects elevated self-reported stress, insomnia, or environmental insecurity. Significant multi-day increases alert your assigned counselor to reach out.
            </div>
          </div>
        </div>

        {/* Talking out loud, given the room it deserves. It was a thumbnail in
            the rail, below six other things — which is not where you put the
            way in for someone who is finding it hard to write. */}
        {onOpenVoiceCompanion && (
          <section className="relative overflow-hidden rounded-3xl border border-[#E3C9A8] bg-linear-to-br from-[#FFF4E6] via-[#FDEAD6] to-[#F6DCC2] p-7 sm:p-9 shadow-xs">
            {/* Soft echo of the listening orb on the voice page itself. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#E8B27A]/25 blur-2xl"
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
              <div className="flex items-center justify-center h-24 w-24 rounded-full bg-[#A85D2E] text-white shadow-lg shadow-[#A85D2E]/25 shrink-0">
                <Mic size={36} />
              </div>

              <div className="flex-1 min-w-0 space-y-3.5">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#3C3530]">
                    Talk it through, out loud
                  </h3>
                  <p className="text-sm text-[#6B5B4C] mt-1.5 max-w-xl leading-relaxed">
                    Some days writing is the hard part. Speak instead and it answers back.
                    interrupt it, pause, or stop whenever you want. It listens for as long
                    as you need, and there is nothing you have to get right.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {["English", "\u0939\u093f\u0928\u094d\u0926\u0940", "\u092e\u0930\u093e\u0920\u0940"].map((l) => (
                    <span
                      key={l}
                      className="px-2.5 py-1 rounded-full bg-white/70 border border-[#E3C9A8] text-[11px] font-bold text-[#8A5A2B]"
                    >
                      {l}
                    </span>
                  ))}
                </div>

                {/* The three things worth knowing before you start, not after. */}
                <p className="text-[11px] text-[#6B635C] font-semibold">
                  Not a person &middot; Never read by staff &middot; Does not change your score
                </p>
              </div>

              <button
                onClick={onOpenVoiceCompanion}
                className="shrink-0 px-6 py-3.5 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors cursor-pointer shadow-sm"
              >
                Start talking
              </button>
            </div>
          </section>
        )}

        {/* The WHO-5, offered only on the days the evaluation protocol asks
            for: baseline, day 7, day 30. It is not shown otherwise and there
            is no way to open it early, which is the point rather than an
            omission. Five questions that arrive whenever someone feels like
            tapping them get answered carelessly, and a carelessly answered
            instrument still enters the validity study as real data, where it
            quietly wrecks the correlation it was collected to measure. */}
        {onOpenWellbeingIndex && who5Status?.due && (
          <section className="rounded-3xl border border-[#E0D7CE] bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <span className="flex items-center justify-center h-14 w-14 rounded-2xl bg-[#FBF3EC] text-[#A55D25] shrink-0">
                <ClipboardList size={24} aria-hidden="true" />
              </span>

              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-bold text-[#3C3530]">
                  {who5Status.administeredCount === 0
                    ? "Five questions, once, to check our work"
                    : "Time for those five questions again"}
                </h3>
                <p className="text-sm text-[#6B5B4C] leading-relaxed max-w-xl">
                  {who5Status.administeredCount === 0
                    ? "They come from the World Health Organization, not from us. Answering them lets us check our own wellbeing number against something that has actually been tested. About a minute, and it doesn't change your score."
                    : "Same five as before. Answering them a second time is what turns one reading into something we can compare, which is the only way to tell whether our number tracks anything real."}
                </p>
              </div>

              <button
                onClick={onOpenWellbeingIndex}
                className="shrink-0 px-6 py-3 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors cursor-pointer"
              >
                {who5Status.administeredCount === 0 ? "Answer them" : "Answer again"}
              </button>
            </div>
          </section>
        )}

        {/* Reading. Offered without a prompt or a nudge, because the person
            most likely to open it is not in a state to be led anywhere, and
            because nothing about what someone reads is recorded. */}
        {onOpenWhatToExpect && (
          <section className="rounded-3xl border border-[#E0D7CE] bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <span className="flex items-center justify-center h-14 w-14 rounded-2xl bg-[#F1EBE5] text-[#7A6A5A] shrink-0">
                <BookOpen size={24} aria-hidden="true" />
              </span>

              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-bold text-[#3C3530]">What to expect</h3>
                <p className="text-sm text-[#6B5B4C] leading-relaxed max-w-xl">
                  Four short pieces: why you might be feeling like this, what a counsellor here can
                  and can't do, how the court process usually goes, and what we do with what you
                  tell us. Nobody is told what you read.
                </p>
              </div>

              <button
                onClick={onOpenWhatToExpect}
                className="shrink-0 px-6 py-3 rounded-2xl border border-[#E0D7CE] text-[#5A5049] font-semibold text-sm hover:bg-[#FAF7F4] transition-colors cursor-pointer"
              >
                Have a read
              </button>
            </div>
          </section>
        )}

        {/* Anything a counsellor has set for this person, and the advice that
            came back. Moved out of the rail: questions and written advice are
            reading, and reading wants the wide column. */}
        {participantRecord?.id && <ParticipantTestCard participantId={participantRecord.id} />}
        </div>

        {/* Right 4 Cols: Summary Stats & Latest Submission */}
        <div className="lg:col-span-4 space-y-6">
          {/* Latest Signal Card */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
              Latest Reflection Summary
            </h3>

            {latestCheckIn ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#6B635C]">Distress Indicator</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-[#3C3530]">
                      {latestCheckIn.calculatedScore ?? 0}
                    </span>
                    <span className="text-xs font-bold text-[#68625D]">/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EFE8E2] text-center">
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Stress</span>
                    <span className="text-sm font-black text-[#3C3530]">{latestCheckIn.stress}/5</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Sleep</span>
                    <span className="text-sm font-black text-[#3C3530]">{latestCheckIn.sleep}/5</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Safety</span>
                    <span className="text-xs font-black text-[#3C3530] truncate">{latestCheckIn.safety}</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#68625D] flex items-center space-x-1.5 pt-1">
                  <Clock size={13} className="text-[#68625D]" />
                  <span>Submitted {new Date(latestCheckIn.timestamp).toLocaleDateString()}</span>
                </div>

                {onViewResults && (
                  <button
                    onClick={onViewResults}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#5A5049]/15 hover:bg-[#5A5049]/25 text-[#5A5049] font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <span>View AI Analysis & Breakdown</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#6B635C]">Distress Indicator</span>
                  <span className="text-sm font-bold text-[#68625D] bg-[#FDF9F5] px-2.5 py-1 rounded-lg border border-[#EFE8E2]">
                    Not available yet
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EFE8E2] text-center">
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Stress</span>
                    <span className="text-sm font-bold text-[#68625D]">—</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Sleep</span>
                    <span className="text-sm font-bold text-[#68625D]">—</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-[#68625D] block">Safety</span>
                    <span className="text-sm font-bold text-[#68625D]">—</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#68625D] pt-1">
                  No reflection has been submitted yet. Complete your first check-in to generate a wellbeing signal.
                </p>
              </div>
            )}
          </div>

          {/* Support Preferences Card */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
              Support Preference
            </h3>

            <div className="space-y-3">
              <select
                value={supportPref}
                onChange={(e) => setSupportPref(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#EFE8E2] bg-white text-xs font-medium text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none cursor-pointer"
              >
                <option value="In-app support information">In-app support information</option>
                <option value="Human counselor">Human counselor / therapist</option>
                {/* Someone who chose one of the retired options before they were
                    removed still has it saved. Without an option to match, the
                    browser renders the first one instead — telling that person
                    their support preference is something they never picked, in
                    the one place they go to control it. Shown, disabled, until
                    they choose again. */}
                {!SUPPORT_PREFERENCES.includes(supportPref) && (
                  <option value={supportPref} disabled>
                    {supportPref} (no longer offered, please choose again)
                  </option>
                )}
              </select>

              <button
                onClick={handleSavePref}
                className="w-full py-2.5 rounded-xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-colors cursor-pointer"
              >
                {prefSaved ? "✓ Preference Saved" : "Update Preference"}
              </button>
            </div>
          </div>

          {/* Your counsellor — choose or change, no approval and no reason needed */}
          {onOpenChooseCounsellor && (
            <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
              {counsellorName ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#EFE8E2] text-[#5A5049] flex items-center justify-center text-xs font-black shrink-0">
                    {counsellorName
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-[#3C3530] truncate" data-no-translate>
                      {counsellorName}
                    </h3>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#68625D]">
                      Your counsellor
                    </p>
                  </div>
                </div>
              ) : (
                <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
                  Your Counsellor
                </h3>
              )}
              <p className="text-xs text-[#6B635C] leading-relaxed">
                {participantRecord?.assignedWorker
                  ? "You can change to a different counsellor whenever you want. You do not need to give a reason, and nobody is told why."
                  : "You can pick a counsellor yourself, or leave it and your support team will assign someone."}
              </p>
              <button
                onClick={onOpenChooseCounsellor}
                className="w-full py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] font-bold text-xs hover:bg-[#FDF9F5] transition-colors cursor-pointer"
              >
                {participantRecord?.assignedWorker ? "Change my counsellor" : "Choose a counsellor"}
              </button>
            </div>
          )}

          {/* Request a session — only when a counsellor is assigned */}
          {participantRecord?.assignedWorker && (
            <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="text-[#8A4A20]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
                  Request a Session
                </h3>
              </div>

              {sessionRequested ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#5E7148]">
                    ✓ Your counselor has been notified.
                  </p>
                  <p className="text-[11px] text-[#6B635C] leading-relaxed">
                    They&rsquo;ll reply in Messages to arrange a time. You can send another
                    request whenever you need to.
                  </p>
                  <button
                    onClick={() => setSessionRequested(false)}
                    className="text-[11px] font-bold text-[#8A4A20] hover:underline cursor-pointer"
                  >
                    Request another
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#6B635C] leading-relaxed">
                    Ask your assigned counselor to set up a time to talk. Add a note if
                    there&rsquo;s something specific you&rsquo;d like to cover.
                  </p>
                  <textarea
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    rows={2}
                    placeholder="Optional: anything you'd like them to know first"
                    className="w-full p-3 rounded-xl border border-[#EFE8E2] bg-white text-xs text-[#3C3530] focus:ring-2 focus:ring-[#8FAF8B] focus:outline-none resize-none"
                  />
                  {sessionError && (
                    <p className="text-[11px] text-[#8A3F35]">{sessionError}</p>
                  )}
                  <button
                    onClick={handleRequestSession}
                    disabled={requestingSession}
                    className="w-full py-2.5 rounded-xl bg-[#A85D2E] text-white font-bold text-xs hover:bg-[#8A4A20] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {requestingSession ? "Sending…" : "Request a Session"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Recordings the person chose to keep. Sits here rather than in a
              page of its own because it is small, and because this column is
              where the other "things about me" already live. */}
          <MyRecordings
            retentionOn={retainsAudio}
            onOpenConsent={onOpenConsent}
          />
        </div>
      </div>

      {/* Personalized AI Recommendations Section (When check-ins exist) */}
      {latestAnalysis && latestAnalysis.recommendations && latestAnalysis.recommendations.length > 0 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EFE8E2]">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-[#3C3530]">What might help right now</h3>
              </div>
              <p className="text-xs text-[#68625D] mt-1">
                Generated from your latest check-in reflection responses.
              </p>
            </div>

            {onViewResults && (
              <button
                onClick={onViewResults}
                className="text-xs font-bold text-[#5A5049] hover:bg-[#DBC3B2]/20 px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 border border-[#DBC3B2]/40 cursor-pointer self-start sm:self-auto"
              >
                <span>View Full Results Screen</span>
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {latestAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5A5049] bg-[#DBC3B2]/20 px-2 py-0.5 rounded-md">
                    {rec.category.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-bold text-[#68625D]">
                    {rec.priority} Priority
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#3C3530]">{rec.title}</h4>
                <p className="text-[11px] text-[#6B635C] leading-relaxed line-clamp-3">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#DBC3B2]/15 border border-[#5A5049]/20 flex items-start space-x-3 text-xs text-[#3C3530]">
            <Heart size={16} className="text-[#A55D25] shrink-0 mt-0.5" />
            <div className="italic">
              "{latestAnalysis.supportiveMessage}"
            </div>
          </div>
        </div>
      )}

      {/* Privacy, Consent & Account Settings */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EFE8E2]">
          <div>
            <h3 className="text-xl font-bold text-[#3C3530]">Privacy, Consent & Data Rights</h3>
            <p className="text-xs text-[#68625D] mt-1">
              You retain full control over your participation in this demonstration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportData}
                className="text-xs font-bold text-[#5A5049] bg-[#DBC3B2]/20 hover:bg-[#DBC3B2]/30 border border-[#DBC3B2]/40 px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                title="Download a readable copy of all your data (open in any browser, or print / save as PDF)"
              >
                <Download size={13} />
                <span>Download My Data</span>
              </button>
              <button
                onClick={handleExportDataJson}
                className="text-[10px] font-bold text-[#6B635C] hover:text-[#3C3530] underline underline-offset-2 cursor-pointer"
                title="Download the same data as a raw JSON file"
              >
                JSON
              </button>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs font-bold text-[#6B635C] hover:text-[#3C3530] bg-[#FDF9F5] hover:bg-[#EFE8E2] border border-[#EFE8E2] px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Reset check-in reflections for this participant"
            >
              <RotateCcw size={13} />
              <span>Reset My Check-in Data</span>
            </button>
            <button
              onClick={onOpenPrivacy}
              className="text-xs font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-3.5 py-2 rounded-xl hover:bg-[#DBC3B2]/30 transition-colors cursor-pointer"
            >
              Ethics & Architecture
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-bold text-[#A55D25] hover:bg-[#A55D25]/10 border border-[#A55D25]/30 px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <LogOut size={13} />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        <ConfirmDialog
          isOpen={showResetConfirm}
          title="Reset Check-in History"
          message={`Are you sure you want to reset your check-in history to zero? This clears all reflections for ${user.id}.`}
          confirmText="Confirm Reset"
          onConfirm={handleResetData}
          onCancel={() => setShowResetConfirm(false)}
        />

        <div className="grid sm:grid-cols-2 gap-4 text-xs text-[#6B635C]">
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#3C3530]">Voluntary Participation Status</span>
              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                user.consentGiven ? "bg-[#DBC3B2]/30 text-[#5A5049]" : "bg-[#A55D25]/20 text-[#A55D25]"
              }`}>
                {user.consentGiven ? "Active Consent" : "Consent Withdrawn"}
              </span>
            </div>
            <p className="text-[#68625D]">
              You can withdraw your consent at any time without penalty.
            </p>
            <button
              onClick={handleToggleConsent}
              className="text-xs font-bold text-[#5A5049] hover:underline pt-1 block cursor-pointer"
            >
              {user.consentGiven ? "Withdraw Consent & Pause Reflections" : "Reactivate Voluntary Consent"}
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2">
            <span className="font-bold text-[#3C3530] block">Assigned Support Organization</span>
            {/* The coordinator used to be the literal string "Sarah Jenkins,
                MSW" regardless of who this person's counsellor actually was.
                Once someone can choose their own, a hardcoded name here
                contradicts the card above and reads as the switch not having
                worked. Name whoever is really assigned, or say nobody is. */}
            <p className="text-[#68625D]">
              AURA Humanitarian Demo Unit
              {counsellorName ? (
                <>
                  {" • Case Coordinator: "}
                  <span data-no-translate>{counsellorName}</span>
                </>
              ) : (
                " • No counsellor assigned yet"
              )}
            </p>
            <p className="text-[11px] text-[#5A5049] font-semibold">
              Encrypted Synthetic Store • Non-diagnostic
            </p>
          </div>

          {/* Emergency / Trusted Contact — optional, editable, always removable */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#3C3530] flex items-center gap-1.5">
                <Phone size={13} className="text-[#5A5049]" /> Emergency / Trusted Contact
              </span>
              {!ecEditing && (
                <button
                  onClick={() => setEcEditing(true)}
                  className="text-[11px] font-bold text-[#5A5049] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Pencil size={11} /> {ecValue ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {ecEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={ecValue}
                  onChange={(e) => setEcValue(e.target.value)}
                  placeholder="Name and how to reach a person you trust (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-[#EFE8E2] bg-white text-xs text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEmergencyContact}
                    className="text-[11px] font-bold text-white bg-[#3C3530] hover:bg-[#3F4E4E] px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEcValue(user.emergencyContact || ""); setEcEditing(false); }}
                    className="text-[11px] font-bold text-[#6B635C] hover:text-[#3C3530] px-2 py-1.5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {ecValue && (
                    <button
                      onClick={() => { setEcValue(""); }}
                      className="text-[11px] font-bold text-[#A55D25] hover:underline px-2 py-1.5 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[#68625D]">
                {ecValue
                  ? ecValue
                  : "None on file. Add a trusted person only if it is safe for you to name one."}
              </p>
            )}
            {ecSaved && <p className="text-[11px] font-bold text-[#2F6B4F]">Saved.</p>}
          </div>
        </div>
      </div>

      {/* A day opened from the trajectory. Rendered last so it sits above the
          page rather than inside the card it was opened from. */}
      {openDayCheckIn && openDay !== null && (
        <CheckInDayPanel
          checkIn={openDayCheckIn}
          previous={openDay > 0 ? checkIns[openDay - 1] : null}
          history={checkIns.slice(0, openDay + 1)}
          chartScore={chartData[openDay]?.score ?? openDayCheckIn.calculatedScore ?? 0}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
};
