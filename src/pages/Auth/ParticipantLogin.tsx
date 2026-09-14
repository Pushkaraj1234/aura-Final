import React, { useState } from "react";
import { Lock, ArrowRight, ArrowLeft, HeartHandshake, KeyRound, Check } from "lucide-react";
import { authService, DEMO_CREDENTIALS } from "../../services/authService";


interface Props {
  onSuccess: () => void;
  onBack: () => void;
  onGoToSignUp: () => void;
}

export const ParticipantLogin: React.FC<Props> = ({ onSuccess, onBack, onGoToSignUp }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email address and password.");
      return;
    }

    try {
      // The mirror of the counsellor portal's check: a counsellor signing in
      // here is sent to their own door rather than dropped into a participant
      // view of the app.
      await authService.signInToPortal(email, password, "participant");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    }
  };

  const handleFillDemo = () => {
    setEmail(DEMO_CREDENTIALS.participant.email);
    setPassword(DEMO_CREDENTIALS.participant.password);
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
            <div className="w-14 h-14 bg-[#DBC3B2]/20 text-[#5A5049] rounded-2xl flex items-center justify-center mx-auto mb-2">
              <HeartHandshake size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
              Participant Log In
            </h2>
            <p className="text-xs sm:text-sm text-[#7F8C8D]">
              Access your daily wellbeing check-ins and reflection trends.
            </p>
          </div>

          {/* Quick Demo Credentials Box */}
          <div className="bg-[#DBC3B2]/15 border border-[#DBC3B2]/40 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center">
                Demo Account Available
              </span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#5A5049] text-white hover:bg-[#3C3530] transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                Auto-fill Demo
              </button>
            </div>
            <div className="text-xs font-mono text-[#3C3530] bg-white/80 p-2 rounded-lg space-y-0.5 border border-[#DBC3B2]/30">
              <p>Email: <span className="font-semibold">{DEMO_CREDENTIALS.participant.email}</span></p>
              <p>Password: <span className="font-semibold">{DEMO_CREDENTIALS.participant.password}</span></p>
            </div>
          </div>

          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-[#7F8C8D]">
                  (Demo: any text or Demo@123)
                </span>
              </div>
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
              className="w-full py-4 rounded-xl bg-[#5A5049] text-white font-bold text-sm hover:bg-[#3C3530] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Sign In as Participant</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="pt-2 border-t border-[#EFE8E2] text-center text-xs text-[#7F8C8D]">
            <span>Don't have an account yet? </span>
            <button
              type="button"
              onClick={onGoToSignUp}
              className="font-bold text-[#5A5049] hover:underline cursor-pointer"
            >
              Sign Up Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
