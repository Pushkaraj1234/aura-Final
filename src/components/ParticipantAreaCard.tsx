import React, { useState } from "react";
import { MapPin, Check } from "lucide-react";
import { INDIAN_STATES } from "../services/indianStates";
import { participantStore } from "../services/participantStore";

interface Props {
  participantId: string;
  state?: string;
  district?: string;
  onSaved?: () => void;
}

/**
 * Lets a participant say which State and district they live in, if they want.
 *
 * Optional and explained in plain words: it is used only for anonymous
 * district and State totals and so the right district office can be told
 * about an urgent case by case number, never by name.
 */
export const ParticipantAreaCard: React.FC<Props> = ({ participantId, state = "", district = "", onSaved }) => {
  const [s, setS] = useState(state);
  const [d, setD] = useState(district);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = s.trim() !== state.trim() || d.trim() !== district.trim();

  const save = async () => {
    if (!s.trim() || !d.trim()) {
      setMessage({ ok: false, text: "Choose a State and type your district, or leave both as they are." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const ok = await participantStore.setLocation(participantId, s, d);
    setSaving(false);
    setMessage(
      ok
        ? { ok: true, text: "Saved." }
        : { ok: false, text: "Saved on this device, but it couldn't reach the server. It will be sent next time." }
    );
    if (ok) onSaved?.();
  };

  return (
    <section className="rounded-3xl border border-[#E0D7CE] bg-white p-6 sm:p-7 shadow-xs">
      <div className="flex items-start gap-4">
        <span className="flex items-center justify-center h-12 w-12 rounded-2xl bg-[#FBF3EC] text-[#A55D25] shrink-0">
          <MapPin size={22} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-[#3C3530]">Your area (optional)</h3>
            <p className="text-sm text-[#6B5B4C] leading-relaxed max-w-xl">
              Used only for anonymous district and State totals, and so the right district office can be told
              about an urgent case by case number, never by name.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <select
              value={s}
              onChange={(e) => setS(e.target.value)}
              aria-label="State or Union Territory"
              className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] text-sm"
            >
              <option value="">State / UT</option>
              {INDIAN_STATES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={d}
              maxLength={120}
              onChange={(e) => setD(e.target.value)}
              placeholder="District"
              aria-label="District"
              className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] placeholder:text-[#B9B0A6] text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-5 py-2.5 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {message && (
              <span
                role="status"
                className={`text-sm inline-flex items-center gap-1 ${message.ok ? "text-[#2F6B4F]" : "text-[#A55D25]"}`}
              >
                {message.ok && <Check size={14} aria-hidden="true" />}
                {message.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
