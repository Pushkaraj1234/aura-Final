import React, { useMemo, useState } from "react";
import { UserCog, ChevronDown, ChevronUp } from "lucide-react";
import { authService } from "../services/authService";

/**
 * Counsellor self-service profile: languages spoken, availability, and the
 * caseload ceiling they're comfortable with. Stored in Supabase Auth
 * user_metadata (via authService.updateWorkerProfile) plus the local session.
 * Collapsed by default so it doesn't compete with the caseload for attention.
 */
export const WorkerProfileCard: React.FC = () => {
  const worker = useMemo(() => authService.getCurrentUser(), []);
  const [open, setOpen] = useState(false);
  const [languages, setLanguages] = useState(worker?.languages || "");
  const [availability, setAvailability] = useState(worker?.availability || "");
  const [maxCaseload, setMaxCaseload] = useState<string>(
    worker?.maxCaseload != null ? String(worker.maxCaseload) : ""
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!worker || worker.role !== "support_worker") return null;

  const summary = [
    languages && `Speaks ${languages}`,
    availability && availability,
    maxCaseload && `Max ${maxCaseload} cases`,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateWorkerProfile({
        languages,
        availability,
        maxCaseload: maxCaseload.trim() === "" ? undefined : Number(maxCaseload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-elev rounded-3xl p-5 sm:p-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[#F1E7DA] text-[#9A5B33] flex items-center justify-center shrink-0">
            <UserCog size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#3A2A1E]">Your profile</h3>
            <p className="text-[12px] text-[#8A7A6B] truncate">
              {summary || "Add your languages, availability and caseload limit"}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-[#8A7A6B] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[#8A7A6B] shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-[12px] font-medium text-[#6E5F4E] space-y-1.5 sm:col-span-1">
            <span>Languages</span>
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, Hindi, Marathi"
              className="w-full p-2.5 rounded-xl border border-[#ECE1D3] bg-white text-[13px] text-[#3A2A1E] focus:outline-none focus:ring-2 focus:ring-[#C88A5A]"
            />
          </label>

          <label className="text-[12px] font-medium text-[#6E5F4E] space-y-1.5 sm:col-span-1">
            <span>Availability</span>
            <input
              type="text"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="Weekdays 9–5 IST"
              className="w-full p-2.5 rounded-xl border border-[#ECE1D3] bg-white text-[13px] text-[#3A2A1E] focus:outline-none focus:ring-2 focus:ring-[#C88A5A]"
            />
          </label>

          <label className="text-[12px] font-medium text-[#6E5F4E] space-y-1.5 sm:col-span-1">
            <span>Max caseload</span>
            <input
              type="number"
              min={0}
              value={maxCaseload}
              onChange={(e) => setMaxCaseload(e.target.value)}
              placeholder="15"
              className="w-full p-2.5 rounded-xl border border-[#ECE1D3] bg-white text-[13px] text-[#3A2A1E] focus:outline-none focus:ring-2 focus:ring-[#C88A5A]"
            />
          </label>

          <div className="sm:col-span-3 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-4 py-2 text-[12px] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            {saved && <span className="text-[12px] font-medium text-[#5E7148]">✓ Saved</span>}
            <span className="text-[11px] text-[#A99A8A]">
              Helps the assignment engine match you to the right participants.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerProfileCard;
