import React, { useEffect, useMemo, useState } from "react";
import { HeartPulse, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { authService } from "../services/authService";

/**
 * Counselor wellbeing / burnout self-check.
 *
 * Vicarious trauma and burnout are a documented occupational risk for people
 * doing trauma-focused work with atrocity survivors, and most systems in this
 * space only monitor the survivors, never the responders. This is a brief,
 * private, opt-in self-check the worker can do as often as they like.
 *
 * It is deliberately NOT a clinical instrument and NOT shared with anyone —
 * entries are stored only in this browser (localStorage), keyed to the signed
 * in worker, exactly the way a private journal would be. It surfaces a simple
 * strain index and gentle, non-prescriptive guidance.
 */

interface Entry {
  at: string;
  exhaustion: number; // 1 (not at all) .. 5 (completely) — higher = worse
  detachment: number; // 1 .. 5 — higher = worse
  accomplishment: number; // 1 (none) .. 5 (strong) — higher = better
  sleep: number; // 1 (very poor) .. 5 (restful) — higher = better
  index: number; // 0..100, higher = more strain
}

const STORAGE_PREFIX = "aura_worker_wellbeing_";

const QUESTIONS: { key: keyof Omit<Entry, "at" | "index">; label: string; low: string; high: string; reverse?: boolean }[] = [
  { key: "exhaustion", label: "Emotional exhaustion this week", low: "Not at all", high: "Completely drained" },
  { key: "detachment", label: "Feeling detached or numb toward the work", low: "Not at all", high: "Very much" },
  { key: "accomplishment", label: "Sense of doing meaningful, effective work", low: "None", high: "Strong", reverse: true },
  { key: "sleep", label: "Sleep quality recently", low: "Very poor", high: "Restful", reverse: true },
];

function computeIndex(v: { exhaustion: number; detachment: number; accomplishment: number; sleep: number }): number {
  // Each sub-score contributes 0..25 strain points.
  const strain =
    ((v.exhaustion - 1) / 4) * 25 +
    ((v.detachment - 1) / 4) * 25 +
    ((5 - v.accomplishment) / 4) * 25 +
    ((5 - v.sleep) / 4) * 25;
  return Math.round(Math.max(0, Math.min(100, strain)));
}

function band(index: number): { label: string; tone: string; note: string } {
  if (index < 30)
    return {
      label: "Low strain",
      tone: "#2F6B4F",
      note: "Things look steady. Keep the habits that are working for you.",
    };
  if (index < 55)
    return {
      label: "Moderate strain",
      tone: "#A55D25",
      note: "Some load is building. A proper break, a peer conversation, or lightening this week's caseload can help.",
    };
  return {
    label: "High strain",
    tone: "#B23A2E",
    note: "This is a lot to carry. Please consider talking to your supervisor about caseload and support, and using your own counseling or EAP options.",
  };
}

export const WorkerWellbeingCheck: React.FC = () => {
  const user = authService.getCurrentUser();
  const storageKey = STORAGE_PREFIX + (user?.id || "anon");

  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [draft, setDraft] = useState({ exhaustion: 3, detachment: 3, accomplishment: 3, sleep: 3 });
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore — private convenience only */
    }
  }, [storageKey]);

  const latest = history[0];
  const draftIndex = useMemo(() => computeIndex(draft), [draft]);

  const save = () => {
    const entry: Entry = { at: new Date().toISOString(), ...draft, index: draftIndex };
    const next = [entry, ...history].slice(0, 24);
    setHistory(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const shown = latest ?? null;
  const shownBand = band(shown ? shown.index : draftIndex);

  return (
    <div className="card-elev rounded-[2rem] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#FDF9F5] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DBC3B2]/25 text-[#5A5049] flex items-center justify-center">
            <HeartPulse size={18} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-[#3C3530]">Your wellbeing check</p>
            <p className="text-[11px] text-[#7F8C8D]">
              Private to you · vicarious-trauma & burnout self-check
              {shown && (
                <>
                  {" "}
                  · last:{" "}
                  <span style={{ color: shownBand.tone }} className="font-bold">
                    {shownBand.label}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-[#7F8C8D]" /> : <ChevronDown size={16} className="text-[#7F8C8D]" />}
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-[#EFE8E2] space-y-5">
          <div className="flex items-start gap-2 text-[11px] text-[#7A726C] bg-[#FDF9F5] border border-[#EFE8E2] rounded-xl p-3">
            <ShieldCheck size={14} className="text-[#5A5049] shrink-0 mt-0.5" />
            <span>
              Not a clinical assessment and never shared. Stored only in this browser so you can track your own load
              over time.
            </span>
          </div>

          <div className="space-y-4">
            {QUESTIONS.map((q) => (
              <div key={q.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#3C3530]">{q.label}</label>
                  <span className="text-xs font-black text-[#5A5049]">{draft[q.key]}/5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={draft[q.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [q.key]: Number(e.target.value) }))}
                  className="w-full accent-[#5A5049] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#7F8C8D] mt-0.5">
                  <span>{q.low}</span>
                  <span>{q.high}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 border" style={{ borderColor: `${shownBand.tone}44`, backgroundColor: `${shownBand.tone}0F` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: shownBand.tone }}>
                Current self-check: {band(draftIndex).label}
              </span>
              <span className="text-lg font-black" style={{ color: shownBand.tone }}>
                {draftIndex}/100
              </span>
            </div>
            <p className="text-[11px] text-[#5A5049] mt-1">{band(draftIndex).note}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              className="px-4 py-2.5 rounded-xl bg-[#3C3530] text-white text-xs font-bold hover:bg-[#3F4E4E] transition-colors cursor-pointer"
            >
              Save today's check
            </button>
            {justSaved && <span className="text-xs font-bold text-[#2F6B4F]">Saved privately.</span>}
          </div>

          {history.length > 1 && (
            <div className="pt-3 border-t border-[#EFE8E2]">
              <p className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-2">Recent checks</p>
              <div className="flex items-end gap-1.5 h-16">
                {history
                  .slice(0, 14)
                  .reverse()
                  .map((h) => {
                    const b = band(h.index);
                    return (
                      <div
                        key={h.at}
                        title={`${new Date(h.at).toLocaleDateString()} — ${b.label} (${h.index}/100)`}
                        className="flex-1 rounded-t-md min-w-[6px]"
                        style={{ height: `${Math.max(6, h.index)}%`, backgroundColor: b.tone, opacity: 0.85 }}
                      />
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
