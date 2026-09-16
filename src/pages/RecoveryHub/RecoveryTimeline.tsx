import React, { useState } from "react";
import { ArrowLeft, Check, Circle, Plus } from "lucide-react";
import {
  ChoiceList,
  ErrorNote,
  SaveButton,
  TextArea,
  TextField,
  VerificationBadge,
  formatDate,
} from "../../components/Recovery/RecoveryPrimitives";
import type {
  RecoveryCaseBundle,
  RecoveryTimelineEvent,
  TimelineStage,
} from "../../types/recovery";
import { TIMELINE_STAGE_LABELS, TIMELINE_STAGE_ORDER } from "../../types/recovery";
import type { RecoveryProgress } from "../../services/recoveryHub";

/**
 * The case timeline.
 *
 * WHY EVERY ROW WEARS ITS SOURCE
 *
 * A timeline is the most authoritative-looking object in any product. Ticks
 * down a line read as facts confirmed by somebody official, and on this screen
 * almost none of them are: they are what the person was told at a counter, or
 * what they understood from a hearing. So the verification badge is attached to
 * the row itself, not to the page, and "You told us this" is the ordinary case.
 *
 * Stages that have not happened are shown greyed rather than hidden, because
 * the shape of what lies ahead is most of what a person is missing when they
 * say they don't know what is going on.
 */

interface Props {
  bundle: RecoveryCaseBundle;
  progress: RecoveryProgress;
  busy: boolean;
  error: string | null;
  onAdd: (event: Partial<RecoveryTimelineEvent> & { stage: TimelineStage }) => Promise<void>;
  onBack: () => void;
}

export const RecoveryTimelineScreen: React.FC<Props> = ({
  bundle,
  progress,
  busy,
  error,
  onAdd,
  onBack,
}) => {
  const [adding, setAdding] = useState(false);
  const [stage, setStage] = useState<TimelineStage[]>([]);
  const [occurredOn, setOccurredOn] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const eventsByStage = new Map<TimelineStage, RecoveryTimelineEvent[]>();
  for (const e of bundle.timeline) {
    eventsByStage.set(e.stage, [...(eventsByStage.get(e.stage) ?? []), e]);
  }

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          My case timeline
        </span>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          What has happened so far
        </h2>
        <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
          Everything you or a document has told us, in order. Stages you
          haven&rsquo;t reached are shown too, so you can see the shape of what
          usually comes next.
        </p>
      </header>

      <ol className="relative space-y-1 border-l-2 border-[#EDE2D4] pl-6">
        {TIMELINE_STAGE_ORDER.map((s) => {
          const done = progress.completedStages.includes(s);
          const current = progress.stage === s && !done;
          const events = eventsByStage.get(s) ?? [];
          const reached = done || current || events.length > 0;

          return (
            <li key={s} className="relative py-3">
              <span
                aria-hidden="true"
                className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  done
                    ? "border-[#A85D2E] bg-[#A85D2E] text-white"
                    : current
                      ? "border-[#A85D2E] bg-white"
                      : "border-[#E0D0BB] bg-white"
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : <Circle size={6} className="fill-current opacity-40" />}
              </span>

              <p
                className={`text-[1rem] font-semibold ${
                  reached ? "text-[#3A2A1E]" : "text-[#A99A8A]"
                }`}
              >
                {TIMELINE_STAGE_LABELS[s]}
                {current && (
                  <span className="ml-2 text-[0.75rem] font-normal text-[#8A4A20]">
                    where you are now
                  </span>
                )}
              </p>

              {events.map((e) => (
                <div
                  key={e.id}
                  className="mt-2.5 rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.8125rem] font-semibold text-[#6B5B4C]">
                      {formatDate(e.occurredOn) || formatDate(e.createdAt)}
                    </span>
                    <VerificationBadge verification={e.verification} />
                  </div>
                  {e.description && (
                    <p className="mt-2 text-[0.9375rem] leading-[1.65] text-[#3A2A1E]">
                      {e.description}
                    </p>
                  )}
                  {e.notes && (
                    <p className="mt-2 text-[0.875rem] leading-[1.6] text-[#6B5B4C]">
                      {e.notes}
                    </p>
                  )}
                  {e.sourceName && (
                    <p className="mt-2 text-[0.75rem] text-[#7A6A5A]">
                      Source: {e.sourceName}
                      {e.sourceCheckedOn && ` · checked ${formatDate(e.sourceCheckedOn)}`}
                    </p>
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ol>

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <Plus size={16} aria-hidden="true" />
          Add something that happened
        </button>
      ) : (
        <section className="card-elev space-y-5 rounded-2xl p-5 sm:p-6">
          <h3 className="font-serif text-[1.125rem] leading-[1.3] text-[#3A2A1E]">
            Add to your timeline
          </h3>

          <ChoiceList<TimelineStage>
            legend="Which part of the case is this?"
            choices={TIMELINE_STAGE_ORDER.map((s) => ({
              value: s,
              label: TIMELINE_STAGE_LABELS[s],
            }))}
            selected={stage}
            onChange={setStage}
          />

          <TextField
            label="When"
            type="date"
            value={occurredOn}
            onChange={setOccurredOn}
            optional
          />
          <TextField
            label="What happened"
            placeholder="The charge sheet was filed"
            value={description}
            onChange={setDescription}
          />
          <TextArea
            label="Your notes"
            rows={3}
            hint="Anything you want to remember: who you spoke to, what you were told."
            value={notes}
            onChange={setNotes}
          />

          <p className="text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            This is saved as something you told us. We have no connection to any
            court or police system, so nothing here is marked as coming from an
            official source.
          </p>

          {error && <ErrorNote message={error} />}

          <div className="flex flex-wrap gap-3">
            <SaveButton
              disabled={busy || stage.length === 0 || !description.trim()}
              label="Add to timeline"
              onSave={async () => {
                await onAdd({
                  stage: stage[0],
                  occurredOn: occurredOn || undefined,
                  status: "COMPLETED",
                  description: description.trim(),
                  notes: notes.trim() || undefined,
                  verification: "USER_REPORTED",
                });
                setStage([]);
                setOccurredOn("");
                setDescription("");
                setNotes("");
                setAdding(false);
              }}
            />
            <button
              onClick={() => setAdding(false)}
              className="btn-ghost px-5 py-3 text-[0.9375rem]"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};
