import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Info, Loader2 } from "lucide-react";
import {
  WHO5,
  administrationProgress,
  scoreInstrument,
  who5NeedsALook,
  type InstrumentAdministration,
  type ItemResponses,
} from "../services/instruments";
import { supabaseService } from "../services/supabaseService";

/**
 * The WHO-5 Well-Being Index, administered.
 *
 * This screen exists to make AURA's own score checkable. Until something
 * externally validated is collected alongside it, the 0-100 distress number
 * is a formula nobody can argue with and nobody can verify, and the study in
 * docs/EVALUATION_PROTOCOL.md cannot start.
 *
 * Three things here are deliberate and easy to undo by accident.
 *
 * The items and the six response options are reproduced exactly, in the
 * published order, and are not translated by the DOM translator. A WHO-5 with
 * reworded items, five options instead of six, or the anchors resequenced is
 * not a WHO-5, and the whole reason to use it is that it means the same thing
 * here as it does in the literature. Hence data-no-translate on the items.
 *
 * Nothing is scored on this screen. The total is computed in the data layer
 * from the stored responses, so a row's total can never disagree with the
 * answers behind it.
 *
 * Skipping is allowed and refuses to produce a score. Zero on this scale is
 * "At no time", the worst available answer, so a skipped item quietly counted
 * as zero would report someone as less well than they said.
 */

interface Props {
  participantId: string;
  onDone: () => void;
  onCancel: () => void;
}

type Phase = "intro" | "items" | "saving" | "done" | "error";

export const WellbeingIndex: React.FC<Props> = ({ participantId, onDone, onCancel }) => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [responses, setResponses] = useState<ItemResponses>({});
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<InstrumentAdministration | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [history, setHistory] = useState<InstrumentAdministration[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabaseService.instrumentAdministrations.getAll(participantId).then((rows) => {
      if (!cancelled) setHistory(rows.filter((r) => r.instrumentId === "who5"));
    });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  const progress = useMemo(() => administrationProgress(WHO5, responses), [responses]);
  const item = WHO5.items[index];
  const isLast = index === WHO5.items.length - 1;

  const choose = (value: number) => {
    if (!item) return;
    setResponses((prev) => ({ ...prev, [item.id]: value }));
    // A short beat before advancing, so the choice registers visually rather
    // than the next question simply appearing under the finger.
    window.setTimeout(() => {
      setIndex((current) => Math.min(WHO5.items.length - 1, current + 1));
    }, 180);
  };

  const submit = async () => {
    setPhase("saving");
    setErrorMessage("");
    try {
      const row = await supabaseService.instrumentAdministrations.create(
        participantId,
        WHO5,
        responses
      );
      if (!row) {
        setErrorMessage(
          "Your answers could not be saved just now. Nothing was lost, so you can try again."
        );
        setPhase("error");
        return;
      }
      setSaved(row);
      setPhase("done");
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.name === "IncompleteInstrumentError"
          ? "A few answers are still blank. All five are needed before this can be scored."
          : "Your answers could not be saved just now. Nothing was lost, so you can try again."
      );
      setPhase("error");
    }
  };

  // ---- intro --------------------------------------------------------------

  if (phase === "intro") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B635C] hover:text-[#3C3530] transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs p-7 sm:p-9 space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-11 w-11 rounded-2xl bg-[#FBF3EC] text-[#A55D25]">
              <ClipboardList size={20} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#3C3530]">Five questions about your wellbeing</h1>
              <p className="text-sm text-[#6B635C]">Takes about a minute.</p>
            </div>
          </div>

          <p className="text-[15px] text-[#5A5049] leading-relaxed">
            These five aren't ours. They're the {WHO5.name}, written by the World Health
            Organization and used in studies around the world. We ask them so we can check our
            own wellbeing number against something that has been properly tested, instead of
            asking you to take our word for it.
          </p>

          <div className="rounded-2xl bg-[#FBF3EC] border border-[#E3C9A8] p-4 space-y-2">
            <p className="text-[13px] text-[#6B5B4C] leading-relaxed flex gap-2">
              <Info size={15} className="shrink-0 mt-0.5 text-[#A55D25]" aria-hidden="true" />
              <span>
                This one asks about {WHO5.recallWindow}, which is a longer stretch than your
                usual check-in. Your answers here don't change your distress score.
              </span>
            </p>
          </div>

          {history.length > 0 && (
            <p className="text-[13px] text-[#6B635C]">
              You've answered these {history.length === 1 ? "once" : `${history.length} times`}{" "}
              before. The last time was{" "}
              {new Date(history[history.length - 1]!.administeredAt).toLocaleDateString()}.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => setPhase("items")}
              className="px-6 py-3.5 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors"
            >
              Start
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3.5 rounded-2xl border border-[#E0D7CE] text-[#5A5049] font-semibold text-sm hover:bg-[#FAF7F4] transition-colors"
            >
              Not now
            </button>
          </div>

          <p className="text-[11px] text-[#6B635C] pt-2" data-no-translate>
            {WHO5.attribution}
          </p>
        </div>
      </div>
    );
  }

  // ---- done ---------------------------------------------------------------

  if (phase === "done" && saved) {
    const score = scoreInstrument(WHO5, saved.itemResponses);
    const worthATalk = who5NeedsALook(score);
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs p-7 sm:p-9 space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-11 w-11 rounded-2xl bg-[#EEF7F0] text-[#3F7D53]">
              <CheckCircle2 size={20} aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold text-[#3C3530]">Thank you, that's saved</h1>
          </div>

          <div className="rounded-2xl border border-[#EFE8E2] p-5">
            <p className="text-xs font-black uppercase tracking-wider text-[#68625D]">
              {WHO5.name}
            </p>
            <p className="text-4xl font-bold text-[#3C3530] mt-2">
              {score.scaled}
              <span className="text-lg text-[#6B635C] font-semibold"> / 100</span>
            </p>
            <p className="text-[13px] text-[#6B635C] mt-1">
              Raw total {score.raw} out of {WHO5.rawRange.max}, multiplied by four. That's how
              this questionnaire is normally reported.
            </p>
          </div>

          <p className="text-[15px] text-[#5A5049] leading-relaxed">
            {worthATalk
              ? "That's on the lower side. It isn't a diagnosis and it doesn't mean anything is wrong with you. It does mean this is worth talking through with someone, and a counsellor here can help with that whenever you want."
              : "Nothing here needs acting on. We'll ask again later so there's more than one point to compare."}
          </p>

          <p className="text-[13px] text-[#6B635C] leading-relaxed">
            This sits beside your distress score rather than changing it. Keeping them separate
            is what lets us check one against the other.
          </p>

          <button
            onClick={onDone}
            className="px-6 py-3.5 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors"
          >
            Back to my page
          </button>
        </div>
      </div>
    );
  }

  // ---- items, saving, error ----------------------------------------------

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs p-7 sm:p-9 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B635C]">
            <span>
              Question {index + 1} of {WHO5.items.length}
            </span>
            <span>
              {progress.answered} answered
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1EBE5] overflow-hidden">
            <div
              className="h-full bg-[#A55D25] transition-all duration-300"
              style={{ width: `${(progress.answered / progress.total) * 100}%` }}
            />
          </div>
        </div>

        <p className="text-[13px] text-[#6B635C] leading-relaxed" data-no-translate>
          {WHO5.instruction}
        </p>

        {item && (
          <div className="space-y-4">
            {/* Not translated: reworded items are not the instrument any more. */}
            <h2 className="text-xl font-bold text-[#3C3530] leading-snug" data-no-translate>
              {item.text}
            </h2>

            <div className="space-y-2">
              {WHO5.options.map((option) => {
                const chosen = responses[item.id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => choose(option.value)}
                    aria-pressed={chosen}
                    className={`w-full text-left px-5 py-3.5 rounded-2xl border text-sm font-semibold transition-colors ${
                      chosen
                        ? "bg-[#3C3530] text-white border-[#3C3530]"
                        : "bg-white text-[#5A5049] border-[#E0D7CE] hover:bg-[#FAF7F4]"
                    }`}
                    data-no-translate
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "error" && (
          <p className="text-sm text-[#A33A2E] bg-[#FDF1EF] border border-[#F0CFC9] rounded-2xl px-4 py-3">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => (index === 0 ? onCancel() : setIndex(index - 1))}
            disabled={phase === "saving"}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-[#E0D7CE] text-[#5A5049] font-semibold text-sm hover:bg-[#FAF7F4] transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {index === 0 ? "Leave" : "Back"}
          </button>

          {isLast ? (
            <button
              onClick={submit}
              disabled={!progress.complete || phase === "saving"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === "saving" ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Saving
                </>
              ) : (
                <>
                  Finish
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIndex(Math.min(WHO5.items.length - 1, index + 1))}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-[#E0D7CE] text-[#5A5049] font-semibold text-sm hover:bg-[#FAF7F4] transition-colors"
            >
              Skip
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {isLast && !progress.complete && (
          <p className="text-[13px] text-[#6B635C]">
            {progress.total - progress.answered} still to answer. All five are needed, because
            leaving one blank isn't the same as answering "At no time".
          </p>
        )}
      </div>
    </div>
  );
};
