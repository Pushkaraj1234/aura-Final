import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText,
  Shield,
  Search,
  Filter,
  UserCheck,
  Eye,
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
  Info,
  Calendar,
  Activity,
  Zap,
  Radio,
  RefreshCw,
  AlertTriangle,
  HeartHandshake,
  User,
  SlidersHorizontal
} from "lucide-react";
import { AuditEvent, AuditCategory, Participant, User as AppUser } from "../types";
import { auditService } from "../services/auditService";
import { participantStore } from "../services/participantStore";

// Resolve a participant id to a readable name (id kept only as a fallback).
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const participantLabel = (id: string): string => {
  const p = participantStore.getAllParticipants().find((x) => x.id === id);
  if (p?.name) return p.name;
  return isUuid(id) ? `Participant ${id.slice(0, 8)}` : id;
};

interface Props {
  // A counselor only sees audit events for their own caseload plus their own
  // activity; without a user (or for admins) the full platform trail is shown.
  currentUser?: AppUser | null;
  participants?: Participant[];
}

export const AuditLog: React.FC<Props> = ({ currentUser, participants = [] }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());
  const [isTestTriggering, setIsTestTriggering] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);

  // Subscribe to real-time audit updates
  useEffect(() => {
    // Initial fetch
    const initialEvents = auditService.getAuditEvents();
    setEvents(initialEvents);
    prevCountRef.current = initialEvents.length;

    // Real-time subscription
    const unsubscribe = auditService.subscribeToAuditEvents((newEvent) => {
      const allEvents = auditService.getAuditEvents();
      if (newEvent) {
        setNewlyArrivedIds(new Set([newEvent.id]));
        setTimeout(() => {
          setNewlyArrivedIds(new Set());
        }, 3500);
      }
      prevCountRef.current = allEvents.length;
      setEvents(allEvents);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleTriggerTestEvent = () => {
    if (isTestTriggering) return;
    setIsTestTriggering(true);

    auditService.recordAuditEvent({
      actorId: "SW-001",
      actorRole: "SUPPORT_WORKER",
      actorName: "Dr. Sarah Jenkins, MSW",
      participantId: "P-1042",
      action: "MANUAL_AUDIT_VERIFICATION",
      category: "SUPPORT",
      description: "Counselor verified real-time audit trail latency and integrity.",
      severity: "INFO"
    });

    setTimeout(() => {
      setIsTestTriggering(false);
    }, 600);
  };

  // Caseload scoping — a counselor may only inspect audit events that concern a
  // participant assigned to them, or actions they performed themselves. Anything
  // about another counselor's caseload (or another participant's own activity)
  // is withheld; the platform-wide trail lives in the admin console.
  const isCounselor = currentUser?.role === "support_worker";
  const myParticipantIds = useMemo(() => {
    const s = new Set<string>();
    if (isCounselor && currentUser) {
      participants.forEach((p) => {
        if (p.assignedWorker && p.assignedWorker === currentUser.id) s.add(p.id);
      });
    }
    return s;
  }, [participants, isCounselor, currentUser]);

  const inMyScope = (l: AuditEvent): boolean => {
    if (!isCounselor || !currentUser) return true;
    // An action this counsellor performed, matched by their real account id.
    if (l.actorId && l.actorId === currentUser.id) return true;
    // Any event about a participant currently in their caseload.
    if (l.participantId && myParticipantIds.has(l.participantId)) return true;
    // Deliberately no actor-name matching: legacy rows carry placeholder names
    // ("Counselor", "Dr. Sarah Jenkins, MSW") that don't identify the real
    // actor, so trusting them leaks other counsellors' actions.
    return false;
  };

  const scopedEvents = events.filter(inMyScope);

  const filtered = scopedEvents.filter((l) => {
    const matchesCat = categoryFilter === "all" || l.category === categoryFilter;
    const matchesRole = roleFilter === "all" || l.actorRole === roleFilter;
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (l.actorName && l.actorName.toLowerCase().includes(query)) ||
      (l.actorId && l.actorId.toLowerCase().includes(query)) ||
      (l.participantId && l.participantId.toLowerCase().includes(query)) ||
      (l.action && l.action.toLowerCase().includes(query)) ||
      (l.description && l.description.toLowerCase().includes(query)) ||
      (l.details && l.details.toLowerCase().includes(query));
    return matchesCat && matchesRole && matchesSearch;
  });

  const getCategoryBadge = (cat: AuditCategory | string) => {
    switch (cat) {
      case "CHECK_IN":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "ANALYSIS":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "ALERT":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "SUPPORT":
      case "review":
        return "bg-[#5A5049]/15 text-[#5A5049] border-[#5A5049]/30";
      case "FOLLOW_UP":
      case "intervention":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SAFETY":
        return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      case "NOTIFICATION":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "AUTH":
      case "access":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "PROFILE":
      case "status_change":
        return "bg-amber-100/60 text-amber-900 border-amber-200";
      default:
        return "bg-[#FDF9F5] text-[#7A726C] border-[#EFE8E2]";
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPPORT_WORKER":
        return "bg-[#5A5049]/10 text-[#5A5049]";
      case "PARTICIPANT":
        return "bg-emerald-50 text-emerald-700";
      case "SYSTEM":
        return "bg-slate-100 text-slate-600";
      case "ADMIN":
        return "bg-purple-50 text-purple-700";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, " ");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Accountability & Compliance
            </span>
            {/* Live Indicator Requirement */}
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>● Live Audit Stream</span>
            </div>
            <span className="text-xs text-[#7F8C8D] font-mono hidden sm:inline">
              Immutable Access Records
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#3C3530] mt-1.5 tracking-tight">
            Counselor Audit Log & Access Trail
          </h1>
          <p className="text-sm text-[#7A726C] max-w-3xl mt-1 leading-relaxed">
            Every view, evaluation, check-in, and support intervention is recorded in real time with cryptographic timestamps to guarantee ethical oversight and prevent unauthorized data access.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTriggerTestEvent}
            disabled={isTestTriggering}
            id="btn-test-audit-event"
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-[#EFE8E2] hover:bg-[#FDF9F5] text-xs font-bold text-[#5A5049] shadow-2xs hover:border-[#DBC3B2] transition-all cursor-pointer disabled:opacity-50"
            title="Create a live test audit event to verify real-time stream"
          >
            <Zap size={14} className={isTestTriggering ? "text-amber-500 animate-spin" : "text-[#5A5049]"} />
            <span>{isTestTriggering ? "Logging Event..." : "Test Live Event"}</span>
          </button>

          <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs font-bold text-[#7A726C]">
            <Activity size={14} className="text-[#5A5049]" />
            <span className="font-mono text-[#3C3530]">{scopedEvents.length}</span>
            <span className="text-[11px] text-[#7F8C8D]">Events Tracked</span>
          </div>
        </div>
      </div>

      {/* Why Audit Logs Matter Card */}
      <div className="bg-gradient-to-r from-[#3C3530] to-[#5A5049] rounded-3xl p-6 sm:p-7 text-white shadow-md space-y-3">
        <div className="flex items-center space-x-2 text-[#DBC3B2]">
          <Shield size={18} />
          <h3 className="text-lg font-black text-white">Why Audit Logs Matter in Humanitarian Tech</h3>
        </div>
        <p className="text-xs sm:text-sm text-[#EFE8E2]/90 leading-relaxed max-w-4xl">
          "Sensitive wellbeing information should only be accessed by authorized personnel, and important access or support actions must be fully auditable in real time. This ensures accountability, prevents snooping, and builds unshakeable trust with vulnerable communities."
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#DBC3B2] font-semibold">
          <span>✓ Role-Based Access Control (RBAC)</span>
          <span>✓ Real-time Inspection Trail</span>
          <span>✓ Multi-actor Attribution</span>
          <span>✓ Immediate Action Dispatch</span>
        </div>
      </div>

      {isCounselor && (
        <div className="flex items-center space-x-2 text-xs text-[#7A726C] bg-[#FDF9F5] border border-[#EFE8E2] rounded-xl px-3 py-2">
          <Lock size={14} className="text-[#5A5049] shrink-0" />
          <span>
            Scoped to your access: events for your assigned caseload and actions
            you performed. The full platform-wide trail is available to administrators.
          </span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F8C8D]" />
            <input
              type="text"
              id="input-audit-search"
              placeholder="Search action, worker, participant ID, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-xs focus:outline-none focus:border-[#5A5049] shadow-2xs"
            />
          </div>

          {/* Actor Role Filter */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            <span className="text-xs font-bold text-[#7F8C8D] whitespace-nowrap">Actor:</span>
            {[
              { id: "all", label: "All Roles" },
              { id: "SUPPORT_WORKER", label: "Counselor" },
              { id: "PARTICIPANT", label: "Participant" },
              { id: "SYSTEM", label: "AURA Engine" }
            ].map((r) => (
              <button
                key={r.id}
                id={`filter-role-${r.id}`}
                onClick={() => setRoleFilter(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === r.id
                    ? "bg-[#3C3530] text-white"
                    : "bg-white text-[#7A726C] border border-[#EFE8E2] hover:bg-[#FDF9F5]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Categories" },
            { id: "CHECK_IN", label: "Check-Ins" },
            { id: "ANALYSIS", label: "AI Signal Analysis" },
            { id: "ALERT", label: "Alerts & Reviews" },
            { id: "SUPPORT", label: "Support Interventions" },
            { id: "FOLLOW_UP", label: "Follow-Ups" },
            { id: "SAFETY", label: "Safety Protocols" },
            { id: "AUTH", label: "Auth & Sessions" },
            { id: "PROFILE", label: "Preferences & Consent" }
          ].map((tab) => (
            <button
              key={tab.id}
              id={`filter-cat-${tab.id}`}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === tab.id
                  ? "bg-[#5A5049] text-white"
                  : "bg-white text-[#7A726C] border border-[#EFE8E2] hover:bg-[#FDF9F5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="bg-white rounded-3xl border border-[#EFE8E2] divide-y divide-[#EFE8E2] shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-center justify-center mx-auto text-[#7F8C8D]">
              <FileText size={22} />
            </div>
            <h4 className="text-sm font-bold text-[#3C3530]">No audit events matching criteria</h4>
            <p className="text-xs text-[#7F8C8D] max-w-sm mx-auto">
              Try adjusting your search keywords or switching category filters. All live interactions are logged automatically.
            </p>
          </div>
        ) : (
          filtered.map((log) => {
            const isNew = newlyArrivedIds.has(log.id);
            return (
              <div
                key={log.id}
                id={`audit-row-${log.id}`}
                className={`p-5 sm:p-6 transition-all duration-500 space-y-2 ${
                  isNew
                    ? "bg-emerald-50/80 border-l-4 border-l-emerald-500 animate-pulse"
                    : "hover:bg-[#FDF9F5]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#7F8C8D]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getCategoryBadge(
                        log.category
                      )}`}
                    >
                      {formatActionName(log.action)}
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getRoleBadge(log.actorRole)}`}>
                      {log.actorRole}
                    </span>

                    {log.participantId && (
                      <span className="text-xs font-black text-[#3C3530] bg-[#EFE8E2]/60 px-2 py-0.5 rounded-md">
                        {participantLabel(log.participantId)}
                      </span>
                    )}

                    {isNew && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-bounce">
                        NEW
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[#7F8C8D]">
                    <UserCheck size={14} className="text-[#5A5049]" />
                    <span className="font-semibold text-[#3C3530]">{log.actorName || log.workerName || log.actorId}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>

                <p className="text-xs text-[#7A726C] leading-relaxed pl-1 sm:pl-2">
                  {log.description || log.details}
                </p>

                {log.details && log.description && log.details !== log.description && (
                  <div className="text-[11px] text-[#7F8C8D] bg-[#FDF9F5] p-2 rounded-lg border border-[#EFE8E2]/60 ml-1 sm:ml-2 font-mono">
                    {log.details}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default AuditLog;
