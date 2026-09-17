import React, { useEffect, useState } from "react";
import { AlertTriangle, EyeOff, Info } from "lucide-react";
import { Card, PageHeader, Spinner, ErrorBanner, Badge } from "../ui";
import { supabaseService } from "../../services/supabaseService";
import {
  computeFairnessReport,
  PAIRING_WINDOW_DAYS,
  ELEVATED_AT,
  type FairnessReport,
  type SliceReport,
} from "../../services/fairnessReport";
import { MIN_GROUP_SIZE } from "../../services/communityAggregates";
import type { CheckIn } from "../../types";

/**
 * Study 2 of docs/EVALUATION_PROTOCOL.md, on screen.
 *
 * This tab is built to be readable when it has nothing to say, which is its
 * normal state for a while. The failure it is designed against is the usual
 * one for a fairness dashboard: green ticks and round numbers computed over a
 * handful of people, reassuring exactly the person who would otherwise have
 * gone and looked.
 *
 * So a rate that cannot be computed renders as "no cases", never as 0%. A
 * slice under the k-anonymity floor renders as withheld, with its size hidden
 * rather than shown. And the sentence at the top says how many pairs the
 * whole thing rests on, because that number is what decides whether any of
 * the rest of it means anything.
 */

const gapTone = (gap: number | null): "good" | "warn" | "bad" | "neutral" => {
  if (gap === null) return "neutral";
  if (gap >= 20) return "bad";
  if (gap >= 10) return "warn";
  return "good";
};

const DimensionTable: React.FC<{ report: SliceReport }> = ({ report }) => (
  <Card>
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="font-bold text-[#3C3530]">{report.label}</h3>
        <p className="text-xs text-[#6B635C] mt-0.5">
          {report.widestGap === null
            ? "Not enough reportable slices to compare."
            : `Widest gap between slices: ${report.widestGap} percentage points.`}
        </p>
      </div>
      {report.widestGap !== null && (
        <Badge tone={gapTone(report.widestGap)}>{report.widestGap} pt gap</Badge>
      )}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-black uppercase tracking-wider text-[#68625D] border-b border-[#EFE8E2]">
            <th className="py-2 pr-4">Slice</th>
            <th className="py-2 pr-4 text-right">Pairs</th>
            <th className="py-2 pr-4 text-right">Flagged by WHO-5</th>
            <th className="py-2 pr-4 text-right">Missed by AURA</th>
            <th className="py-2 text-right">Miss rate</th>
          </tr>
        </thead>
        <tbody>
          {report.slices.map((slice) => (
            <tr key={slice.value} className="border-b border-[#F6F1EC] last:border-0">
              <td className="py-2.5 pr-4 font-semibold text-[#3C3530]">
                {slice.value}
                {slice.suppressed && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B635C]">
                    <EyeOff size={12} aria-hidden="true" />
                    withheld
                  </span>
                )}
              </td>
              {slice.suppressed ? (
                <td className="py-2.5 text-[13px] text-[#6B635C]" colSpan={4}>
                  Fewer than {MIN_GROUP_SIZE} pairs. Reporting a rate over this few people
                  would describe those people.
                </td>
              ) : (
                <>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[#5A5049]">{slice.n}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[#5A5049]">{slice.flagged}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[#5A5049]">{slice.missed}</td>
                  <td className="py-2.5 text-right tabular-nums font-bold text-[#3C3530]">
                    {slice.falseNegativeRate === null ? (
                      <span className="font-semibold text-[#6B635C]">no cases</span>
                    ) : (
                      `${slice.falseNegativeRate}%`
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

export const FairnessTab: React.FC = () => {
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabaseService.participants.getAll(),
      supabaseService.instrumentAdministrations.getAll(),
      supabaseService.checkIns.getAll(),
    ])
      .then(([participants, administrations, checkIns]) => {
        if (cancelled) return;
        const byParticipant = new Map<string, CheckIn[]>();
        for (const checkIn of checkIns) {
          const list = byParticipant.get(checkIn.participantId);
          if (list) list.push(checkIn);
          else byParticipant.set(checkIn.participantId, [checkIn]);
        }
        setReport(computeFairnessReport(participants, administrations, byParticipant));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load the evaluation data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Reading check-ins and questionnaire answers..." />;
  if (error) return <ErrorBanner message={error} />;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fairness slices"
        subtitle="Whether AURA misses distress more often for some groups than others."
      />

      <Card>
        <div className="flex gap-3">
          <Info size={16} className="shrink-0 mt-0.5 text-[#A55D25]" aria-hidden="true" />
          <div className="space-y-2 text-[13px] text-[#5A5049] leading-relaxed">
            <p>
              Each row compares two things about the same person at roughly the same time: what
              the WHO-5 said, and where AURA's own score put them. A "miss" is someone the WHO-5
              flagged as worth a closer look whom AURA left below its elevated band of{" "}
              {ELEVATED_AT}.
            </p>
            <p>
              Miss rate is the figure to read, not accuracy. Someone in real distress scored low
              is left alone; a false alarm costs a counsellor ten minutes. Overall accuracy would
              let a group with a bad miss rate hide behind a large number of correct quiet
              readings.
            </p>
            <p className="text-[#6B635C]">
              Pairs are matched within {PAIRING_WINDOW_DAYS} days. Anything under {MIN_GROUP_SIZE}{" "}
              is withheld.
            </p>
          </div>
        </div>
      </Card>

      {report.suppressed ? (
        <Card>
          <div className="flex gap-3">
            <EyeOff size={18} className="shrink-0 mt-0.5 text-[#6B635C]" aria-hidden="true" />
            <div className="space-y-2">
              <h3 className="font-bold text-[#3C3530]">Not enough data to report yet</h3>
              <p className="text-sm text-[#5A5049] leading-relaxed">
                {report.pairs === 0
                  ? "No questionnaire answers have been paired with a check-in yet."
                  : `${report.pairs} pair${report.pairs === 1 ? "" : "s"} so far, below the floor of ${MIN_GROUP_SIZE}.`}{" "}
                Nothing is shown rather than a figure computed over a handful of people, because
                a rate over that few describes the people themselves.
              </p>
              {report.unpaired > 0 && (
                <p className="text-[13px] text-[#6B635C]">
                  {report.unpaired} questionnaire answer{report.unpaired === 1 ? "" : "s"} had no
                  check-in within {PAIRING_WINDOW_DAYS} days and could not be paired.
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#68625D]">Pairs</p>
                <p className="text-2xl font-bold text-[#3C3530] tabular-nums">{report.pairs}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#68625D]">
                  Flagged by WHO-5
                </p>
                <p className="text-2xl font-bold text-[#3C3530] tabular-nums">{report.flagged}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#68625D]">
                  Missed by AURA
                </p>
                <p className="text-2xl font-bold text-[#3C3530] tabular-nums">{report.missed}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#68625D]">
                  Overall miss rate
                </p>
                <p className="text-2xl font-bold text-[#3C3530] tabular-nums">
                  {report.overallFalseNegativeRate === null
                    ? "no cases"
                    : `${report.overallFalseNegativeRate}%`}
                </p>
              </div>
            </div>
            {report.unpaired > 0 && (
              <p className="text-[13px] text-[#6B635C] mt-4 pt-4 border-t border-[#EFE8E2]">
                {report.unpaired} questionnaire answer{report.unpaired === 1 ? "" : "s"} could not
                be paired with a check-in inside {PAIRING_WINDOW_DAYS} days. They are excluded from
                every figure above, and counted here rather than dropped, because quietly
                discarding the people who check in rarely would select for the engaged.
              </p>
            )}
          </Card>

          {report.dimensions.some((d) => (d.widestGap ?? 0) >= 10) && (
            <Card>
              <div className="flex gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#B3541E]" aria-hidden="true" />
                <div>
                  <h3 className="font-bold text-[#3C3530]">A gap worth investigating</h3>
                  <p className="text-sm text-[#5A5049] leading-relaxed mt-1">
                    At least one dimension shows a miss-rate difference of ten points or more
                    between groups. The likeliest cause is not the arithmetic. It is that the
                    questions read differently in a machine-translated interface than in a
                    hand-written one.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {report.dimensions.map((dimension) => (
            <DimensionTable key={dimension.dimension} report={dimension} />
          ))}
        </>
      )}
    </div>
  );
};
