import React, { useState } from "react";
import { CalendarClock, Trash2, Plus } from "lucide-react";
import { ErrorNote, SaveButton, TextField, formatDate } from "./RecoveryPrimitives";
import type { RecoveryHearing } from "../../types/recovery";

/**
 * Court dates, and the choice to let a counsellor see them.
 *
 * WHY THE TWO LIVE IN ONE CARD
 *
 * The decision to share only means something next to the thing being shared.
 * A toggle on a settings screen, three taps away from the list it governs,
 * asks someone to consent to an abstraction. Here the dates are directly
 * above the switch, so "share these" has a visible subject.
 *
 * WHY THE COPY NAMES WHAT IS *NOT* SENT
 *
 * A survivor deciding this is not weighing a feature, they are weighing
 * whether the person they talk to is about to learn their FIR number and what
 * happened to them. Saying only "we share your dates" leaves them to guess at
 * the boundary. Listing what stays behind is the part that makes the answer
 * informed, so it is in the copy rather than in a help page.
 */

interface Props {
  hearings: RecoveryHearing[];
  sharing: boolean;
  busy: boolean;
  error: string | null;
  onAddHearing: (date: string, note: string) => Promise<void>;
  onRemoveHearing: (id: string) => Promise<void>;
  onToggleSharing: (on: boolean) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);

export const CourtDatesCard: React.FC<Props> = ({
  hearings,
  sharing,
  busy,
  error,
  onAddHearing,
  onRemoveHearing,
  onToggleSharing,
}) => {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  /**
   * Soonest upcoming date first, then past ones most-recent first.
   *
   * Plain chronological order would push the next hearing further down the
   * list every time an old one is added, and the next one is the only date on
   * this card that anybody has to do anything about.
   */
  const now = today();
  const all = [...(hearings || [])];
  const upcoming = all
    .filter((h) => h.hearingOn >= now)
    .sort((a, b) => a.hearingOn.localeCompare(b.hearingOn));
  const past = all
    .filter((h) => h.hearingOn < now)
    .sort((a, b) => b.hearingOn.localeCompare(a.hearingOn));
  const ordered = [...upcoming, ...past];

  const submit = async () => {
    if (!date) return;
    await onAddHearing(date, note);
    setDate("");
    setNote("");
    setAdding(false);
  };

  return (
    <section className="card-elev space-y-5 rounded-2xl p-5 sm:p-6">
      <div className="space-y-2">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          <CalendarClock size={13} aria-hidden="true" />
          Court dates
        </span>
        <h2 className="font-serif text-[1.25rem] leading-[1.3] text-[#3A2A1E]">
          When you have to be there
        </h2>
        <p className="max-w-[58ch] text-[0.9375rem] leading-[1.7] text-[#6B5B4C]">
          The week before a hearing is hard, and so are the days after. Keeping
          the dates here means you have them in one place.
        </p>
      </div>

      {ordered.length > 0 && (
        <ul className="space-y-2.5">
          {ordered.map((h) => {
            const past = h.hearingOn < now;
            return (
              <li
                key={h.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-4 py-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <p
                    className={`text-[0.9375rem] font-semibold ${
                      past ? "text-[#6F5F4F]" : "text-[#3A2A1E]"
                    }`}
                  >
                    {formatDate(h.hearingOn)}
                    {past && (
                      <span className="ml-2 text-[0.75rem] font-normal text-[#6B5B4C]">
                        already passed
                      </span>
                    )}
                  </p>
                  {h.note && (
                    <p className="text-[0.875rem] leading-[1.6] text-[#6B5B4C]">{h.note}</p>
                  )}
                </div>
                <button
                  onClick={() => onRemoveHearing(h.id)}
                  disabled={busy}
                  aria-label={`Remove the hearing on ${formatDate(h.hearingOn)}`}
                  className="shrink-0 rounded-full p-2 text-[#8A4A20] transition-colors hover:bg-[#F4E7DA] disabled:opacity-50"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <Plus size={16} aria-hidden="true" />
          {ordered.length > 0 ? "Add another date" : "Add a court date"}
        </button>
      ) : (
        <div className="space-y-4 border-t border-[#EDE2D4] pt-5">
          <TextField label="Date" type="date" value={date} onChange={setDate} />
          <TextField
            label="A note for yourself"
            placeholder="District court, the one my brother is testifying at"
            value={note}
            onChange={setNote}
            optional
          />
          <p className="text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            This note stays in your file. It is never sent to your counsellor,
            even when sharing is on.
          </p>
          <div className="flex flex-wrap gap-3">
            <SaveButton onSave={submit} disabled={!date || busy} label="Save this date" />
            <button
              onClick={() => {
                setAdding(false);
                setDate("");
                setNote("");
              }}
              className="btn-ghost px-5 py-3 text-[0.9375rem]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}

      <div className="space-y-3 border-t border-[#EDE2D4] pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-[1rem] font-semibold text-[#3A2A1E]">
              Let my counsellor see these dates
            </h3>
            <p className="max-w-[54ch] text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
              They see the dates only &mdash; the day a hearing falls on, and
              the day your FIR was filed. Nothing else from this file crosses
              over: not your FIR number, not your documents, not what you wrote
              about what happened, not the notes above.
            </p>
          </div>
          <button
            onClick={() => onToggleSharing(!sharing)}
            disabled={busy}
            role="switch"
            aria-checked={sharing}
            aria-label="Let my counsellor see these dates"
            className={`relative h-6 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
              sharing ? "bg-[#8A4A20]" : "bg-[#EFE8E2]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-xs transition-all ${
                sharing ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        <p className="text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          {sharing ? (
            <>
              Your counsellor can see a hearing coming and check in before it,
              rather than hearing about it afterwards. Turn this off whenever
              you want and the dates are removed from their side straight away.
            </>
          ) : (
            <>
              Off. Your counsellor cannot see any of this. Nothing is shared
              until you turn this on, and you can turn it off again at any time.
            </>
          )}
        </p>

        {upcoming.length === 0 && sharing && (
          <p className="text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            There are no upcoming dates to share right now. Anything you add
            while this is on is shared as you add it.
          </p>
        )}
      </div>

      {error && <ErrorNote message={error} />}
    </section>
  );
};
