import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  Star,
  ShieldCheck,
  Info,
} from "lucide-react";
import {
  CounsellorDirectoryEntry,
  CounsellingSession,
  GenderPreference,
  MatchingQuizAnswers,
  OwnReview,
  SessionFormat,
  StartUrgency,
  SupportTag,
  User,
} from "../types";
import { counsellorSelectionService } from "../services/counsellorSelectionService";
import { rankCounsellors, shortlistWasWidened } from "../services/counsellorMatching";
import { CounsellorCard } from "../components/CounsellorCard";

interface Props {
  user: User;
  participantId: string;
  currentWorkerId?: string | null;
  /**
   * Told that the database now says something different. Without this the
   * switch succeeded and every other screen went on showing the old
   * counsellor: the participant record is read from a local cache that is only
   * refilled from the server at startup.
   */
  onAssignmentChanged?: (workerId: string) => void;
  onBack: () => void;
}

type Tab = "find" | "sessions";

const EMPTY_ANSWERS: MatchingQuizAnswers = {
  lookingFor: [],
  preferredLanguages: [],
  genderPreference: "no_preference",
  preferredFormats: [],
  startUrgency: "no_rush",
};

const FORMATS: SessionFormat[] = ["video", "audio", "chat"];
const URGENCIES: Array<{ value: StartUrgency; label: string }> = [
  { value: "asap", label: "As soon as possible" },
  { value: "this_week", label: "Within a week" },
  { value: "no_rush", label: "No rush" },
];
const GENDERS: Array<{ value: GenderPreference; label: string }> = [
  { value: "no_preference", label: "No preference" },
  { value: "woman", label: "A woman" },
  { value: "man", label: "A man" },
  { value: "non_binary", label: "A non-binary counsellor" },
];

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
 * Choosing, switching and reviewing a counsellor.
 *
 * The quiz is skippable from every step and never gates the directory — the
 * "browse everyone" route is always one click away, and the page opens on the
 * full list rather than on the questions. Someone who does not want to answer
 * anything should not have to.
 */
export const ChooseCounsellor: React.FC<Props> = ({
  user,
  participantId,
  currentWorkerId,
  onAssignmentChanged,
  onBack,
}) => {
  const [tab, setTab] = useState<Tab>("find");
  const [counsellors, setCounsellors] = useState<CounsellorDirectoryEntry[]>([]);
  const [tags, setTags] = useState<SupportTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<MatchingQuizAnswers>(EMPTY_ANSWERS);
  const [shortlistFor, setShortlistFor] = useState<MatchingQuizAnswers | null>(null);

  // Browse filters
  const [filterSpecialty, setFilterSpecialty] = useState<string>("");
  const [filterLanguage, setFilterLanguage] = useState<string>("");
  const [filterFormat, setFilterFormat] = useState<string>("");
  const [availableOnly, setAvailableOnly] = useState(false);

  // Who the app believes is assigned right now. Seeded from the prop and
  // moved forward the moment a switch succeeds, so the cards below re-badge
  // without waiting for the record to travel back down through the store.
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(currentWorkerId ?? null);
  useEffect(() => {
    setActiveWorkerId(currentWorkerId ?? null);
  }, [currentWorkerId]);

  // The optional "why did you change?" note, offered only after moving away
  // from someone. Nothing here is required and skipping it costs nothing.
  const [leftWorkerId, setLeftWorkerId] = useState<string | null>(null);
  const [leftRating, setLeftRating] = useState(0);
  const [leftBody, setLeftBody] = useState("");
  const [leftSaving, setLeftSaving] = useState(false);

  // Sessions and reviews
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [ownReviews, setOwnReviews] = useState<OwnReview[]>([]);
  const [reviewFor, setReviewFor] = useState<CounsellingSession | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // allSettled: supabase-js rejects on an aborted request, and with
      // Promise.all one failure left this page loading forever.
      const [listR, tagR, priorR] = await Promise.allSettled([
        counsellorSelectionService.listCounsellors(),
        counsellorSelectionService.listTags(),
        counsellorSelectionService.latestQuiz(participantId),
      ]);
      if (cancelled) return;
      const list = listR.status === "fulfilled" ? listR.value : [];
      const tagList = tagR.status === "fulfilled" ? tagR.value : [];
      const prior = priorR.status === "fulfilled" ? priorR.value : null;
      setCounsellors(list);
      setTags(tagList);
      if (prior) {
        const restored: MatchingQuizAnswers = {
          lookingFor: prior.lookingFor,
          preferredLanguages: prior.preferredLanguages,
          genderPreference: prior.genderPreference,
          preferredFormats: prior.preferredFormats,
          startUrgency: prior.startUrgency,
        };
        setAnswers(restored);
        setShortlistFor(restored);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  const loadSessions = async () => {
    // allSettled: supabase-js rejects on an aborted request, and with
    // Promise.all one failure blanked this whole view.
    const [sR, rR] = await Promise.allSettled([
      counsellorSelectionService.listSessions(participantId),
      counsellorSelectionService.listOwnReviews(participantId),
    ]);
    if (sR.status === "fulfilled") setSessions(sR.value);
    if (rR.status === "fulfilled") setOwnReviews(rR.value);
  };

  useEffect(() => {
    if (tab === "sessions") loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, participantId]);

  const allLanguages = useMemo(
    () => Array.from(new Set(counsellors.flatMap((c) => c.languages))).sort(),
    [counsellors]
  );
  const allSpecialties = useMemo(
    () => Array.from(new Set(counsellors.flatMap((c) => c.specialties))).sort(),
    [counsellors]
  );

  const filtered = useMemo(
    () =>
      counsellors.filter(
        (c) =>
          (!filterSpecialty || c.specialties.includes(filterSpecialty)) &&
          (!filterLanguage || c.languages.includes(filterLanguage)) &&
          (!filterFormat || c.sessionFormats.includes(filterFormat as SessionFormat)) &&
          (!availableOnly || c.acceptingNewClients)
      ),
    [counsellors, filterSpecialty, filterLanguage, filterFormat, availableOnly]
  );

  const shortlist = useMemo(
    () => (shortlistFor ? rankCounsellors(counsellors, shortlistFor) : []),
    [counsellors, shortlistFor]
  );
  const widened = shortlistFor ? shortlistWasWidened(counsellors, shortlistFor) : false;

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const handleSelect = async (workerId: string) => {
    const previous = activeWorkerId;
    setBusyId(workerId);
    setError(null);
    const message = await counsellorSelectionService.chooseCounsellor(workerId);
    setBusyId(null);
    if (message) {
      setError(message);
      const refreshed = await counsellorSelectionService.listCounsellors();
      setCounsellors(refreshed);
      return;
    }

    const chosen = counsellors.find((c) => c.workerId === workerId);
    setActiveWorkerId(workerId);
    // The write has happened; tell the rest of the app so it stops showing
    // the counsellor this person just left.
    onAssignmentChanged?.(workerId);
    setNotice(
      chosen
        ? `${chosen.displayName} is now your counsellor.`
        : "Your counsellor has been updated."
    );

    // Only worth asking when they actually moved away from somebody.
    if (previous && previous !== workerId) {
      setLeftWorkerId(previous);
      setLeftRating(0);
      setLeftBody("");
    }

    // Reload so availability and caseload reflect the change immediately.
    setCounsellors(await counsellorSelectionService.listCounsellors());
  };

  const submitLeftFeedback = async () => {
    if (!leftWorkerId) return;
    setLeftSaving(true);
    const message = await counsellorSelectionService.submitSwitchFeedback({
      participantId,
      previousWorkerId: leftWorkerId,
      newWorkerId: activeWorkerId,
      rating: leftRating || null,
      body: leftBody,
    });
    setLeftSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setLeftWorkerId(null);
    setError(null);
    setNotice("Thank you. That has been passed on, without your name.");
  };

  const applyQuiz = async () => {
    await counsellorSelectionService.saveQuiz(participantId, answers);
    setShortlistFor(answers);
    setQuizOpen(false);
  };

  const submitReview = async () => {
    if (!reviewFor || rating < 1) return;
    const message = await counsellorSelectionService.submitReview({
      sessionId: reviewFor.id,
      workerId: reviewFor.workerId,
      participantId,
      rating,
      body: reviewBody,
    });
    if (message) {
      setError(message);
      return;
    }
    setReviewFor(null);
    setRating(0);
    setReviewBody("");
    setNotice("Thank you. Your review will appear once it has been checked.");
    loadSessions();
  };

  const reviewedSessionIds = new Set(ownReviews.map((r) => r.sessionId));
  const reviewable = sessions.filter(
    (s) => s.status === "completed" && !reviewedSessionIds.has(s.id)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-[#5A5049] hover:text-[#3C3530] cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#3C3530]">Choose your counsellor</h1>
        <p className="text-sm text-[#7A726C] mt-2 max-w-2xl">
          You can pick someone yourself, or leave it to your support team — either is fine, and you
          can change your mind later without giving a reason.
        </p>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#2F6B4F]/30 bg-[#2F6B4F]/5 px-4 py-3 text-sm text-[#2F6B4F]">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-[#B0713C]/40 bg-[#B0713C]/5 px-4 py-3 text-sm text-[#8A5A2B]">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#EFE8E2]/60 p-1 rounded-2xl w-fit">
        {(["find", "sessions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
              tab === t ? "bg-white text-[#3C3530] shadow-xs" : "text-[#7A726C] hover:text-[#3C3530]"
            }`}
          >
            {t === "find" ? "Find a counsellor" : "Your sessions"}
          </button>
        ))}
      </div>

      {tab === "find" && (
        <>
          {/* The quiz is an offer, never a gate. */}
          <div className="rounded-3xl border border-[#DBC3B2]/50 bg-[#FFF6EC] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-[#DBC3B2]/40 text-[#8A5A2B] flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[#3C3530] text-sm">
                {shortlistFor ? "Your shortlist is ready" : "Answer a few questions to narrow this down"}
              </h2>
              <p className="text-xs text-[#7A726C] mt-1">
                Five quick preference questions — what you want help with, language, format. It is
                not an assessment, and nothing you pick here is shared with your counsellor or added
                to your health record.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setQuizOpen((v) => !v)}
                className="px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer"
              >
                {quizOpen ? "Close" : shortlistFor ? "Retake" : "Start"}
              </button>
              {shortlistFor && (
                <button
                  onClick={() => {
                    setShortlistFor(null);
                    setQuizOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
                >
                  Browse all instead
                </button>
              )}
            </div>
          </div>

          {quizOpen && (
            <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs text-[#7A726C] flex items-start gap-2">
                  <ShieldCheck size={14} className="text-[#2F6B4F] mt-0.5 shrink-0" />
                  Every question is optional. Skip the whole thing and browse everyone if you prefer.
                </p>
                <button
                  onClick={() => setQuizOpen(false)}
                  className="text-xs font-bold text-[#7A726C] hover:text-[#3C3530] cursor-pointer shrink-0"
                >
                  Skip quiz
                </button>
              </div>

              <div>
                <p className="text-sm font-bold text-[#3C3530] mb-2">What would you like help with?</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Chip
                      key={t.tag}
                      active={answers.lookingFor.includes(t.tag)}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, lookingFor: toggle(a.lookingFor, t.tag) }))
                      }
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {allLanguages.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-[#3C3530] mb-2">Preferred language</p>
                  <div className="flex flex-wrap gap-2">
                    {allLanguages.map((l) => (
                      <Chip
                        key={l}
                        active={answers.preferredLanguages.includes(l)}
                        onClick={() =>
                          setAnswers((a) => ({
                            ...a,
                            preferredLanguages: toggle(a.preferredLanguages, l),
                          }))
                        }
                      >
                        {l}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-[#3C3530] mb-2">
                  Would you prefer a particular counsellor?
                </p>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map((g) => (
                    <Chip
                      key={g.value}
                      active={answers.genderPreference === g.value}
                      onClick={() => setAnswers((a) => ({ ...a, genderPreference: g.value }))}
                    >
                      {g.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-[#3C3530] mb-2">How would you like to meet?</p>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <Chip
                      key={f}
                      active={answers.preferredFormats.includes(f)}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, preferredFormats: toggle(a.preferredFormats, f) }))
                      }
                    >
                      {f}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-[#3C3530] mb-2">How soon would you like to start?</p>
                <div className="flex flex-wrap gap-2">
                  {URGENCIES.map((u) => (
                    <Chip
                      key={u.value}
                      active={answers.startUrgency === u.value}
                      onClick={() => setAnswers((a) => ({ ...a, startUrgency: u.value }))}
                    >
                      {u.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFE8E2]">
                <button
                  onClick={applyQuiz}
                  className="px-5 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer"
                >
                  Show my matches
                </button>
                <button
                  onClick={() => setAnswers(EMPTY_ANSWERS)}
                  className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  Clear answers
                </button>
                <button
                  onClick={async () => {
                    await counsellorSelectionService.clearQuiz(participantId);
                    setAnswers(EMPTY_ANSWERS);
                    setShortlistFor(null);
                    setQuizOpen(false);
                    setNotice("Your saved answers have been deleted.");
                  }}
                  className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer ml-auto"
                >
                  Delete my saved answers
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-[#7A726C]">Loading counsellors…</p>
          ) : counsellors.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#EFE8E2] p-8 text-center">
              <p className="text-sm text-[#5A5049] font-semibold">
                No counsellors have published a profile yet.
              </p>
              <p className="text-xs text-[#7A726C] mt-2">
                Your support team will assign someone to you in the meantime — you do not need to do
                anything.
              </p>
            </div>
          ) : shortlistFor ? (
            <>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[#3C3530]">
                  {shortlist.length} suggested {shortlist.length === 1 ? "counsellor" : "counsellors"}
                </h2>
              </div>
              {widened && (
                <p className="text-xs text-[#7A726C] flex items-start gap-2 -mt-3">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Too few counsellors matched everything you asked for, so this list is wider than
                  your preferences. Nothing was hidden from you.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {shortlist.map((m) => (
                  <CounsellorCard
                    key={m.counsellor.workerId}
                    counsellor={m.counsellor}
                    reasons={m.reasons}
                    isCurrent={m.counsellor.workerId === activeWorkerId}
                    busy={busyId === m.counsellor.workerId}
                    onSelect={() => handleSelect(m.counsellor.workerId)}
                  />
                ))}
              </div>
              <button
                onClick={() => setShortlistFor(null)}
                className="text-xs font-bold text-[#5A5049] hover:text-[#3C3530] cursor-pointer underline"
              >
                Skip the shortlist and browse all counsellors instead
              </button>
            </>
          ) : (
            <>
              <div className="bg-white rounded-3xl border border-[#EFE8E2] p-4 flex flex-wrap gap-2 items-center">
                <select
                  value={filterSpecialty}
                  onChange={(e) => setFilterSpecialty(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#EFE8E2] text-xs font-semibold text-[#5A5049] bg-white cursor-pointer"
                >
                  <option value="">All specialties</option>
                  {allSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#EFE8E2] text-xs font-semibold text-[#5A5049] bg-white cursor-pointer"
                >
                  <option value="">All languages</option>
                  {allLanguages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#EFE8E2] text-xs font-semibold text-[#5A5049] bg-white cursor-pointer"
                >
                  <option value="">Any format</option>
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A5049] cursor-pointer px-2">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="accent-[#5A5049] cursor-pointer"
                  />
                  Accepting new clients
                </label>
                <span className="ml-auto text-xs text-[#7A726C]">
                  {filtered.length} of {counsellors.length}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((c) => (
                  <CounsellorCard
                    key={c.workerId}
                    counsellor={c}
                    isCurrent={c.workerId === activeWorkerId}
                    busy={busyId === c.workerId}
                    onSelect={() => handleSelect(c.workerId)}
                  />
                ))}
              </div>
              {filtered.length === 0 && (
                <p className="text-sm text-[#7A726C]">
                  No counsellor matches those filters. Try clearing one.
                </p>
              )}
            </>
          )}
        </>
      )}

      {tab === "sessions" && (
        <div className="space-y-4">
          <p className="text-sm text-[#7A726C] max-w-2xl">
            You can review a counsellor after a session you have actually had with them. Your name is
            never shown with a review — not to the counsellor, and not to anyone else using AURA.
          </p>

          {sessions.length === 0 && (
            <div className="bg-white rounded-3xl border border-[#EFE8E2] p-8 text-center">
              <p className="text-sm text-[#5A5049] font-semibold">No sessions recorded yet.</p>
              <p className="text-xs text-[#7A726C] mt-2">
                Once you have had a session, it will appear here and you can leave a review.
              </p>
            </div>
          )}

          {reviewable.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-[#3C3530] text-sm">Waiting for your review</h2>
              {reviewable.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-[#EFE8E2] p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#3C3530]">
                      Session on {s.heldAt ? new Date(s.heldAt).toLocaleDateString() : "an earlier date"}
                    </p>
                    <p className="text-xs text-[#7A726C]">{s.format || "session"}</p>
                  </div>
                  <button
                    onClick={() => {
                      setReviewFor(s);
                      setRating(0);
                      setReviewBody("");
                    }}
                    className="px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer shrink-0"
                  >
                    Leave a review
                  </button>
                </div>
              ))}
            </div>
          )}

          {ownReviews.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-[#3C3530] text-sm">Your reviews</h2>
              {ownReviews.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-[#EFE8E2] p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[#8A5A2B]">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} size={12} className="fill-current" />
                      ))}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        r.status === "published"
                          ? "text-[#2F6B4F] bg-[#2F6B4F]/10"
                          : r.status === "rejected"
                            ? "text-[#9A928C] bg-[#EFE8E2]"
                            : "text-[#8A5A2B] bg-[#DBC3B2]/30"
                      }`}
                    >
                      {r.status === "pending" ? "Being checked" : r.status}
                    </span>
                  </div>
                  {r.body && (
                    <p className="text-sm text-[#5A5049] mt-2" data-no-translate>
                      {r.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Offered once, right after a switch. Closing it is a complete answer. */}
      {leftWorkerId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="font-bold text-[#3C3530]">
              Would you like to say why you changed?
            </h2>
            {/* This has to match where the note actually goes. It used to say the
                counsellor was not told anything, which stopped being true when
                the note started reaching them. */}
            <p className="text-xs text-[#7A726C] leading-relaxed">
              This is optional. You have already changed counsellor and nothing here
              affects that.{" "}
              {counsellors.find((c) => c.workerId === leftWorkerId)?.displayName ||
                "The counsellor you left"}{" "}
              will read this, so they can learn from it — but not your name, and not
              the day you wrote it.
            </p>

            <div>
              <p className="text-xs font-bold text-[#3C3530] mb-1.5">
                How was your time with them? (optional)
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLeftRating(n === leftRating ? 0 : n)}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    className="p-1 cursor-pointer"
                  >
                    <Star
                      size={24}
                      className={n <= leftRating ? "text-[#8A5A2B] fill-current" : "text-[#DBC3B2]"}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="switch-reason"
                className="block text-xs font-bold text-[#3C3530] mb-1.5"
              >
                In your own words (optional)
              </label>
              <textarea
                id="switch-reason"
                value={leftBody}
                onChange={(e) => setLeftBody(e.target.value.slice(0, 600))}
                rows={4}
                placeholder="What made you want to change? Anything you say helps."
                data-no-translate
                className="w-full px-3 py-2 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
              />
              <p className="text-[11px] text-[#7A726C] mt-1.5">
                {600 - leftBody.length} characters left.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={submitLeftFeedback}
                disabled={leftSaving || (!leftRating && !leftBody.trim())}
                className="px-5 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {leftSaving ? "Sending…" : "Send this"}
              </button>
              <button
                onClick={() => setLeftWorkerId(null)}
                className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="font-bold text-[#3C3530]">How was this session?</h2>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  className="p-1 cursor-pointer"
                >
                  <Star
                    size={26}
                    className={n <= rating ? "text-[#8A5A2B] fill-current" : "text-[#DBC3B2]"}
                  />
                </button>
              ))}
            </div>

            <div>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value.slice(0, 600))}
                rows={4}
                placeholder="Anything you'd like to add (optional)"
                data-no-translate
                className="w-full px-3 py-2 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
              />
              <p className="text-[11px] text-[#7A726C] mt-1.5">
                Please don't include your name, phone number, or details of your case — reviews are
                public once checked. {600 - reviewBody.length} characters left.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={submitReview}
                disabled={rating < 1}
                className="px-5 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit review
              </button>
              <button
                onClick={() => setReviewFor(null)}
                className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
