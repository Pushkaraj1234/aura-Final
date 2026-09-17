import React, { useState } from "react";
import { Users, ArrowLeft, UploadCloud, CheckCircle2, FileText } from "lucide-react";
import { adminApiService } from "../../services/adminApiService";

interface Props {
  onBack: () => void;
}

/**
 * Counselor application intake. There was no self-registration flow
 * for counselors before the admin panel — SupportLogin.tsx is
 * login-only — so this is a new page. It does not create a login account:
 * it submits an application (name, contact info, credential document) that
 * lands in the admin's Pending Verification Queue. The account itself is
 * only created once an admin approves the application (see
 * server/adminRouter.ts POST /workers/:id/approve), which is what avoids
 * ever having a half-confirmed Supabase Auth account sitting around.
 */
export const SupportWorkerSignUp: React.FC<Props> = ({ onBack }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please provide your full name and email address.");
      return;
    }
    if (!file) {
      setError("Please attach a degree or credential document (PDF, PNG, JPEG, or WEBP).");
      return;
    }
    setSubmitting(true);
    try {
      await adminApiService.submitApplication({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, credentialFile: file });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full">
          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-4 text-center">
            <div className="w-14 h-14 bg-[#3C3530] text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-2xl font-black text-[#3C3530]">Application Submitted</h2>
            <p className="text-sm text-[#68625D]">
              Thank you, {name.split(" ")[0]}. Your application and credential document are under review. You'll
              receive an email with your login credentials once an administrator approves your account.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-4 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              Back to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-[#68625D] hover:text-[#3C3530] transition-colors flex items-center space-x-1.5 mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Counselor Portal</span>
        </button>

        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 bg-[#3C3530] text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Users size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">Apply as a Counselor</h2>
            <p className="text-xs sm:text-sm text-[#68625D]">
              Submit your credentials for review. An administrator will verify your degree/credential document
              before activating your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider mb-1.5">
                Phone Number <span className="normal-case font-medium text-[#B9B0A6]">(optional)</span>
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider mb-1.5">
                Degree / Credential Document
              </label>
              <label
                htmlFor="credentialFile"
                className="w-full flex items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-[#EFE8E2] bg-[#FDF9F5] text-[#68625D] hover:border-[#5A5049] transition-colors cursor-pointer text-sm"
              >
                {file ? (
                  <span className="flex items-center gap-2 text-[#3C3530] font-semibold">
                    <FileText size={16} /> {file.name}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UploadCloud size={16} /> PDF, PNG, JPEG, or WEBP (max 10MB)
                  </span>
                )}
              </label>
              <input
                id="credentialFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>

            {error && <p className="text-xs text-[#A55D25] font-medium">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{submitting ? "Submitting..." : "Submit Application"}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#EFE8E2] text-center">
            <p className="text-[11px] text-[#68625D]">
              Your credential document is stored securely and is only visible to platform administrators.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
