import React, { useState } from "react";
import { Users, Shield, ArrowRight, ArrowLeft, Lock, KeyRound } from "lucide-react";
import { authService, DEMO_CREDENTIALS } from "../../services/authService";

interface Props {
  onSuccess: () => void;
  onBack: () => void;
  onGoToApply?: () => void;
}

export const SupportLogin: React.FC<Props> = ({ onSuccess, onBack, onGoToApply }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your staff or counselor email address and password.");
      return;
    }

    try {
      await authService.login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    }
  };

  const handleFillDemo = () => {
    setEmail(DEMO_CREDENTIALS.supportWorker.email);
    setPassword(DEMO_CREDENTIALS.supportWorker.password);
    setError("");
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-[#7F8C8D] hover:text-[#3C3530] transition-colors flex items-center space-x-1.5 mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Role Selection</span>
        </button>

        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 bg-[#3C3530] text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Users size={28} />
            </div>
            <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-[#FDF9F5] border border-[#EFE8E2] text-[#3C3530] text-[10px] font-bold uppercase tracking-wider">
              <Shield size={12} className="text-[#5A5049] mr-1" />
              <span>Authorized Humanitarian Personnel Only</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
              Counselor Portal
            </h2>
            <p className="text-xs sm:text-sm text-[#7F8C8D]">
              Access the clinical distress monitoring dashboard and case review queue.
            </p>
          </div>

          {/* Quick Demo Credentials Box */}
          <div className="bg-[#FDF9F5] border border-[#EFE8E2] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#3C3530] flex items-center">
                Demo Counselor Account
              </span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#3C3530] text-white hover:bg-[#3F4E4E] transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                Auto-fill Demo
              </button>
            </div>
            <div className="text-xs font-mono text-[#3C3530] bg-white p-2 rounded-lg space-y-0.5 border border-[#EFE8E2]">
              <p>Email: <span className="font-semibold">{DEMO_CREDENTIALS.supportWorker.email}</span></p>
              <p>Password: <span className="font-semibold">{DEMO_CREDENTIALS.supportWorker.password}</span></p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                Staff Email Address
              </label>
              <input
                type="email"
                placeholder="support@aura.demo"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            {error && <p className="text-xs text-[#A55D25] font-medium">{error}</p>}

            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Authenticate & Enter Portal</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="pt-2 border-t border-[#EFE8E2] text-center space-y-2">
            <p className="text-[11px] text-[#7F8C8D]">
              Humanitarian staff must abide by ethical guidelines and strict data protection protocols.
            </p>
            {onGoToApply && (
              <button
                type="button"
                onClick={onGoToApply}
                className="text-xs font-bold text-[#3C3530] hover:underline cursor-pointer"
              >
                New counselor? Apply here
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
