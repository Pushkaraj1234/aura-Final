import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle, Plus } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, Badge, PrimaryButton, SecondaryButton } from "../ui";

type Verdict = "true_positive" | "false_positive" | "false_negative" | "unclear";

const VERDICT_META: Record<Verdict, { label: string; tone: "good" | "bad" | "warn" | "neutral"; Icon: React.ElementType }> = {
  true_positive: { label: "True positive", tone: "good", Icon: CheckCircle2 },
  false_positive: { label: "False positive", tone: "bad", Icon: XCircle },
  false_negative: { label: "False negative (missed)", tone: "warn", Icon: AlertTriangle },
  unclear: { label: "Unclear", tone: "neutral", Icon: HelpCircle },
};

export const FlagReviewTab: React.FC = () => {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApiService.getFlagReviews>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Log-a-missed-case (false negative) form
  const [fnOpen, setFnOpen] = useState(false);
  const [fnParticipant, setFnParticipant] = useState("");
  const [fnNote, setFnNote] = useState("");
  const [fnBusy, setFnBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    adminApiService
      .getFlagReviews()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load the review queue."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const mark = async (item: NonNullable<typeof data>["items"][number], verdict: Verdict) => {
    setBusy(item.alertId);
    setError("");
    try {
      await adminApiService.reviewFlag({
        alertId: item.alertId,
        participantId: item.participantId,
        verdict,
        note: noteFor === item.alertId ? noteText.trim() || undefined : undefined,
        flaggedScore: item.score,
        flaggedSeverity: item.severity,
        originalReason: item.reason,
      });
      setNoteFor(null);
      setNoteText("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save review.");
    } finally {
      setBusy(null);
    }
  };

  const logMissed = async () => {
    if (!fnParticipant.trim()) return;
    setFnBusy(true);
    try {
      await adminApiService.reviewFlag({
        alertId: null,
        participantId: fnParticipant.trim(),
        verdict: "false_negative",
        note: fnNote.trim() || undefined,
      });
      setFnOpen(false);
      setFnParticipant("");
      setFnNote("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to log missed case.");
    } finally {
      setFnBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Flag Review"
        subtitle="Mark the alert engine's past judgments to build an accuracy picture over time. Advisory / audit only — never changes a case."
        action={
          <SecondaryButton onClick={() => setFnOpen((o) => !o)}>
            <span className="flex items-center gap-1.5">
              <Plus size={13} /> Log a missed case
            </span>
          </SecondaryButton>
        }
      />
      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner label="Loading review queue..." />
      ) : data ? (
        <>
          {/* Accuracy summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Reviewed", value: data.stats.reviewed, tone: "#3C3530" },
              { label: "True positives", value: data.stats.true_positive, tone: "#2E6B52" },
              { label: "False positives", value: data.stats.false_positive, tone: "#B0413E" },
              { label: "Missed (FN)", value: data.stats.false_negative, tone: "#B4762B" },
              {
                label: "Precision / Recall",
                value:
                  (data.stats.precision == null ? "—" : `${data.stats.precision}%`) +
                  " / " +
                  (data.stats.recall == null ? "—" : `${data.stats.recall}%`),
                tone: "#3F5E78",
              },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xl font-black" style={{ color: s.tone }}>
                  {s.value}
                </p>
                <p className="text-[11px] text-[#7F8C8D] font-semibold mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          {fnOpen && (
            <Card className="p-4 mb-6">
              <p className="text-sm font-bold text-[#3C3530] mb-2">Log a case the engine should have flagged</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="Participant ID"
                  value={fnParticipant}
                  onChange={(e) => setFnParticipant(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#EFE8E2] bg-[#FDF9F5] text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] min-w-[220px]"
                />
                <input
                  placeholder="What was missed / why (optional)"
                  value={fnNote}
                  onChange={(e) => setFnNote(e.target.value)}
                  className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-[#EFE8E2] bg-[#FDF9F5] text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                />
                <PrimaryButton onClick={logMissed} disabled={fnBusy || !fnParticipant.trim()}>
                  {fnBusy ? "Saving..." : "Log FN"}
                </PrimaryButton>
              </div>
              <p className="text-[11px] text-[#7F8C8D] mt-2">
                You can copy a participant ID from the User Assignments tab.
              </p>
            </Card>
          )}

          {/* Alert list */}
          {data.items.length === 0 ? (
            <Card className="p-6">
              <EmptyState message="No alerts to review yet." />
            </Card>
          ) : (
            <div className="space-y-2">
              {data.items.map((item) => {
                const vm = item.verdict ? VERDICT_META[item.verdict] : null;
                return (
                  <Card key={item.alertId} className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone={item.severity === "RED" ? "bad" : item.severity === "ORANGE" ? "warn" : "neutral"}>
                            {item.severity}
                          </Badge>
                          <span className="text-sm font-bold text-[#3C3530]">{item.participantName}</span>
                          {typeof item.score === "number" && (
                            <span className="text-xs font-semibold text-[#7F8C8D]">{item.score}/100</span>
                          )}
                          {vm && (
                            <span className="inline-flex items-center gap-1">
                              <vm.Icon size={12} />
                              <Badge tone={vm.tone}>{vm.label}</Badge>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5A5049] mt-1">{item.title || item.reason}</p>
                        <p className="text-[11px] text-[#7F8C8D] mt-0.5">
                          {new Date(item.createdAt).toLocaleDateString()} · status {item.status}
                          {item.reviewNote ? ` · note: ${item.reviewNote}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => mark(item, "true_positive")}
                            disabled={busy === item.alertId}
                            className="px-2.5 py-1.5 rounded-lg bg-[#E4F0E9] text-[#2E6B52] text-xs font-bold hover:bg-[#d6e9df] cursor-pointer disabled:opacity-50"
                          >
                            TP
                          </button>
                          <button
                            onClick={() => mark(item, "false_positive")}
                            disabled={busy === item.alertId}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F7E7E4] text-[#B0413E] text-xs font-bold hover:bg-[#f2dbd7] cursor-pointer disabled:opacity-50"
                          >
                            FP
                          </button>
                          <button
                            onClick={() => mark(item, "unclear")}
                            disabled={busy === item.alertId}
                            className="px-2.5 py-1.5 rounded-lg bg-[#EFE8E2] text-[#5A5049] text-xs font-bold hover:bg-[#e6ded4] cursor-pointer disabled:opacity-50"
                          >
                            Unclear
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setNoteFor(noteFor === item.alertId ? null : item.alertId);
                            setNoteText("");
                          }}
                          className="text-[11px] font-bold text-[#5A5049] hover:underline cursor-pointer"
                        >
                          {noteFor === item.alertId ? "Hide note" : "Add note with verdict"}
                        </button>
                      </div>
                    </div>
                    {noteFor === item.alertId && (
                      <input
                        autoFocus
                        placeholder="Optional note — applied with your next TP/FP/Unclear click"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-[#EFE8E2] bg-[#FDF9F5] text-xs text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {data.missed.length > 0 && (
            <Card className="p-6 mt-6">
              <h3 className="text-sm font-black text-[#3C3530] uppercase tracking-wider mb-3">Logged missed cases</h3>
              <div className="space-y-2">
                {data.missed.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2]">
                    <div>
                      <span className="text-sm font-bold text-[#3C3530]">{m.participantName}</span>
                      {m.note && <span className="text-xs text-[#7F8C8D] ml-2">— {m.note}</span>}
                    </div>
                    <span className="text-[11px] text-[#7F8C8D]">{new Date(m.reviewedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};
