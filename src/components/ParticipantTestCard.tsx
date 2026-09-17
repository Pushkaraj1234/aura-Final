import React, { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, MessageSquareQuote } from "lucide-react";
import { CounsellorTest, CounsellorTestResponse, MyTestReview, TestAnswer } from "../types";
import { counsellorTestService } from "../services/counsellorTestService";
import { guardianService, GuardianNotice } from "../services/guardianService";

interface Props {
  participantId: string;
}

/**
 * Tests a counsellor has set for this person, and the advice that came back.
 *
 * The counsellor's mark is deliberately not here. They see what was written to
 * them, which is the part meant for them to read — a bare number about your own
 * mental state, with none of the conversation around it, reads as a verdict.
 */
export const ParticipantTestCard: React.FC<Props> = ({ participantId }) => {
  const [tests, setTests] = useState<CounsellorTest[]>([]);
  const [responses, setResponses] = useState<Map<string, CounsellorTestResponse>>(new Map());
  const [reviews, setReviews] = useState<MyTestReview[]>([]);
  const [guardianNotices, setGuardianNotices] = useState<GuardianNotice[]>([]);
  const [loading, setLoading] = useState(true);

  const [taking, setTaking] = useState<CounsellorTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    // allSettled, not all. supabase-js rejects rather than returning an error
    // when a request is aborted — offline, a blocked host, a dropped
    // connection — and with Promise.all a single rejection took the whole card
    // down with it, hiding a test the counsellor had assigned. Each source now
    // fails on its own and the rest still render.
    const [t, r, rv, gn] = await Promise.allSettled([
      counsellorTestService.myTests(participantId),
      counsellorTestService.myResponses(participantId),
      counsellorTestService.myReviews(participantId),
      guardianService.noticesForParticipant(participantId),
    ]);
    if (t.status === "fulfilled") setTests(t.value);
    if (r.status === "fulfilled") setResponses(r.value);
    if (rv.status === "fulfilled") setReviews(rv.value);
    if (gn.status === "fulfilled") setGuardianNotices(gn.value);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const waiting = tests.filter((t) => !responses.has(t.id));

  const submit = async () => {
    if (!taking) return;
    const payload: TestAnswer[] = taking.questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id] ?? "",
    }));
    setSaving(true);
    setError(null);
    const err = await counsellorTestService.submitAnswers({
      testId: taking.id,
      participantId,
      answers: payload,
    });
    setSaving(false);
    if (err) return setError(err);
    setTaking(null);
    setAnswers({});
    setDone("Sent to your counsellor. They'll reply here once they've read it.");
    load();
  };

  if (loading) return null;
  if (!waiting.length && !reviews.length && !guardianNotices.length && !done) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={15} className="text-[#8A4A20]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
          From your counsellor
        </h3>
      </div>

      {done && (
        <div className="rounded-xl border border-[#2F6B4F]/30 bg-[#2F6B4F]/5 px-3 py-2 text-xs text-[#2F6B4F]">
          {done}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#A65D52]/30 bg-[#A65D52]/8 px-3 py-2 text-xs text-[#8A463C]">
          {error}
        </div>
      )}

      {waiting.map((t) => (
        <div key={t.id} className="rounded-2xl border border-[#DBC3B2]/60 bg-[#FFF6EC] p-4">
          <p className="text-sm font-bold text-[#3C3530]" data-no-translate>{t.title}</p>
          {t.instructions && (
            <p className="text-xs text-[#6B635C] mt-1 leading-relaxed" data-no-translate>
              {t.instructions}
            </p>
          )}
          <p className="text-[11px] text-[#6B635C] mt-1.5">
            {t.questions.length} question{t.questions.length === 1 ? "" : "s"}. You can take as long
            as you need, and you do not have to answer everything.
          </p>
          <button
            onClick={() => { setTaking(t); setAnswers({}); setDone(null); }}
            className="mt-3 px-4 py-2 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer"
          >
            Start
          </button>
        </div>
      ))}

      {reviews.map((rv) => (
        <div key={rv.testId} className="rounded-2xl border border-[#EFE8E2] p-4">
          <div className="flex items-center gap-2">
            <MessageSquareQuote size={14} className="text-[#8A4A20]" />
            <p className="text-sm font-bold text-[#3C3530]" data-no-translate>{rv.title}</p>
          </div>
          {rv.reviewText && (
            <p className="text-sm text-[#5A5049] mt-2 leading-relaxed whitespace-pre-wrap" data-no-translate>
              {rv.reviewText}
            </p>
          )}
          <p className="text-[11px] text-[#9A928C] mt-2">
            From your counsellor
            {rv.reviewedAt && ` · ${new Date(rv.reviewedAt).toLocaleDateString()}`}
          </p>
        </div>
      ))}

      {guardianNotices.length > 0 && (
        <div className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4">
          <p className="text-xs font-bold text-[#3C3530]">
            People your counsellor has asked about you
          </p>
          <ul className="mt-2 space-y-1.5">
            {guardianNotices.map((g) => (
              <li key={g.id} className="text-xs text-[#5A5049]">
                <span className="font-semibold" data-no-translate>{g.guardianLabel}</span>
                {", asked "}
                {new Date(g.createdAt).toLocaleDateString()}
                {g.status === "submitted" && g.submittedAt
                  ? `, replied ${new Date(g.submittedAt).toLocaleDateString()}`
                  : g.status === "revoked"
                    ? ", withdrawn"
                    : ", not replied yet"}
              </li>
            ))}
          </ul>
          {/* They are told this happened and who was asked, so they can object
              to the wrong person being asked. What was said goes to the
              counsellor only. An answer the person it is about will read is
              not the honest answer. */}
          <p className="text-[11px] text-[#6B635C] mt-2 leading-relaxed">
            What they said goes only to your counsellor. If you would rather someone was not asked,
            tell your counsellor and they will withdraw it.
          </p>
        </div>
      )}

      {taking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 my-8">
            <h3 className="font-bold text-[#3C3530]" data-no-translate>{taking.title}</h3>
            {taking.instructions && (
              <p className="text-xs text-[#6B635C] leading-relaxed" data-no-translate>
                {taking.instructions}
              </p>
            )}

            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {taking.questions.map((q, i) => (
                <div key={q.id}>
                  <p className="text-sm font-semibold text-[#3C3530] mb-2" data-no-translate>
                    {i + 1}. {q.prompt}
                  </p>

                  {q.type === "choice" && (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                            answers[q.id] === opt
                              ? "border-[#5A5049] bg-[#DBC3B2]/25 text-[#3C3530] font-semibold"
                              : "border-[#EFE8E2] text-[#5A5049] hover:bg-[#FDF9F5]"
                          }`}
                          data-no-translate
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === "scale" && (
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                          className={`w-11 h-11 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                            answers[q.id] === n
                              ? "border-[#5A5049] bg-[#5A5049] text-white"
                              : "border-[#EFE8E2] text-[#5A5049] hover:bg-[#FDF9F5]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === "text" && (
                    <textarea
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      rows={3}
                      data-no-translate
                      className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530] resize-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-[#EFE8E2]">
              <button
                onClick={submit}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                {saving ? "Sending…" : "Send to my counsellor"}
              </button>
              <button
                onClick={() => setTaking(null)}
                className="px-3 py-2 rounded-xl text-[#6B635C] hover:text-[#3C3530] text-xs font-bold cursor-pointer"
              >
                Not now
              </button>
            </div>
            <p className="text-[11px] text-[#6B635C]">
              Only the counsellor who set this can read your answers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
