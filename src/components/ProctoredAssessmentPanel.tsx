import React, { useEffect, useState } from "react";
import { Shield, AlertTriangle } from "lucide-react";
import { proctoredAssessmentService } from "../services/proctoredAssessmentService";
import { CompletedAssessmentRecord } from "../features/proctoredAssessment/types";
import { INTEGRITY_LABELS } from "../features/proctoredAssessment/utils/labels";

interface Props {
  participantId: string;
}

/**
 * The participant's saved proctored trauma assessments, from the counsellor's
 * side. Read-only: a completed assessment is a measurement taken at a moment,
 * and the table behind it has no update policy.
 *
 * A PCL-5 total above the threshold is a screening result, not a diagnosis,
 * and the session-condition line describes the session only. Neither is ever
 * a judgement about whether the person's answers are true.
 */
export const ProctoredAssessmentPanel: React.FC<Props> = ({ participantId }) => {
  const [records, setRecords] = useState<CompletedAssessmentRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    proctoredAssessmentService.listForParticipant(participantId).then(({ records, error }) => {
      if (cancelled) return;
      setRecords(records);
      setStatus(error ? "error" : "ready");
    });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  const newestFirst = [...records].reverse();

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-[#8A4A20]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
          Trauma assessment (PCL-5)
        </h3>
      </div>

      <p className="text-xs text-[#6B635C] leading-relaxed">
        Results this person chose to save from the proctored PCL-5 screening. A score at or above the
        threshold is a screening result, not a diagnosis. Session conditions describe the camera and
        window checks only and never judge the answers.
      </p>

      {status === "loading" && <p className="text-xs text-[#6B635C]">Loading…</p>}

      {status === "error" && (
        <p className="rounded-xl border border-[#A65D52]/30 bg-[#A65D52]/8 px-3 py-2 text-xs text-[#8A463C]">
          Saved assessments couldn't be loaded.
        </p>
      )}

      {status === "ready" && records.length === 0 && (
        <p className="text-xs text-[#6B635C]">No saved assessments yet.</p>
      )}

      {status === "ready" && records.length > 0 && (
        <ul className="divide-y divide-[#EFE8E2]">
          {newestFirst.map((rec) => {
            const isOpen = openId === rec.id;
            const partial = rec.itemsAnswered !== undefined && rec.itemsAnswered < 20;
            return (
              <li key={rec.id} className="py-3">
                <button
                  onClick={() => setOpenId(isOpen ? null : rec.id)}
                  aria-expanded={isOpen}
                  className="w-full flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="text-sm font-bold text-[#3C3530]">
                    {new Date(rec.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#3C3530]">{rec.totalScore} / 80</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        rec.isClinicallySignificant
                          ? "text-[#8A3F35] bg-[#A65D52]/12"
                          : "text-[#2F6B4F] bg-[#2F6B4F]/10"
                      }`}
                    >
                      {rec.isClinicallySignificant ? "At or above threshold" : "Below threshold"}
                    </span>
                  </span>
                </button>

                {partial && (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] text-[#8A5A2B]">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Ended early: {rec.itemsAnswered} of 20 questions answered, so the total is incomplete.
                  </p>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-2 text-xs text-[#5A5049]">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <dt className="text-[#6B635C]">Intrusion</dt>
                      <dd className="font-semibold">{rec.clusterScores.intrusion} / 20</dd>
                      <dt className="text-[#6B635C]">Avoidance</dt>
                      <dd className="font-semibold">{rec.clusterScores.avoidance} / 8</dd>
                      <dt className="text-[#6B635C]">Thoughts and mood</dt>
                      <dd className="font-semibold">{rec.clusterScores.negativeCognitions} / 28</dd>
                      <dt className="text-[#6B635C]">Arousal and reactivity</dt>
                      <dd className="font-semibold">{rec.clusterScores.arousal} / 24</dd>
                      <dt className="text-[#6B635C]">Daily-life impact</dt>
                      <dd className="font-semibold">{rec.functionalImpactAvg} / 4</dd>
                      <dt className="text-[#6B635C]">Threshold used</dt>
                      <dd className="font-semibold">{rec.cutPoint ?? 33}</dd>
                      <dt className="text-[#6B635C]">Session conditions</dt>
                      <dd className="font-semibold">
                        {INTEGRITY_LABELS[rec.sessionIntegrityRating]?.label ?? rec.sessionIntegrityRating}
                      </dd>
                    </dl>
                    {rec.indexTraumaLabel && (
                      <p>
                        <span className="text-[#6B635C]">Questions referred to: </span>
                        <span data-no-translate>{rec.indexTraumaLabel}</span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
