import React, { useMemo, useState } from "react";
import { Gavel, Plus, Trash2, ShieldAlert, CalendarClock } from "lucide-react";
import { CaseEvent, CaseEventType } from "../types";
import {
  CASE_EVENT_LABELS,
  describeTiming,
  isIncident,
  newCaseEventId,
  readCaseEvents,
} from "../services/caseEvents";

interface Props {
  participantId: string;
  events: CaseEvent[];
  recordedBy: string;
  onAdd: (event: CaseEvent) => void;
  onRemove: (eventId: string) => void;
}

const TYPE_ORDER: CaseEventType[] = ["hearing", "threat", "intimidation", "police_contact", "other"];

/**
 * Where a counsellor records the dates that drive this case.
 *
 * The form defaults to a hearing and to today, because those are the two
 * things most often being entered, and a case worker adding a date between
 * appointments should not have to think about the interface.
 *
 * Deliberately counsellor-only. A list of the threats made against someone,
 * rendered back to them, is not support.
 */
export const CaseEventsCard: React.FC<Props> = ({
  participantId,
  events,
  recordedBy,
  onAdd,
  onRemove,
}) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CaseEventType>("hearing");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const reading = useMemo(() => readCaseEvents(events), [events]);

  const ordered = useMemo(
    () =>
      [...(events || [])]
        .filter((e) => Number.isFinite(new Date(e.date).getTime()))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events]
  );

  const submit = () => {
    if (!date) return;
    onAdd({
      id: newCaseEventId(),
      participantId,
      type,
      // Midday, so a date does not drift across a day boundary by timezone.
      date: new Date(`${date}T12:00:00`).toISOString(),
      note: note.trim() || undefined,
      recordedBy,
      recordedAt: new Date().toISOString(),
    });
    setNote("");
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE8E2] shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#68625D] flex items-center gap-1.5">
            <Gavel size={13} className="text-[#5A5049]" />
            <span>Case timeline</span>
          </span>
          <h3 className="text-xl font-black text-[#3C3530]">Hearings &amp; incidents</h3>
          <p className="text-xs text-[#6B635C] leading-relaxed max-w-lg">
            A hearing date is the one pressure that can be seen coming. Recording it lets AURA
            raise this case before the day rather than after it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#3F4E4E] transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>Record</span>
        </button>
      </div>

      {/* What the dates currently add up to, before the list of them. */}
      {(reading.nextHearing || reading.recentIncidents.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {reading.nextHearing && reading.daysToNextHearing !== null && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#D49B6A]/15 text-[#8A4A20]">
              <CalendarClock size={12} />
              Next hearing {describeTiming(reading.daysToNextHearing)}
            </span>
          )}
          {reading.recentIncidents.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#A55D25]/12 text-[#A55D25]">
              <ShieldAlert size={12} />
              {reading.recentIncidents.length} incident
              {reading.recentIncidents.length === 1 ? "" : "s"} in the last fortnight
            </span>
          )}
          {reading.hearingCount > 1 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#EFE8E2] text-[#5A5049]">
              {reading.hearingCount} hearings on record
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#68625D]">
                What happened
              </span>
              <select
                value={type}
                data-case-event-type
                onChange={(e) => setType(e.target.value as CaseEventType)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2] cursor-pointer"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {CASE_EVENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#68625D]">
                Date {type === "hearing" ? "(may be in the future)" : ""}
              </span>
              <input
                type="date"
                value={date}
                data-case-event-date
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2]"
              />
            </label>
          </div>

          <input
            type="text"
            value={note}
            data-case-event-note
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: a short note for your own records"
            className="w-full px-3 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] placeholder:text-[#B9B0A6] focus:outline-none focus:ring-2 focus:ring-[#DBC3B2]"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              data-case-event-save
              className="px-4 py-2.5 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#3F4E4E] transition-colors cursor-pointer"
            >
              Save to case
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[#EFE8E2] text-[#5A5049] text-xs font-bold hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="text-xs text-[#68625D] italic">
          Nothing recorded yet. Adding a hearing date is the single most useful thing here.
        </p>
      ) : (
        <ul className="space-y-2" data-case-event-list>
          {ordered.map((e) => {
            const days = Math.round(
              (new Date(e.date).getTime() - Date.now()) / 86_400_000
            );
            const upcoming = days >= 0;
            return (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 py-2.5 border-t border-[#EFE8E2]"
              >
                <div className="min-w-0 flex items-start gap-2.5">
                  {isIncident(e.type) ? (
                    <ShieldAlert size={14} className="text-[#A55D25] shrink-0 mt-0.5" />
                  ) : (
                    <Gavel size={14} className="text-[#5A5049] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#3C3530]">
                      {CASE_EVENT_LABELS[e.type]}{" "}
                      <span
                        className={`text-xs font-semibold ${
                          upcoming ? "text-[#8A4A20]" : "text-[#68625D]"
                        }`}
                      >
                        · {describeTiming(days)}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#68625D]">
                      {new Date(e.date).toLocaleDateString()}
                      {e.note && <span data-no-translate> — {e.note}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  aria-label={`Remove ${CASE_EVENT_LABELS[e.type]}`}
                  className="shrink-0 p-1.5 rounded-lg text-[#6F5F4F] hover:text-[#A55D25] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
