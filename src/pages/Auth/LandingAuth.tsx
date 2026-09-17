import React from "react";
import { Activity, UserCheck, Shield, ArrowLeft, ArrowRight, Lock, HeartHandshake, Users, ShieldCheck } from "lucide-react";

interface Props {
  onChoice: (role: "participant" | "worker", mode: "login" | "signup") => void;
  onBack: () => void;
}

export const LandingAuth: React.FC<Props> = ({ onChoice, onBack }) => {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-stretch">
        {/* Left Humanitarian Branding Panel */}
        <div className="bg-[#3C3530] rounded-3xl p-8 sm:p-12 text-white flex flex-col justify-between shadow-xs border border-[#3F4E4E] relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2] text-[#3C3530] flex items-center justify-center font-black shadow-xs">
              <Activity size={26} />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#DBC3B2] block mb-1">
                Access AURA
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
                Welcome to AURA
              </h2>
              <p className="text-[#EFE8E2]/90 text-sm mt-3 leading-relaxed">
                Adaptive Wellbeing & Distress Monitoring for trauma-affected communities. Please choose how you want to interact with the demonstration platform.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#FDF9F5]/5 border border-[#EFE8E2]/15 text-xs text-[#EFE8E2]/85 flex items-start space-x-3">
                <Shield size={16} className="text-[#DBC3B2] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">100% Synthetic Data:</strong> No real victim or identifying medical information is ever stored in this demo.
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FDF9F5]/5 border border-[#EFE8E2]/15 text-xs text-[#EFE8E2]/85 flex items-start space-x-3">
                <Lock size={16} className="text-[#DBC3B2] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Role-protected:</strong> Participants and counselors see different things.
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-[#3F4E4E] flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-xs font-bold text-[#EFE8E2]/70 hover:text-white transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Home</span>
            </button>
            <span className="text-[11px] text-[#DBC3B2] font-mono">v1.0</span>
          </div>
        </div>

        {/* Right Role Decision Cards */}
        <div className="flex flex-col justify-center space-y-6">
          {/* Participant Access Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#EFE8E2] shadow-xs space-y-5 hover:border-[#5A5049] transition-colors">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center shrink-0">
                <HeartHandshake size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#3C3530]">Participant Access</h3>
                <p className="text-xs text-[#68625D] mt-1 leading-relaxed">
                  For individuals voluntarily completing daily wellbeing check-ins and accessing support signals.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => onChoice("participant", "signup")}
                className="py-3.5 px-4 rounded-xl bg-[#5A5049] text-white font-bold text-sm hover:bg-[#3C3530] transition-all shadow-xs active:scale-95 text-center cursor-pointer"
              >
                Sign Up
              </button>
              <button
                onClick={() => onChoice("participant", "login")}
                className="py-3.5 px-4 rounded-xl border border-[#EFE8E2] bg-white text-[#3C3530] font-bold text-sm hover:bg-[#FDF9F5] hover:border-[#DBC3B2] transition-all active:scale-95 text-center cursor-pointer"
              >
                Log In
              </button>
            </div>
          </div>

          {/* Counselor Access Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#EFE8E2] shadow-xs space-y-5 hover:border-[#3C3530] transition-colors">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF9F5] text-[#3C3530] border border-[#EFE8E2] flex items-center justify-center shrink-0">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#3C3530]">Counselor Portal</h3>
                <p className="text-xs text-[#68625D] mt-1 leading-relaxed">
                  For authorized counselors, case managers, and NGO humanitarian teams reviewing distress trends.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onChoice("worker", "login")}
                className="w-full py-3.5 px-4 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Counselor Login</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[#68625D] font-medium">
            Demo Credentials available on login screens for instant evaluator evaluation.
          </p>

          {/* Discreet admin entry point — not a role card by design; the admin
              panel is passcode-gated and isolated from this participant/
              counselor flow (see src/admin/). A real page navigation
              (not React state) since /admin is its own bootstrapped app. */}
          <div className="text-center">
            <a
              href="/admin"
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#B9B0A6] hover:text-[#5A5049] transition-colors"
            >
              <ShieldCheck size={11} />
              <span>Administrator Access</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
