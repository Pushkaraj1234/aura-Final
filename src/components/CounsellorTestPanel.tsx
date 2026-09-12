import React, { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, Send, Save, CheckCircle2, X } from "lucide-react";
import {
  CounsellorTest,
  CounsellorTestResponse,
  TestQuestion,
  TestQuestionType,
} from "../types";
import { counsellorTestService } from "../services/counsellorTestService";

interface Props {
  participantId: string;
  workerId: string;
  /** Raised after a review is saved, so the chart can pick up the new mark. */
  onReviewed?: () => void;
}

const blankQuestion = (): TestQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  prompt: "",
  type: "choice",
  options: ["", ""],
});

const TYPE_LABEL: Record<TestQuestionType, string> = {
  choice: "Multiple choice",
  scale: "Scale of 1–5",
  text: "Written answer",
};

/**
 * The counsellor's side of a test: writing it, reading what came back, and
 * marking it.
 *
 * Assigning is deliberately a separate action from saving. A test is visible to
 * the participant the moment it leaves draft, so "save" and "send this to
 * someone" should not be the same button.
 */
export const CounsellorTestPanel: React.FC<Props> = ({ participantId, workerId, onReviewed }) => {
  const [tests, setTests] = useState<CounsellorTest[]>([]);
  const [responses, setResponses] = useState<Map<string, CounsellorTestResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CounsellorTest | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<TestQuestion[]>([blankQuestion()]);
  const [saving, setSaving] = useState(false);

  const [reviewing, setReviewing] = useState<CounsellorTest | null>(null);
  const [mark, setMark] = useState(50);
  const [reviewText, setReviewText] = useState("");

  const load = async () => {
    const [t, r] = await Promise.all([
      counsellorTestService.listForParticipant(participantId),
      counsellorTestService.responsesForParticipant(participantId),
    ]);
    setTests(t);
    setResponses(r);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const startNew = () => {
    setEditing({ id: "" } as CounsellorTest);
    setTitle("");
    setInstructions("");
    setQuestions([blankQuestion()]);
  };

  const startEdit = (t: CounsellorTest) => {
    setEditing(t);
    setTitle(t.title);
    setInstructions(t.instructions || "");
    setQuestions(t.questions.length ? t.questions : [blankQuestion()]);
  };

  const updateQuestion = (id: string, patch: Partial<TestQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const save = async (status: "draft" | "assigned") => {
    const cleaned = questions
      .map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        options: q.type === "choice" ? (q.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
      }))
      .filter((q) => q.prompt);

    if (!title.trim()) return setError("Give the test a title.");
    if (!cleaned.length) return setError("Add at least one question.");
    const badChoice = cleaned.find((q) => q.type === "choice" && (q.options?.length ?? 0) < 2);
    if (badChoice) return setError(`"${badChoice.prompt}" needs at least two options.`);

    setSaving(true);
    setError(null);
    const { error: err } = await counsellorTestService.saveTest({
      id: editing?.id || undefined,
      participantId,
      workerId,
      title,
      instructions,
      questions: cleaned,
      status,
    });
    setSaving(false);
    if (err) return setError(err);
    setEditing(null);
    load();
  };

  const openReview = (t: CounsellorTest) => {
    const r = responses.get(t.id);
    setReviewing(t);
    setMark(r?.mark ?? 50);
    setReviewText(r?.reviewText ?? "");
  };

  const saveReview = async () => {
    if (!reviewing) return;
    const r = responses.get(reviewing.id);
    if (!r) return;
    if (!reviewText.trim()) return setError("Write something for them to read alongside the mark.");
    setSaving(true);
    const err = await counsellorTestService.reviewResponse({
      responseId: r.id,
      testId: reviewing.id,
      workerId,
      mark,
      reviewText,
    });
    setSaving(false);
    if (err) return setError(err);
    setReviewing(null);
    await load();
    onReviewed?.();
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-[#9A5B33]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D]">
            Tests for this person
          </h3>
        </div>
        {!editing && (
          <button
            onClick={startNew}
            className="px-3 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus size={13} />
            New test
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#A65D52]/30 bg-[#A65D52]/8 px-3 py-2 text-xs text-[#8A463C]">
          {error}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Building or editing                                               */}
      {/* ---------------------------------------------------------------- */}
      {editing && (
        <div className="space-y-4 border border-[#EFE8E2] rounded-2xl p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 160))}
            placeholder="Title — e.g. Weekly review"
            data-no-translate
            className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm font-semibold text-[#3C3530]"
          />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Anything they should know before starting (optional)"
            data-no-translate
            className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
          />

          {questions.map((q, qi) => (
            <div key={q.id} className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-[#7F8C8D] pt-3">{qi + 1}.</span>
                <input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                  placeholder="Question"
                  data-no-translate
                  className="flex-1 p-2.5 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
                />
                <select
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as TestQuestionType;
                    updateQuestion(q.id, {
                      type,
                      options: type === "choice" ? q.options?.length ? q.options : ["", ""] : undefined,
                    });
                  }}
                  className="p-2.5 rounded-xl border border-[#EFE8E2] text-xs font-semibold text-[#5A5049] bg-white cursor-pointer"
                >
                  {(Object.keys(TYPE_LABEL) as TestQuestionType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>
                {questions.length > 1 && (
                  <button
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                    aria-label="Remove question"
                    className="p-2.5 text-[#A65D52] hover:bg-[#A65D52]/10 rounded-xl cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {q.type === "choice" && (
                <div className="pl-6 space-y-2">
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...(q.options || [])];
                          next[oi] = e.target.value;
                          updateQuestion(q.id, { options: next });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        data-no-translate
                        className="flex-1 p-2 rounded-lg border border-[#EFE8E2] text-xs text-[#3C3530]"
                      />
                      {(q.options?.length ?? 0) > 2 && (
                        <button
                          onClick={() => updateQuestion(q.id, {
                            options: (q.options || []).filter((_, i) => i !== oi),
                          })}
                          aria-label="Remove option"
                          className="p-1.5 text-[#A65D52] hover:bg-[#A65D52]/10 rounded-lg cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ""] })}
                    className="text-[11px] font-bold text-[#9A5B33] hover:underline cursor-pointer"
                  >
                    + add option
                  </button>
                </div>
              )}

              {q.type === "scale" && (
                <p className="pl-6 text-[11px] text-[#7A726C]">
                  They answer on a scale of 1 to 5.
                </p>
              )}
              {q.type === "text" && (
                <p className="pl-6 text-[11px] text-[#7A726C]">
                  They answer in their own words.
                </p>
              )}
            </div>
          ))}

          <button
            onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
            className="text-xs font-bold text-[#9A5B33] hover:underline cursor-pointer"
          >
            + add question
          </button>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFE8E2]">
            <button
              onClick={() => save("assigned")}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send size={13} />
              Send to participant
            </button>
            <button
              onClick={() => save("draft")}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#5A5049] text-xs font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Save size={13} />
              Save as draft
            </button>
            <button
              onClick={() => { setEditing(null); setError(null); }}
              className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer ml-auto"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-[#7A726C]">
            A draft stays private to you. Sending makes it visible to this person straight away.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* The list                                                          */}
      {/* ---------------------------------------------------------------- */}
      {loading ? (
        <p className="text-xs text-[#7A726C]">Loading…</p>
      ) : tests.length === 0 && !editing ? (
        <p className="text-xs text-[#7A726C]">
          No tests set yet. A test is only visible to this person once you send it.
        </p>
      ) : (
        <ul className="space-y-2">
          {tests.map((t) => {
            const r = responses.get(t.id);
            return (
              <li key={t.id} className="rounded-2xl border border-[#EFE8E2] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#3C3530] truncate" data-no-translate>{t.title}</p>
                    <p className="text-[11px] text-[#7A726C]">
                      {t.questions.length} question{t.questions.length === 1 ? "" : "s"} ·{" "}
                      {t.status === "draft" && "draft — not sent"}
                      {t.status === "assigned" && "sent, waiting for answers"}
                      {t.status === "submitted" && "answered — needs your review"}
                      {t.status === "reviewed" && `reviewed${r?.mark != null ? ` · ${r.mark}/100` : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(t.status === "draft" || t.status === "assigned") && (
                      <button
                        onClick={() => startEdit(t)}
                        className="px-3 py-1.5 rounded-lg text-[#5A5049] hover:bg-[#EFE8E2] text-[11px] font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    {r?.submittedAt && (
                      <button
                        onClick={() => openReview(t)}
                        className="px-3 py-1.5 rounded-lg bg-[#5A5049] text-white text-[11px] font-bold hover:bg-[#3C3530] cursor-pointer"
                      >
                        {t.status === "reviewed" ? "View review" : "Review answers"}
                      </button>
                    )}
                    {t.status === "draft" && (
                      <button
                        onClick={async () => { await counsellorTestService.deleteTest(t.id); load(); }}
                        aria-label="Delete draft"
                        className="p-1.5 text-[#A65D52] hover:bg-[#A65D52]/10 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Reviewing what came back                                          */}
      {/* ---------------------------------------------------------------- */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 my-8">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-[#3C3530]" data-no-translate>{reviewing.title}</h3>
              <button
                onClick={() => setReviewing(null)}
                aria-label="Close"
                className="p-1 text-[#7A726C] hover:text-[#3C3530] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {reviewing.questions.map((q, i) => {
                const a = responses.get(reviewing.id)?.answers.find((x) => x.questionId === q.id);
                return (
                  <div key={q.id} className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] p-3">
                    <p className="text-xs font-bold text-[#5A5049]" data-no-translate>
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="text-sm text-[#3C3530] mt-1.5" data-no-translate>
                      {a?.value === undefined || a.value === ""
                        ? <span className="text-[#9A928C] italic">Not answered</span>
                        : q.type === "scale" ? `${a.value} / 5` : String(a.value)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-3 border-t border-[#EFE8E2]">
              <div>
                <label className="text-xs font-bold text-[#5A5049] block mb-1.5">
                  Your mark: <span className="font-mono">{mark}</span> / 100
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mark}
                  onChange={(e) => setMark(Number(e.target.value))}
                  className="w-full accent-[#5A5049] cursor-pointer"
                />
                <p className="text-[11px] text-[#7A726C] mt-1.5">
                  Plotted on this person's trajectory beside their self-reported score, so the two
                  readings can be compared. It is not added to that score, and they are not shown
                  the number.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#5A5049] block mb-1.5">
                  Advice for them{" "}
                  <span className="font-normal text-[#9A928C]">({2000 - reviewText.length} left)</span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value.slice(0, 2000))}
                  rows={5}
                  placeholder="What you want them to take away from this."
                  data-no-translate
                  className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
                />
                <p className="text-[11px] text-[#7A726C] mt-1.5">
                  This is the only part they see, so it has to stand on its own.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={saveReview}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  {saving ? "Saving…" : "Save review"}
                </button>
                <button
                  onClick={() => setReviewing(null)}
                  className="px-3 py-2 rounded-xl text-[#7A726C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
