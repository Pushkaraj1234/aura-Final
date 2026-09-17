import React, { useEffect, useState } from "react";
import { FileText, Check, X, Mail, Phone, Calendar, Copy, ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown, ChevronUp } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";
import { Card, PageHeader, Spinner, ErrorBanner, EmptyState, PrimaryButton, DangerButton, Badge } from "../ui";

interface CredentialAnalysis {
  status: "analyzed" | "unavailable";
  documentType?: string;
  appearsCredential?: boolean;
  field?: string;
  issuingBody?: string;
  holderName?: string;
  matchedIndicators?: string[];
  concerns?: string[];
  confidence?: string;
  recommendation?: "likely_valid" | "manual_review" | "likely_invalid";
  rationale?: string;
  keywordHits?: string[];
  reason?: string;
  analyzedAt?: string;
}

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  credential_filename: string | null;
  credentialUrl: string | null;
  credential_analysis: CredentialAnalysis | null;
  submitted_at: string;
}

const CredentialAnalysisPanel: React.FC<{ analysis: CredentialAnalysis | null }> = ({ analysis }) => {
  const [open, setOpen] = useState(false);

  if (!analysis) {
    return (
      <p className="text-[11px] text-[#68625D] mt-2 flex items-center gap-1.5">
        Document screening not run for this application.
      </p>
    );
  }

  if (analysis.status === "unavailable") {
    return (
      <p className="text-[11px] text-[#68625D] mt-2 flex items-center gap-1.5">
        <ShieldQuestion size={12} /> AI document screening unavailable{analysis.reason ? ` — ${analysis.reason}` : ""}. Review the document manually.
      </p>
    );
  }

  const rec = analysis.recommendation || "manual_review";
  const meta =
    rec === "likely_valid"
      ? { tone: "good" as const, Icon: ShieldCheck, label: "Screening: likely valid" }
      : rec === "likely_invalid"
      ? { tone: "bad" as const, Icon: ShieldAlert, label: "Screening: likely invalid" }
      : { tone: "warn" as const, Icon: ShieldQuestion, label: "Screening: needs manual review" };

  return (
    <div className="mt-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <meta.Icon size={14} className="text-[#5A5049]" />
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-[10px] text-[#68625D] uppercase tracking-wider">
            {analysis.documentType || "document"} · {analysis.confidence || "low"} confidence
          </span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-bold text-[#5A5049] hover:underline flex items-center gap-1 cursor-pointer"
        >
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {open ? "Hide" : "Details"}
        </button>
      </div>

      {analysis.rationale && <p className="text-[11px] text-[#5A5049] mt-2">{analysis.rationale}</p>}

      {open && (
        <div className="mt-2 space-y-2 text-[11px] text-[#5A5049]">
          <div className="grid sm:grid-cols-3 gap-2">
            <div><span className="text-[#68625D]">Field:</span> {analysis.field || "—"}</div>
            <div><span className="text-[#68625D]">Issuer:</span> {analysis.issuingBody || "—"}</div>
            <div><span className="text-[#68625D]">Name on doc:</span> {analysis.holderName || "—"}</div>
          </div>
          {(analysis.matchedIndicators?.length || 0) > 0 && (
            <div>
              <span className="text-[#68625D]">Supporting features:</span>
              <ul className="list-disc list-inside mt-0.5">
                {analysis.matchedIndicators!.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {(analysis.concerns?.length || 0) > 0 && (
            <div>
              <span className="text-[#A55D25] font-bold">Concerns:</span>
              <ul className="list-disc list-inside mt-0.5 text-[#A55D25]">
                {analysis.concerns!.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {(analysis.keywordHits?.length || 0) > 0 && (
            <div>
              <span className="text-[#68625D]">Keyword matches:</span> {analysis.keywordHits!.join(", ")}
            </div>
          )}
          <p className="text-[10px] text-[#B9B0A6]">
            Advisory only — not authoritative verification. Always open and read the document before deciding.
          </p>
        </div>
      )}
    </div>
  );
};

export const PendingQueueTab: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [result, setResult] = useState<{ name: string; email: string; password: string; emailSent: boolean } | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    adminApiService
      .getPendingWorkers()
      .then(setApplications)
      .catch((err) => setError(err.message || "Failed to load the verification queue."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApprove = async (app: Application) => {
    setBusyId(app.id);
    setError("");
    try {
      const res = await adminApiService.approveWorker(app.id);
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      if (!res.emailSent) {
        setResult({ name: app.name, email: app.email, password: res.temporaryPassword, emailSent: false });
      } else {
        setResult({ name: app.name, email: app.email, password: res.temporaryPassword, emailSent: true });
      }
    } catch (err: any) {
      setError(err.message || "Failed to approve application.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (app: Application) => {
    setBusyId(app.id);
    setError("");
    try {
      await adminApiService.rejectWorker(app.id, rejectReason.trim() || undefined);
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      setRejectingId(null);
      setRejectReason("");
    } catch (err: any) {
      setError(err.message || "Failed to reject application.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Counselor Verification Queue"
        subtitle="Review submitted credentials before activating a counselor's account."
      />
      {error && <ErrorBanner message={error} />}

      {result && (
        <Card className="p-5 mb-5 border-[#CFE6D6] bg-[#EAF3EC]">
          <p className="text-sm font-black text-[#2F6B4F] mb-1">
            {result.name} has been approved{result.emailSent ? " and emailed their credentials." : "."}
          </p>
          {!result.emailSent && (
            <div className="text-xs text-[#2F6B4F] space-y-1 mt-2">
              <p className="font-bold">
                Email delivery failed — relay these credentials to the applicant manually:
              </p>
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#CFE6D6] font-mono">
                <span>{result.email}</span>
                <span className="text-[#68625D]">/</span>
                <span>{result.password}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(`${result.email} / ${result.password}`)}
                  className="ml-auto text-[#2F6B4F] hover:opacity-70 cursor-pointer"
                  title="Copy"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="text-xs font-bold text-[#2F6B4F] hover:underline mt-2 cursor-pointer"
          >
            Dismiss
          </button>
        </Card>
      )}

      {loading ? (
        <Spinner label="Loading pending applications..." />
      ) : applications.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="No pending counselor applications right now." />
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <p className="text-base font-black text-[#3C3530]">{app.name}</p>
                  <div className="flex items-center gap-4 flex-wrap text-xs text-[#68625D] font-medium">
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {app.email}
                    </span>
                    {app.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {app.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {new Date(app.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  {app.credentialUrl ? (
                    <a
                      href={app.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3C3530] hover:underline mt-1"
                    >
                      <FileText size={13} /> View credential document{app.credential_filename ? ` (${app.credential_filename})` : ""}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#68625D] mt-1">
                      <FileText size={13} /> Credential document unavailable
                    </span>
                  )}
                  <CredentialAnalysisPanel analysis={app.credential_analysis} />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <PrimaryButton onClick={() => handleApprove(app)} disabled={busyId === app.id}>
                    <span className="flex items-center gap-1.5">
                      <Check size={13} /> Approve
                    </span>
                  </PrimaryButton>
                  <DangerButton
                    onClick={() => setRejectingId(rejectingId === app.id ? null : app.id)}
                    disabled={busyId === app.id}
                  >
                    <span className="flex items-center gap-1.5">
                      <X size={13} /> Reject
                    </span>
                  </DangerButton>
                </div>
              </div>

              {rejectingId === app.id && (
                <div className="mt-4 pt-4 border-t border-[#EFE8E2] flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Optional reason (sent to applicant)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-[#EFE8E2] bg-[#FDF9F5] text-sm text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
                  />
                  <DangerButton onClick={() => handleReject(app)} disabled={busyId === app.id}>
                    Confirm Rejection
                  </DangerButton>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
