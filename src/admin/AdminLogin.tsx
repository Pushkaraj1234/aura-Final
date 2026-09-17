import React, { useState } from "react";
import { ShieldCheck, KeyRound, ArrowRight, ArrowLeft, ServerCog } from "lucide-react";
import { adminApiService, AdminConfigStatus } from "../services/adminApiService";

interface Props {
  onSuccess: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Populated only after a failure. A hosted admin panel gives whoever is
  // locked out no access to server logs, so the login screen itself has to
  // say whether the server is even configured to accept a passcode.
  const [diagnostics, setDiagnostics] = useState<AdminConfigStatus | null | "unreachable">(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Please enter the admin passcode.");
      return;
    }
    setSubmitting(true);
    setError("");
    setDiagnostics(null);
    try {
      await adminApiService.login(passcode.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Incorrect passcode.");
      // A plain wrong passcode needs no explaining. Anything else means the
      // deployment may be at fault, so go and find out which part.
      if (!/incorrect passcode/i.test(err?.message || "")) {
        const status = await adminApiService.getConfigStatus();
        setDiagnostics(status ?? "unreachable");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderDiagnostics = () => {
    if (!diagnostics) return null;

    const rows: { label: string; ok: boolean; hint: string }[] =
      diagnostics === "unreachable"
        ? [
            {
              label: "API reachable at /api",
              ok: false,
              hint: "Nothing answered at /api/config-status. The deployment has not rebuilt since the API was added, or /api is not routed to the server function.",
            },
          ]
        : [
            {
              label: "API reachable at /api",
              ok: true,
              hint: "",
            },
            {
              label: "Request path preserved",
              ok: diagnostics.routingOk !== false,
              hint: `The server saw "${diagnostics.receivedPath ?? "unknown"}". If that is not the full path, nested routes such as /api/admin/login cannot match.`,
            },
            {
              label: "ADMIN_PASSCODE set",
              ok: !!diagnostics.configured?.ADMIN_PASSCODE,
              hint: "Add it to your hosting environment variables, then redeploy — environment changes only apply to a new build.",
            },
            {
              label: "ADMIN_JWT_SECRET set",
              ok: !!diagnostics.configured?.ADMIN_JWT_SECRET,
              hint: "Add it to your hosting environment variables, then redeploy.",
            },
            {
              label: "SUPABASE_SERVICE_ROLE_KEY set",
              ok: !!diagnostics.configured?.SUPABASE_SERVICE_ROLE_KEY,
              hint: "Not needed to sign in, but every action inside the panel will fail without it.",
            },
          ];

    return (
      <div className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4 space-y-2 text-left">
        <div className="flex items-center gap-1.5">
          <ServerCog size={13} className="text-[#5A5049]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5A5049]">
            Server check
          </span>
        </div>
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.label} className="text-[11px] leading-snug">
              <span className={row.ok ? "text-[#5A7052]" : "text-[#A55D25]"}>
                {row.ok ? "✓" : "✗"}
              </span>{" "}
              <span className="text-[#3C3530] font-semibold">{row.label}</span>
              {!row.ok && row.hint && (
                <span className="block text-[10px] text-[#68625D] pl-3.5">{row.hint}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDF9F5] flex items-center justify-center p-4 sm:p-6">
      {/* Back to the main AURA site — the admin panel is a separate /admin route
          with no shared navigation, so this is the only way out without editing
          the URL. */}
      <a
        href="/"
        className="fixed top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/80 backdrop-blur border border-[#EFE8E2] text-xs font-bold text-[#5A5049] hover:text-[#3C3530] hover:bg-white shadow-sm transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to AURA</span>
      </a>

      <div className="max-w-sm w-full">
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 bg-[#3C3530] text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <ShieldCheck size={28} />
            </div>
            <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-[#FDF9F5] border border-[#EFE8E2] text-[#3C3530] text-[10px] font-bold uppercase tracking-wider">
              <KeyRound size={12} className="text-[#5A5049] mr-1" />
              <span>Restricted Administrator Access</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">AURA Admin Panel</h2>
            <p className="text-xs sm:text-sm text-[#68625D]">
              Enter the administrator passcode to manage counselor credentialing and user assignments.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#68625D] uppercase tracking-wider mb-1.5">
                Passcode
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] tracking-[0.3em] text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
              />
            </div>

            {error && <p className="text-xs text-[#A55D25] font-medium text-center">{error}</p>}

            {renderDiagnostics()}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              <span>{submitting ? "Verifying..." : "Enter Admin Panel"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="text-[11px] text-[#68625D] text-center pt-2 border-t border-[#EFE8E2]">
            Repeated failed attempts will temporarily lock this device out.
            <span className="block mt-1 text-[10px] text-[#B9B0A6] font-mono">build {__BUILD_ID__}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
