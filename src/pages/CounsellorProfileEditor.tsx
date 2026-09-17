import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Upload, CheckCircle2, CalendarPlus, Star } from "lucide-react";
import {
  CounsellorGender,
  CounsellingSession,
  CounsellorProfile,
  SessionFormat,
  SupportTag,
  User,
  Participant,
  ReceivedSwitchFeedback,
} from "../types";
import { counsellorSelectionService } from "../services/counsellorSelectionService";

interface Props {
  user: User;
  participants: Participant[];
  onBack: () => void;
}

const FORMATS: SessionFormat[] = ["video", "audio", "chat"];
const GENDERS: Array<{ value: CounsellorGender; label: string }> = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EMPTY: CounsellorProfile = {
  workerId: "",
  displayName: "",
  bio: "",
  specialties: [],
  languages: [],
  sessionFormats: [],
  yearsExperience: null,
  gender: null,
  acceptingNewClients: false,
  maxCaseload: null,
  published: false,
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
      active
        ? "bg-[#5A5049] text-white border-[#5A5049]"
        : "bg-white text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
    }`}
  >
    {children}
  </button>
);

/**
 * A counsellor's own public profile, and the session log.
 *
 * Publishing is opt-in and off by default: being listed in a directory people
 * browse is a decision, not something that happens to a counsellor because a
 * feature shipped.
 *
 * The session log is deliberately here rather than buried in case notes,
 * because nothing else makes reviews reachable — a review can only be written
 * against a session that has been marked completed.
 */
export const CounsellorProfileEditor: React.FC<Props> = ({ user, participants, onBack }) => {
  const [profile, setProfile] = useState<CounsellorProfile>({ ...EMPTY, workerId: user.id });
  const [tags, setTags] = useState<SupportTag[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  // What people wrote on their way to someone else. See the migration for what
  // is deliberately not in these rows.
  const [exitNotes, setExitNotes] = useState<ReceivedSwitchFeedback[]>([]);
  const [logParticipant, setLogParticipant] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logFormat, setLogFormat] = useState<SessionFormat>("video");

  const mine = participants.filter((p) => p.assignedWorker === user.id);

  useEffect(() => {
    (async () => {
      // allSettled: supabase-js rejects on an aborted request, and with
      // Promise.all one failure left this editor stuck on "Loading…".
      const [existingR, tagR, sR, exitR] = await Promise.allSettled([
        counsellorSelectionService.getOwnProfile(user.id),
        counsellorSelectionService.listTags(),
        counsellorSelectionService.listWorkerSessions(user.id),
        counsellorSelectionService.listSwitchFeedbackAboutMe(),
      ]);
      if (existingR.status === "fulfilled" && existingR.value) setProfile(existingR.value);
      if (tagR.status === "fulfilled") setTags(tagR.value);
      if (sR.status === "fulfilled") setSessions(sR.value);
      if (exitR.status === "fulfilled") setExitNotes(exitR.value);
      setLoading(false);
    })();
  }, [user.id]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const save = async () => {
    setSaving(true);
    setError(null);
    const message = await counsellorSelectionService.saveOwnProfile(profile);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const onPhoto = async (file: File) => {
    const path = await counsellorSelectionService.uploadPhoto(user.id, file);
    if (!path) {
      setError("The photo could not be uploaded.");
      return;
    }
    const updated = { ...profile, photoPath: path };
    setProfile(updated);
    await counsellorSelectionService.saveOwnProfile(updated);
    const refreshed = await counsellorSelectionService.getOwnProfile(user.id);
    if (refreshed) setProfile(refreshed);
  };

  const logSession = async () => {
    if (!logParticipant) return;
    setError(null);
    const message = await counsellorSelectionService.logSession({
      participantId: logParticipant,
      workerId: user.id,
      heldAt: new Date(logDate).toISOString(),
      format: logFormat,
    });
    if (message) {
      setError(message);
      return;
    }
    setLogParticipant("");
    setSessions(await counsellorSelectionService.listWorkerSessions(user.id));
  };

  if (loading) {
    return <p className="max-w-4xl mx-auto px-4 py-8 text-sm text-[#6B635C]">Loading…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-[#5A5049] hover:text-[#3C3530] cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#3C3530]">Your public profile</h1>
        <p className="text-sm text-[#6B635C] mt-2 max-w-2xl">
          This is what someone sees when they are choosing a counsellor. It is separate from your
          account details, and nothing here is visible until you publish it.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#B0713C]/40 bg-[#B0713C]/5 px-4 py-3 text-sm text-[#8A5A2B]">
          {error}
        </div>
      )}

      <div
        className={`rounded-3xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          profile.published
            ? "border-[#2F6B4F]/30 bg-[#2F6B4F]/5"
            : "border-[#DBC3B2]/50 bg-[#FFF6EC]"
        }`}
      >
        <div className="w-11 h-11 rounded-2xl bg-white/70 text-[#8A5A2B] flex items-center justify-center shrink-0">
          {profile.published ? <Eye size={18} /> : <EyeOff size={18} />}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-[#3C3530] text-sm">
            {profile.published ? "Listed in the directory" : "Not listed yet"}
          </h2>
          <p className="text-xs text-[#6B635C] mt-1">
            {profile.published
              ? "People choosing a counsellor can see this profile and select you."
              : "Nobody can see this profile or choose you from the directory. Admin assignment is unaffected either way."}
          </p>
        </div>
        <button
          onClick={() => setProfile((p) => ({ ...p, published: !p.published }))}
          className="px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer shrink-0"
        >
          {profile.published ? "Unlist me" : "Publish my profile"}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover bg-[#EFE8E2]" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#EFE8E2] flex items-center justify-center text-[#9A928C] text-xs">
              No photo
            </div>
          )}
          <label className="px-4 py-2 rounded-xl bg-white border border-[#EFE8E2] text-[#5A5049] text-xs font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer inline-flex items-center gap-2">
            <Upload size={14} />
            Upload a photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">Display name</label>
            <input
              value={profile.displayName || ""}
              onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
              placeholder={user.name}
              data-no-translate
              className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">Years of experience</label>
            <input
              type="number"
              min={0}
              max={70}
              value={profile.yearsExperience ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  yearsExperience: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#5A5049] block mb-1.5">
            Short bio <span className="font-normal text-[#9A928C]">({600 - (profile.bio?.length || 0)} left)</span>
          </label>
          <textarea
            rows={4}
            value={profile.bio || ""}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value.slice(0, 600) }))}
            data-no-translate
            className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-bold text-[#5A5049] mb-2">Specialty areas</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Chip
                key={t.tag}
                active={profile.specialties.includes(t.tag)}
                onClick={() =>
                  setProfile((p) => ({ ...p, specialties: toggle(p.specialties, t.tag) }))
                }
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-[#5A5049] mb-2">Languages you can work in</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {profile.languages.map((l) => (
              <Chip
                key={l}
                active
                onClick={() => setProfile((p) => ({ ...p, languages: toggle(p.languages, l) }))}
              >
                {l} ×
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={languageInput}
              onChange={(e) => setLanguageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && languageInput.trim()) {
                  e.preventDefault();
                  setProfile((p) => ({
                    ...p,
                    languages: Array.from(new Set([...p.languages, languageInput.trim()])),
                  }));
                  setLanguageInput("");
                }
              }}
              placeholder="Type a language and press Enter"
              data-no-translate
              className="flex-1 p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-[#5A5049] mb-2">Session formats you offer</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Chip
                key={f}
                active={profile.sessionFormats.includes(f)}
                onClick={() =>
                  setProfile((p) => ({ ...p, sessionFormats: toggle(p.sessionFormats, f) }))
                }
              >
                {f}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-[#5A5049] mb-2">
            How you would like to be described <span className="font-normal text-[#9A928C]">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                active={profile.gender === g.value}
                onClick={() =>
                  setProfile((p) => ({ ...p, gender: p.gender === g.value ? null : g.value }))
                }
              >
                {g.label}
              </Chip>
            ))}
          </div>
          <p className="text-[11px] text-[#6B635C] mt-2">
            Used only so someone who asked for a particular counsellor can be matched. Leave it blank
            and you simply will not appear for that filter.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-[#EFE8E2]">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A5049] cursor-pointer">
            <input
              type="checkbox"
              checked={profile.acceptingNewClients}
              onChange={(e) =>
                setProfile((p) => ({ ...p, acceptingNewClients: e.target.checked }))
              }
              className="accent-[#5A5049] cursor-pointer"
            />
            I am accepting new clients
          </label>
          <div>
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">
              Maximum caseload <span className="font-normal text-[#9A928C]">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={profile.maxCaseload ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  maxCaseload: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
            />
            <p className="text-[11px] text-[#6B635C] mt-1.5">
              Once you reach this, you stop showing as available even if the box above is ticked.
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#5A5049] transition-colors cursor-pointer disabled:opacity-50"
        >
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save profile"}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="font-bold text-[#3C3530]">Session log</h2>
          <p className="text-xs text-[#6B635C] mt-1.5 max-w-2xl">
            Record a session once it has happened. This is attendance only. No notes are stored
            here. It matters because someone can only review a session that has been logged as
            completed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[12rem]">
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">Participant</label>
            <select
              value={logParticipant}
              onChange={(e) => setLogParticipant(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] bg-white cursor-pointer"
            >
              <option value="">Select…</option>
              {mine.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">Date held</label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#5A5049] block mb-1.5">Format</label>
            <select
              value={logFormat}
              onChange={(e) => setLogFormat(e.target.value as SessionFormat)}
              className="p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] bg-white cursor-pointer"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={logSession}
            disabled={!logParticipant}
            className="px-4 py-3 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <CalendarPlus size={14} />
            Log session
          </button>
        </div>

        {mine.length === 0 && (
          <p className="text-xs text-[#6B635C]">
            You have no participants assigned yet, so there is nothing to log.
          </p>
        )}

        {sessions.length > 0 && (
          <ul className="divide-y divide-[#EFE8E2] border-t border-[#EFE8E2] pt-2">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="py-2.5 flex items-center gap-3 text-sm">
                <CheckCircle2 size={14} className="text-[#2F6B4F] shrink-0" />
                <span className="text-[#3C3530] font-medium" data-no-translate>
                  {s.participantId}
                </span>
                <span className="text-xs text-[#6B635C]">
                  {s.heldAt ? new Date(s.heldAt).toLocaleDateString() : "—"} · {s.format}
                </span>
                <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-[#6B635C]">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* What people said on their way out.
          Renders nothing when there is nothing — a counsellor should not be
          shown an empty "feedback" box every time they open their profile. */}
      {exitNotes.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-8 space-y-4 shadow-xs">
          <div>
            <h2 className="font-bold text-[#3C3530]">When someone moved on</h2>
            <p className="text-xs text-[#6B635C] mt-1.5 max-w-2xl leading-relaxed">
              People can change counsellor at any time, for any reason, and most say
              nothing. These are the ones who chose to. You are not shown who wrote them
              or when, and nothing here is part of anyone&rsquo;s record. It is here so
              it can be useful to you.
            </p>
          </div>

          <ul className="space-y-3">
            {exitNotes.map((n) => (
              <li key={n.id} className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4">
                <div className="flex items-center gap-2">
                  {n.rating ? (
                    <span className="inline-flex items-center gap-0.5 text-[#8A5A2B]">
                      {Array.from({ length: n.rating }).map((_, i) => (
                        <Star key={i} size={12} className="fill-current" />
                      ))}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#9A928C] font-semibold">No rating</span>
                  )}
                  <span className="ml-auto text-[11px] text-[#9A928C] font-semibold">
                    {n.receivedMonth}
                  </span>
                </div>
                {n.body && (
                  <p className="text-sm text-[#5A5049] mt-2 leading-relaxed" data-no-translate>
                    {n.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
