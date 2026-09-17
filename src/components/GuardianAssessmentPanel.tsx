import React, { useEffect, useState } from "react";
import { Users, Link2, Copy, Check, Ban, AlertTriangle } from "lucide-react";
import { guardianService, GuardianAssessment } from "../services/guardianService";
import { GUARDIAN_QUESTIONS } from "../services/guardianQuestions";

interface Props {
  participantId: string;
  workerId: string;
}

const CONCERN_STYLE: Record<string, string> = {
  low: "text-[#2F6B4F] bg-[#2F6B4F]/10",
  moderate: "text-[#8A5A2B] bg-[#DBC3B2]/40",
  high: "text-[#8A3F35] bg-[#A65D52]/12",
};

/**
 * The guardian questionnaire, from the counsellor's side.
 *
 * A separate section from the per-participant tests on purpose: this is a
 * different instrument, answered by a different person, and reading it as
 * though the participant wrote it would be a serious misreading.
 */
export const GuardianAssessmentPanel: React.FC<Props> = ({ participantId, workerId }) => {
  const [rows, setRows] = useState<GuardianAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GuardianAssessment | null>(null);

  const load = async () => {
    setRows(await guardianService.listForParticipant(participantId));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const create = async () => {
    if (!label.trim()) return setError("Say who this is going to, e.g. Mother.");
    setCreating(true);
    setError(null);
    const { link, error: err } = await guardianService.createLink({
      participantId,
      workerId,
      guardianLabel: label,
    });
    setCreating(false);
    if (err) return setError(err);
    setFreshLink(link);
    setLabel("");
    load();
  };

  const copy = async () => {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Could not copy automatically. Select the link and copy it.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-[#8A4A20]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
          Family / guardian assessment
        </h3>
      </div>

      <p className="text-xs text-[#6B635C] leading-relaxed">
        Five fixed questions for someone close to this person. They answer through a one-time link
        and need no account. This participant is told who you asked and when, but never sees the
        answers.
      </p>

      {error && (
        <div className="rounded-xl border border-[#A65D52]/30 bg-[#A65D52]/8 px-3 py-2 text-xs text-[#8A463C]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[12rem]">
          <label className="text-xs font-bold text-[#5A5049] block mb-1.5">
            Who is answering?
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 120))}
            placeholder="Mother, elder brother, guardian…"
            data-no-translate
            className="w-full p-3 rounded-xl border border-[#EFE8E2] text-sm text-[#3C3530]"
          />
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="px-4 py-3 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Link2 size={13} />
          {creating ? "Creating…" : "Create link"}
        </button>
      </div>

      {freshLink && (
        <div className="rounded-2xl border border-[#DBC3B2]/60 bg-[#FFF6EC] p-4 space-y-2">
          <p className="text-xs font-bold text-[#3C3530]">Send this link to them now</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={freshLink}
              onFocus={(e) => e.currentTarget.select()}
              data-no-translate
              className="flex-1 p-2.5 rounded-xl border border-[#DBC3B2]/60 bg-white text-[11px] font-mono text-[#3C3530]"
            />
            <button
              onClick={copy}
              className="px-3 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-[#8A5A2B] flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Shown once and not recoverable. Only a hash of it is stored. It works for one
            submission, expires in 14 days, and does not name this participant, so tell them who it
            is about yourself.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#6B635C]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#6B635C]">Nothing sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((g) => (
            <li key={g.id} className="rounded-2xl border border-[#EFE8E2] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#3C3530]" data-no-translate>
                    {g.guardianLabel}
                  </p>
                  <p className="text-[11px] text-[#6B635C]">
                    {g.status === "sent" && `link sent ${new Date(g.createdAt).toLocaleDateString()} · not answered yet`}
                    {g.status === "revoked" && "withdrawn"}
                    {g.status === "submitted" && `answered ${g.submittedAt ? new Date(g.submittedAt).toLocaleDateString() : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.concernLevel && (
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${CONCERN_STYLE[g.concernLevel]}`}>
                      {g.concernLevel} concern
                    </span>
                  )}
                  {g.status === "submitted" && (
                    <button
                      onClick={() => setOpen(g)}
                      className="px-3 py-1.5 rounded-lg bg-[#5A5049] text-white text-[11px] font-bold hover:bg-[#3C3530] cursor-pointer"
                    >
                      Read
                    </button>
                  )}
                  {g.status === "sent" && (
                    <button
                      onClick={async () => { await guardianService.revoke(g.id); load(); }}
                      aria-label="Withdraw link"
                      className="p-1.5 text-[#8A3F35] hover:bg-[#A65D52]/10 rounded-lg cursor-pointer"
                    >
                      <Ban size={13} />
                    </button>
                  )}
                </div>
              </div>

              {g.aiSummary && g.status === "submitted" && (
                <p className="text-xs text-[#5A5049] mt-2 leading-relaxed border-t border-[#EFE8E2] pt-2" data-no-translate>
                  {g.aiSummary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 my-8">
            <div>
              <h3 className="font-bold text-[#3C3530]">
                Answered by <span data-no-translate>{open.guardianLabel}</span>
              </h3>
              {open.concernLevel && (
                <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${CONCERN_STYLE[open.concernLevel]}`}>
                  {open.concernLevel} concern
                </span>
              )}
            </div>

            {open.aiSummary && (
              <div className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#68625D] mb-1">
                  Summary
                </p>
                <p className="text-sm text-[#3C3530] leading-relaxed" data-no-translate>
                  {open.aiSummary}
                </p>
              </div>
            )}

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {GUARDIAN_QUESTIONS.map((q, i) => {
                const a = open.answers?.find((x) => x.questionId === q.id);
                return (
                  <div key={q.id} className="rounded-2xl border border-[#EFE8E2] p-3">
                    <p className="text-xs text-[#6B635C]">{i + 1}. {q.prompt}</p>
                    <p className="text-sm font-semibold text-[#3C3530] mt-1" data-no-translate>
                      {a?.value || <span className="text-[#9A928C] italic font-normal">Not answered</span>}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-[#6B635C]">
              This is one person's account of another. It sits beside the participant's own
              check-ins rather than replacing them, and it does not change their distress score.
            </p>

            <button
              onClick={() => setOpen(null)}
              className="px-4 py-2.5 rounded-xl bg-[#5A5049] text-white text-xs font-bold hover:bg-[#3C3530] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
