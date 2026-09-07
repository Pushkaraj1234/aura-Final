import React, { useEffect, useState } from "react";
import { Users, UserCog, ClipboardList, UserX, Gauge, AlertTriangle, Globe2, Siren } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { supabaseService } from "../../services/supabaseService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, Badge } from "../ui";

interface Escalation {
  id: string;
  participantId: string;
  participantName: string;
  severity: string;
  category: string | null;
  title: string | null;
  reason: string | null;
  status: string;
  score: number | null;
  assignedWorkerName: string | null;
  createdAt: string;
}

interface RegionalContext {
  region: string;
  deaths_estimate: number;
  year: number;
  source: string;
  source_url: string;
  note: string | null;
}

interface DashboardData {
  totalUsers: number;
  totalWorkers: number;
  pendingVerifications: number;
  unassignedUsers: number;
  averageCaseload: number;
  flaggedUnassignedUsers: { id: string; name?: string; status: string; assigned_worker: string | null }[];
}

const SummaryCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; tone?: string }> = ({
  icon: Icon,
  label,
  value,
  tone = "#3C3530",
}) => (
  <Card className="p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tone}14`, color: tone }}>
        <Icon size={18} />
      </div>
    </div>
    <p className="text-2xl font-black text-[#3C3530]">{value}</p>
    <p className="text-xs text-[#7F8C8D] font-semibold mt-0.5">{label}</p>
  </Card>
);

export const OverviewTab: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regionalContext, setRegionalContext] = useState<RegionalContext[]>([]);
  const [escalations, setEscalations] = useState<Escalation[] | null>(null);

  useEffect(() => {
    adminApiService
      .getDashboard()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load dashboard."))
      .finally(() => setLoading(false));
    supabaseService.regionalContext.getAll().then(setRegionalContext);
    adminApiService
      .getEscalations()
      .then(setEscalations)
      .catch(() => setEscalations([]));
  }, []);

  return (
    <div>
      <PageHeader title="Oversight Dashboard" subtitle="Platform-wide summary of users, counselors, and verification status." />
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner label="Loading dashboard..." />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <SummaryCard icon={Users} label="Total Users" value={data.totalUsers} />
            <SummaryCard icon={UserCog} label="Counselors" value={data.totalWorkers} tone="#3F4E4E" />
            <SummaryCard
              icon={ClipboardList}
              label="Pending Verifications"
              value={data.pendingVerifications}
              tone="#A55D25"
            />
            <SummaryCard icon={UserX} label="Unassigned Users" value={data.unassignedUsers} tone="#B23A2E" />
            <SummaryCard icon={Gauge} label="Average Caseload" value={data.averageCaseload} tone="#2F6B4F" />
          </div>

          <Card className="p-6 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Siren size={16} className="text-[#B23A2E]" />
              <h3 className="text-sm font-black text-[#3C3530] uppercase tracking-wider">
                Active Escalations — Platform-Wide
              </h3>
            </div>
            <p className="text-xs text-[#7F8C8D] mb-4">
              Every open high-severity or escalated alert across all participants, whoever they are assigned to.
              Oversight only — follow up through the assigned counselor, not directly on the case.
            </p>
            {escalations === null ? (
              <Spinner label="Loading escalations..." />
            ) : escalations.length === 0 ? (
              <EmptyState message="No open high-severity or escalated alerts across the platform right now." />
            ) : (
              <div className="space-y-2">
                {escalations.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          tone={
                            e.severity === "RED" || e.severity === "urgent"
                              ? "bad"
                              : e.severity === "ORANGE" || e.severity === "elevated"
                              ? "warn"
                              : "neutral"
                          }
                        >
                          {e.severity}
                        </Badge>
                        <span className="text-sm font-bold text-[#3C3530] truncate">{e.participantName}</span>
                        {typeof e.score === "number" && (
                          <span className="text-xs font-semibold text-[#7F8C8D]">{e.score}/100</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5A5049] mt-0.5">{e.title || e.reason}</p>
                      <p className="text-[11px] text-[#7F8C8D] mt-0.5">
                        {e.assignedWorkerName ? `Assigned to ${e.assignedWorkerName}` : "Unassigned"} ·{" "}
                        {new Date(e.createdAt).toLocaleDateString()} · status {e.status}
                      </p>
                    </div>
                    {!e.assignedWorkerName && (
                      <button
                        onClick={() => onNavigate("assignments")}
                        className="text-xs font-bold text-[#3C3530] hover:underline cursor-pointer shrink-0"
                      >
                        Assign →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-[#A55D25]" />
              <h3 className="text-sm font-black text-[#3C3530] uppercase tracking-wider">
                Flagged &amp; Unassigned
              </h3>
            </div>
            <p className="text-xs text-[#7F8C8D] mb-4">
              Users with high/escalating distress indicators who do not currently have an assigned counselor.
              Assign them promptly from the User Assignments tab.
            </p>
            {data.flaggedUnassignedUsers.length === 0 ? (
              <EmptyState message="No flagged users are currently unassigned. Everything at risk is covered." />
            ) : (
              <div className="space-y-2">
                {data.flaggedUnassignedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#3C3530]">{u.name || u.id}</span>
                      <Badge tone={u.status === "Urgent safety signal" ? "bad" : "warn"}>{u.status}</Badge>
                    </div>
                    <button
                      onClick={() => onNavigate("assignments")}
                      className="text-xs font-bold text-[#3C3530] hover:underline cursor-pointer"
                    >
                      Assign a worker →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {regionalContext.length > 0 && (
            <Card className="p-6 mt-6">
              <div className="flex items-center gap-2 mb-1">
                <Globe2 size={16} className="text-[#5A5049]" />
                <h3 className="text-sm font-black text-[#3C3530] uppercase tracking-wider">
                  Regional Humanitarian Context
                </h3>
              </div>
              <p className="text-xs text-[#7F8C8D] mb-4">
                Real, publicly published, non-identifying conflict statistics for the broad regions your caseload
                spans — background context only, not derived from and not linked to any individual user.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {regionalContext.map((r) => (
                  <div key={r.region} className="p-4 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <p className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wider">{r.region}</p>
                    <p className="text-2xl font-black text-[#3C3530] mt-1">{r.deaths_estimate.toLocaleString()}</p>
                    <p className="text-[11px] text-[#7F8C8D] mt-0.5">Conflict-related deaths, {r.year} (full year)</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#B9B0A6] mt-4">
                Source:{" "}
                <a
                  href={regionalContext[0].source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[#5A5049]"
                >
                  {regionalContext[0].source}
                </a>
              </p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};
