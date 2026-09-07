import React, { useEffect, useState } from "react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, Badge } from "../ui";

interface AuditEntry {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string | null;
  description: string | null;
  severity: string | null;
  occurred_at: string;
}

export const AuditLogTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApiService
      .getAuditLog("ADMIN")
      .then(setEntries)
      .catch((err) => setError(err.message || "Failed to load the audit log."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Admin Audit Log"
        subtitle="Every approval, rejection, suspension, assignment, and password reset performed from this panel."
      />
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner label="Loading audit log..." />
      ) : entries.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="No admin actions have been recorded yet." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDF9F5] border-b border-[#EFE8E2] text-left text-[10px] font-bold uppercase tracking-wider text-[#7F8C8D]">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[#EFE8E2] last:border-0 align-top">
                  <td className="px-5 py-3 text-xs text-[#7F8C8D] whitespace-nowrap">
                    {new Date(e.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone="neutral">{e.action}</Badge>
                  </td>
                  <td className="px-5 py-3 text-[#3C3530]">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};
