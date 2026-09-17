import React, { useEffect, useMemo, useState } from "react";
import { FileText, Info } from "lucide-react";
import { apiService } from "../services/apiService";
import { detectAtrocityExposure, type AtrocitySignal } from "../services/atrocityLexicon";

/**
 * What this person has described happening to them.
 *
 * COUNSELLOR-FACING ONLY, AND THAT IS THE DESIGN
 *
 * This card is never shown to the participant. The literature review on AI
 * monitoring for atrocity victims is specific about why (section 8.2, third
 * hazard): being told by an algorithm that one is "high risk", or having a
 * category attached to one's account, "can worsen humiliation injury and could
 * be used to discredit a witness or complainant in legal proceedings". A
 * survivor writing about a boycott needs a counsellor who has read it, not a
 * screen that classifies them back at them.
 *
 * WHAT IT IS FOR
 *
 * A counsellor opening a caseload of thirty people cannot read every
 * reflection. This tells them what the reflections are about, so they arrive
 * at the conversation already knowing. It reports categories with the phrase
 * that produced each one, so the reading can be checked against the text and
 * disagreed with, and it says plainly that it changes no score.
 *
 * It reads only reflections the person chose to share. A reflection withheld
 * from the counsellor stays withheld here.
 */

interface Props {
  participantId: string;
}

interface DescribedExposure {
  signal: AtrocitySignal;
  /** When the reflection carrying this was written. */
  at: string;
}

export const AtrocityExposureCard: React.FC<Props> = ({ participantId }) => {
  const [reflections, setReflections] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService.reflections
      .getAll(participantId)
      .then((rows: any[]) => {
        if (!cancelled) setReflections(rows || []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  const described = useMemo<DescribedExposure[]>(() => {
    if (!reflections) return [];
    const out: DescribedExposure[] = [];
    const seen = new Set<string>();
    for (const row of reflections) {
      // Never read something the person chose not to share with staff.
      if (row?.share_with_worker === false) continue;
      const transcript = typeof row?.transcript === "string" ? row.transcript : "";
      if (!transcript) continue;
      for (const signal of detectAtrocityExposure(transcript).signals) {
        // One entry per category, keeping the earliest mention. A person who
        // returns to the same subject has not described a new thing.
        if (seen.has(signal.category)) continue;
        seen.add(signal.category);
        out.push({ signal, at: row.submitted_at || row.created_at || "" });
      }
    }
    return out;
  }, [reflections]);

  if (failed || reflections === null) return null;
  if (described.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-5">
      <div className="flex items-start gap-3 border-b border-[#EFE8E2] pb-4">
        <div className="w-10 h-10 rounded-2xl bg-[#F1EBE5] text-[#7A6A5A] flex items-center justify-center shrink-0">
          <FileText size={18} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-black text-[#3C3530]">What they have described</h3>
          <p className="text-xs text-[#68625D] mt-0.5">
            Read from reflections they chose to share with you
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {described.map(({ signal, at }) => (
          <li
            key={signal.category}
            className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] px-5 py-4"
          >
            <p className="text-sm font-semibold text-[#3C3530]">{signal.label}</p>
            <p className="text-xs text-[#6B635C] mt-1.5">
              From their own words:{" "}
              {/* The person's writing. Never sent to the translation service. */}
              <span className="font-medium text-[#5A5049]" data-no-translate>
                &ldquo;{signal.matched}&rdquo;
              </span>
              {at && (
                <span className="text-[#6B635C]">
                  {" "}
                  &middot; {new Date(at).toLocaleDateString()}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex gap-2.5 rounded-2xl bg-[#F1EBE5] px-5 py-4">
        <Info size={15} className="shrink-0 mt-0.5 text-[#7A6A5A]" aria-hidden="true" />
        <p className="text-xs text-[#5A5049] leading-relaxed">
          This is a word match on what they wrote, not a judgement about their case, and it
          changes no score. It can be wrong in both directions, so read the reflection itself
          before acting on it. They are not shown this list.
        </p>
      </div>
    </div>
  );
};
