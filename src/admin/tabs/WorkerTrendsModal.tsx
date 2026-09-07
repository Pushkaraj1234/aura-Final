import React, { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { adminApiService } from "../../services/adminApiService";
import { Card, Spinner, ErrorBanner, EmptyState, Badge, SecondaryButton } from "../ui";

interface Props {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

/**
 * Oversight Dashboard requirement: show aggregated/anonymized distress
 * trends for a counselor's caseload by default, and require an
 * explicit action before showing individual-level detail. The aggregate
 * chart never carries a participant id; the per-participant breakdown only
 * renders after the admin clicks "Show individual-level detail" below.
 */
export const WorkerTrendsModal: React.FC<Props> = ({ workerId, workerName, onClose }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApiService.getWorkerCaseloadTrends>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showIndividual, setShowIndividual] = useState(false);

  useEffect(() => {
    adminApiService
      .getWorkerCaseloadTrends(workerId)
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load caseload trends."))
      .finally(() => setLoading(false));
  }, [workerId]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <Card className="p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-lg font-black text-[#3C3530]">{workerName}'s Caseload Trends</h3>
            <p className="text-xs text-[#7F8C8D] mt-0.5">
              Aggregated distress indicator across their assigned caseload — anonymized by default.
            </p>
          </div>
          <button onClick={onClose} className="text-[#7F8C8D] hover:text-[#3C3530] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <Spinner label="Loading trends..." />
        ) : data ? (
          <>
            <p className="text-xs text-[#7F8C8D] mb-4">
              {data.caseloadCount} user{data.caseloadCount === 1 ? "" : "s"} currently assigned.
            </p>

            {data.aggregateTrend.length === 0 ? (
              <EmptyState message="No check-in history yet for this worker's caseload." />
            ) : (
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.aggregateTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="workerTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5A5049" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#5A5049" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE8E2" vertical={false} />
                    <XAxis dataKey="date" stroke="#7F8C8D" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#7F8C8D" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#3C3530",
                        border: "1px solid #3F4E4E",
                        borderRadius: "1rem",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(val: number, name: string, item: any) => [
                        `${val}/100 (avg of ${item.payload.checkInCount})`,
                        "Avg. Distress Indicator",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="averageScore"
                      stroke="#5A5049"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#workerTrendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-[#EFE8E2]">
              <SecondaryButton onClick={() => setShowIndividual((v) => !v)}>
                <span className="flex items-center gap-1.5">
                  {showIndividual ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showIndividual ? "Hide individual-level detail" : "View individual-level detail"}
                </span>
              </SecondaryButton>

              {showIndividual && (
                <div className="mt-4 space-y-2">
                  {data.individualSeries.length === 0 ? (
                    <EmptyState message="No individual check-in history available." />
                  ) : (
                    data.individualSeries.map((p) => {
                      const latest = p.points[p.points.length - 1];
                      return (
                        <div
                          key={p.participantId}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-[#7F8C8D]">{p.participantId}</span>
                            <Badge tone={p.status === "Urgent safety signal" ? "bad" : p.status === "Human review pending" || p.status === "Needs follow-up" ? "warn" : "neutral"}>
                              {p.status}
                            </Badge>
                          </div>
                          <span className="text-xs font-bold text-[#3C3530]">
                            Latest: {latest ? `${latest.score}/100` : "—"}{" "}
                            <span className="text-[#7F8C8D] font-medium">({p.points.length} check-ins)</span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
};
