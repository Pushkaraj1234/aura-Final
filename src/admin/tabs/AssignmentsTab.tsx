import React, { useEffect, useMemo, useState } from "react";
import { Shuffle, UserPlus, Search, X } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, Badge, PrimaryButton, SecondaryButton } from "../ui";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
  assignedWorkerId: string | null;
  assignedWorkerName: string | null;
}

interface WorkerOption {
  id: string;
  name: string;
  caseload: number;
  status: string;
}

export const AssignmentsTab: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOverride, setConfirmOverride] = useState<{ userId: string; workerId: string; detail: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([adminApiService.getUsers(), adminApiService.getWorkers()])
      .then(([u, w]) => {
        setUsers(u);
        setWorkers(w.filter((x: WorkerOption) => x.status === "Active"));
      })
      .catch((err) => setError(err.message || "Failed to load users and workers."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const doAssign = async (userId: string, workerId: string, override?: boolean) => {
    setBusyId(userId);
    setError("");
    try {
      // Who was this user assigned to before? Needed so a REASSIGN decrements
      // the previous counsellor's caseload while it increments the new one —
      // otherwise bouncing the same user between counsellors inflates counts.
      const prevWorkerId = users.find((u) => u.id === userId)?.assignedWorkerId || null;
      if (prevWorkerId === workerId) {
        setBusyId(null);
        return; // no-op: already assigned to this counsellor
      }

      await adminApiService.assignWorker(userId, workerId, { override });
      const worker = workers.find((w) => w.id === workerId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, assignedWorkerId: workerId, assignedWorkerName: worker?.name || "Assigned" } : u))
      );
      setWorkers((prev) =>
        prev.map((w) => {
          if (w.id === workerId) return { ...w, caseload: w.caseload + 1 };
          if (w.id === prevWorkerId) return { ...w, caseload: Math.max(0, w.caseload - 1) };
          return w;
        })
      );
      setConfirmOverride(null);
    } catch (err: any) {
      if (err.warning && err.body) {
        setConfirmOverride({ userId, workerId, detail: err.body.detail });
      } else {
        setError(err.message || "Failed to assign user.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const doUnassign = async (userId: string) => {
    setBusyId(userId);
    setError("");
    try {
      const prevWorkerId = users.find((u) => u.id === userId)?.assignedWorkerId || null;
      await adminApiService.unassignWorker(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, assignedWorkerId: null, assignedWorkerName: null } : u))
      );
      if (prevWorkerId) {
        setWorkers((prev) =>
          prev.map((w) => (w.id === prevWorkerId ? { ...w, caseload: Math.max(0, w.caseload - 1) } : w))
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to unassign user.");
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkAuto = async () => {
    setBulkBusy(true);
    setError("");
    setBulkResult(null);
    try {
      const res = await adminApiService.bulkAutoAssign();
      const skipped = res.skippedByPreference
        ? ` ${res.skippedByPreference} skipped (prefer self-guided support).`
        : "";
      setBulkResult(
        `Assigned ${res.assignedCount} user(s). ${res.unassignedRemaining} remain unassigned.${skipped}`
      );
      load();
    } catch (err: any) {
      setError(err.message || "Bulk auto-assignment failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const unassignedCount = users.filter((u) => !u.assignedWorkerId).length;

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (onlyUnassigned && u.assignedWorkerId) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.assignedWorkerName || "").toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q)
      );
    });
  }, [users, query, onlyUnassigned]);

  return (
    <div>
      <PageHeader
        title="User ↔ Counselor Assignment"
        subtitle="Assign or reassign counselors, or auto-distribute unassigned users by lowest current caseload."
        action={
          <SecondaryButton onClick={handleBulkAuto} disabled={bulkBusy || unassignedCount === 0}>
            <span className="flex items-center gap-1.5">
              <Shuffle size={13} /> {bulkBusy ? "Assigning..." : `Bulk Auto-Assign (${unassignedCount})`}
            </span>
          </SecondaryButton>
        }
      />
      {error && <ErrorBanner message={error} />}
      {bulkResult && (
        <Card className="p-4 mb-5 border-[#CFE6D6] bg-[#EAF3EC] text-sm font-semibold text-[#2F6B4F]">{bulkResult}</Card>
      )}

      {!loading && users.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68625D]" size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user name, email, ID, counselor, status..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68625D] hover:text-[#3C3530] cursor-pointer"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#5A5049] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="accent-[#5A5049]"
            />
            Unassigned only
          </label>
          <span className="text-xs text-[#68625D] ml-auto">
            {filteredUsers.length} of {users.length}
          </span>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading users..." />
      ) : users.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="No registered users yet." />
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="No users match your search." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDF9F5] border-b border-[#EFE8E2] text-left text-[10px] font-bold uppercase tracking-wider text-[#68625D]">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Assigned Counselor</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-[#EFE8E2] last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-bold text-[#3C3530]">{u.name}</p>
                    {u.email && <p className="text-xs text-[#68625D]">{u.email}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={u.status === "Urgent safety signal" ? "bad" : u.status === "Human review pending" ? "warn" : "neutral"}>
                      {u.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-[#5A5049]">
                    {u.assignedWorkerName || <span className="text-[#B9B0A6] italic">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        className="px-2.5 py-2 rounded-lg border border-[#EFE8E2] bg-[#FDF9F5] text-xs text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                        value={u.assignedWorkerId || ""}
                        disabled={busyId === u.id}
                        onChange={(e) => {
                          if (e.target.value) doAssign(u.id, e.target.value);
                        }}
                      >
                        <option value="" disabled>
                          {u.assignedWorkerId ? "Reassign to..." : "Assign to..."}
                        </option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.caseload})
                          </option>
                        ))}
                      </select>
                      {u.assignedWorkerId && (
                        <button
                          onClick={() => doUnassign(u.id)}
                          disabled={busyId === u.id}
                          className="px-2.5 py-2 rounded-lg border border-[#EFE8E2] text-xs font-bold text-[#B0413E] hover:bg-[#F7E7E4] transition-colors cursor-pointer disabled:opacity-50"
                          title="Remove the assigned counselor"
                        >
                          {busyId === u.id ? "…" : "Unassign"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {confirmOverride && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus size={16} className="text-[#A55D25]" />
              <h3 className="text-sm font-black text-[#3C3530]">Exceeds Max Caseload</h3>
            </div>
            <p className="text-sm text-[#5A5049] mb-4">{confirmOverride.detail}</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setConfirmOverride(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={() => doAssign(confirmOverride.userId, confirmOverride.workerId, true)}>
                Assign Anyway
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
