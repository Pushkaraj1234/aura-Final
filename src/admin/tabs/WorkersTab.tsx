import React, { useEffect, useState } from "react";
import { Ban, RotateCcw, KeyRound, Copy, LineChart } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, Badge, SecondaryButton, DangerButton } from "../ui";
import { WorkerTrendsModal } from "./WorkerTrendsModal";

interface Worker {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Suspended";
  caseload: number;
}

export const WorkersTab: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [trendsWorker, setTrendsWorker] = useState<Worker | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    adminApiService
      .getWorkers()
      .then(setWorkers)
      .catch((err) => setError(err.message || "Failed to load counselors."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
    } catch (err: any) {
      setError(err.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = (w: Worker) =>
    withBusy(w.id, async () => {
      setNotice("");
      const res = await adminApiService.suspendWorker(w.id);
      setWorkers((prev) =>
        prev.map((x) =>
          x.id === w.id ? { ...x, status: "Suspended", caseload: 0 } : x
        )
      );
      const r = res.reassigned ?? 0;
      const u = res.unassigned ?? 0;
      if (r || u) {
        setNotice(
          `${w.name}'s caseload was redistributed: ${r} participant(s) reassigned` +
            (u ? `, ${u} left unassigned (no capacity — see the Assignments tab).` : ".")
        );
      } else {
        setNotice(`${w.name} suspended. They had no assigned participants.`);
      }
    });

  const handleReactivate = (w: Worker) =>
    withBusy(w.id, async () => {
      await adminApiService.reactivateWorker(w.id);
      setWorkers((prev) => prev.map((x) => (x.id === w.id ? { ...x, status: "Active" } : x)));
    });

  const handleReset = (w: Worker) =>
    withBusy(w.id, async () => {
      const res = await adminApiService.resetWorkerPassword(w.id);
      setResetResult({ email: w.email, password: res.temporaryPassword, emailSent: res.emailSent });
    });

  return (
    <div>
      <PageHeader title="Counselor Management" subtitle="Suspend, reactivate, or reset credentials for active counselors." />
      {error && <ErrorBanner message={error} />}

      {notice && (
        <Card className="p-4 mb-5 border-[#DBC9B4] bg-[#F6ECE0]">
          <div className="flex items-start gap-2">
            <p className="text-xs font-semibold text-[#7A5230] leading-relaxed flex-1">{notice}</p>
            <button
              onClick={() => setNotice("")}
              className="text-xs font-bold text-[#7A5230] hover:underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {resetResult && (
        <Card className="p-5 mb-5 border-[#CFE6D6] bg-[#EAF3EC]">
          <p className="text-sm font-black text-[#2F6B4F] mb-1">
            Password reset{resetResult.emailSent ? " and emailed." : "."}
          </p>
          {!resetResult.emailSent && (
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#CFE6D6] font-mono text-xs text-[#2F6B4F] mt-2">
              <span>{resetResult.email}</span>
              <span className="text-[#68625D]">/</span>
              <span>{resetResult.password}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(`${resetResult.email} / ${resetResult.password}`)}
                className="ml-auto hover:opacity-70 cursor-pointer"
              >
                <Copy size={14} />
              </button>
            </div>
          )}
          <button onClick={() => setResetResult(null)} className="text-xs font-bold text-[#2F6B4F] hover:underline mt-2 cursor-pointer">
            Dismiss
          </button>
        </Card>
      )}

      {loading ? (
        <Spinner label="Loading counselors..." />
      ) : workers.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="No active counselors yet — approvals from the Verification Queue will appear here." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDF9F5] border-b border-[#EFE8E2] text-left text-[10px] font-bold uppercase tracking-wider text-[#68625D]">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Caseload</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-b border-[#EFE8E2] last:border-0">
                  <td className="px-5 py-3 font-bold text-[#3C3530]">{w.name}</td>
                  <td className="px-5 py-3 text-[#5A5049]">{w.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={w.status === "Active" ? "good" : "bad"}>{w.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-[#5A5049] font-semibold">{w.caseload}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <SecondaryButton onClick={() => setTrendsWorker(w)} title="View caseload trends">
                        <span className="flex items-center gap-1">
                          <LineChart size={12} /> Trends
                        </span>
                      </SecondaryButton>
                      <SecondaryButton onClick={() => handleReset(w)} disabled={busyId === w.id} title="Reset password">
                        <span className="flex items-center gap-1">
                          <KeyRound size={12} /> Reset
                        </span>
                      </SecondaryButton>
                      {w.status === "Active" ? (
                        <DangerButton onClick={() => handleSuspend(w)} disabled={busyId === w.id}>
                          <span className="flex items-center gap-1">
                            <Ban size={12} /> Suspend
                          </span>
                        </DangerButton>
                      ) : (
                        <SecondaryButton onClick={() => handleReactivate(w)} disabled={busyId === w.id}>
                          <span className="flex items-center gap-1">
                            <RotateCcw size={12} /> Reactivate
                          </span>
                        </SecondaryButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {trendsWorker && (
        <WorkerTrendsModal
          workerId={trendsWorker.id}
          workerName={trendsWorker.name}
          onClose={() => setTrendsWorker(null)}
        />
      )}
    </div>
  );
};
