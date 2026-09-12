import React, { useEffect, useState } from "react";
import { Heart, CheckCircle2, ShieldCheck } from "lucide-react";
import { GuardianQuestion } from "../services/guardianQuestions";

interface Props {
  token: string;
}

/**
 * The form a family member fills in, reached from a link with no account.
 *
 * It names nobody. Whoever holds the link learns only that they were asked five
 * questions about someone they care for — the counsellor tells them who, when
 * they hand the link over. A link that reaches the wrong person should not tell
 * that person who is receiving support.
 */
export const GuardianForm: React.FC<Props> = ({ token }) => {
  const [questions, setQuestions] = useState<GuardianQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/guardian/${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!res.ok) setBlocked(body?.detail || "This link is not valid.");
        else setQuestions(body.questions || []);
      } catch {
        setBlocked("We could not open this form. Please check your connection.");
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body?.detail || "We could not save your answers.");
      else setSent(true);
    } catch {
      setError("We could not save your answers. Please check your connection.");
    }
    setSending(false);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-[#FDF9F5] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#9A5B33] text-white flex items-center justify-center">
            <Heart size={17} />
          </div>
          <span className="font-bold text-[#3C3530] text-lg">Aura</span>
        </div>

        {loading ? (
          <p className="text-sm text-[#7A726C]">Opening the form…</p>
        ) : blocked ? (
          <div className="bg-white rounded-3xl border border-[#EFE8E2] p-8 text-center">
            <p className="text-sm font-semibold text-[#3C3530]">{blocked}</p>
            <p className="text-xs text-[#7A726C] mt-2">
              If you were expecting this form, ask the counsellor who sent it for a new link.
            </p>
          </div>
        ) : sent ? (
          <div className="bg-white rounded-3xl border border-[#EFE8E2] p-8 text-center space-y-2">
            <CheckCircle2 size={28} className="text-[#2F6B4F] mx-auto" />
            <p className="text-sm font-bold text-[#3C3530]">Thank you — your answers have been sent.</p>
            <p className="text-xs text-[#7A726C] max-w-sm mx-auto">
              Only the counsellor who asked you will read them. You can close this page; the link
              will not open again.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 space-y-2">
              <h1 className="text-xl font-bold text-[#3C3530]">
                A few questions about someone you care for
              </h1>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                A counsellor has asked for your view. There are five questions and there are no
                right answers — what you have actually noticed is what helps. It takes a couple of
                minutes.
              </p>
              <p className="text-xs text-[#7A726C] flex items-start gap-2 pt-1">
                <ShieldCheck size={13} className="text-[#2F6B4F] mt-0.5 shrink-0" />
                Only the counsellor who sent this link sees your answers. The person you are
                answering about is told that you were asked, but not what you said.
              </p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-3xl border border-[#EFE8E2] p-5">
                <p className="text-sm font-semibold text-[#3C3530] mb-3">
                  {i + 1}. {q.prompt}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.label }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                        answers[q.id] === opt.label
                          ? "border-[#5A5049] bg-[#DBC3B2]/25 text-[#3C3530] font-semibold"
                          : "border-[#EFE8E2] text-[#5A5049] hover:bg-[#FDF9F5]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {error && (
              <div className="rounded-2xl border border-[#A65D52]/30 bg-[#A65D52]/8 px-4 py-3 text-sm text-[#8A463C]">
                {error}
              </div>
            )}

            <div className="bg-white rounded-3xl border border-[#EFE8E2] p-5 flex flex-wrap items-center gap-3">
              <button
                onClick={submit}
                disabled={sending || answeredCount === 0}
                className="px-6 py-3 rounded-xl bg-[#5A5049] text-white text-sm font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : "Send my answers"}
              </button>
              <span className="text-xs text-[#7A726C]">
                {answeredCount} of {questions.length} answered. You can leave any of them blank.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
