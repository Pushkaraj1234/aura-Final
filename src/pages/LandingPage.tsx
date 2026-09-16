import React from "react";
import { LiteracyLibrary } from "../components/LiteracyLibrary";
import {
  Activity,
  Shield,
  Users,
  ArrowRight,
  HeartHandshake,
  TrendingUp,
  Lock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface Props {
  onStart: (role?: "participant" | "worker") => void;
  onOpenPrivacy: () => void;
}

export const LandingPage: React.FC<Props> = ({ onStart, onOpenPrivacy }) => {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Main Hero Header */}
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#3C3530] tracking-tight leading-[1.08]">
              Atrocity Understanding &amp; Recovery Assist
            </h1>
            <p className="text-xl sm:text-2xl font-medium text-[#5A5049] max-w-3xl mx-auto">
              A short check-in, a few times a week. AURA tells you whose answers are drifting, and what moved.
            </p>
            <p className="text-base sm:text-lg text-[#7A726C] max-w-2xl mx-auto leading-relaxed">
              It can be wrong. A counselor decides what happens next, and every score shows the arithmetic behind it.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => onStart()}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#5A5049] text-white font-bold text-base hover:bg-[#3C3530] transition-all shadow-lg shadow-[#5A5049]/20 flex items-center justify-center space-x-2 group active:scale-95 cursor-pointer"
              >
                <span>Start the demo</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Ethical Disclaimer Callout */}
            <div className="pt-6">
              <div className="inline-flex items-center space-x-2 text-xs font-semibold text-[#7A726C] bg-white/90 border border-[#EFE8E2] px-4 py-2 rounded-xl shadow-xs">
                <AlertCircle size={14} className="text-[#A55D25] shrink-0" />
                <span>
                  Demo data. <strong>AURA doesn't diagnose</strong>, and a person reviews every flag.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Decision Cards Section */}
      <section className="py-12 bg-white border-y border-[#EFE8E2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
              Two ways in
            </h2>
            <p className="text-sm text-[#7F8C8D] mt-2">
              Same data, both sides.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Participant Card */}
            <div
              onClick={() => onStart("participant")}
              className="group p-8 rounded-3xl bg-gradient-to-b from-[#DBC3B2]/15 to-white border-2 border-[#EFE8E2] hover:border-[#5A5049] hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#5A5049] text-[#DBC3B2] flex items-center justify-center shadow-md shadow-[#5A5049]/20 group-hover:scale-105 transition-transform">
                  <HeartHandshake size={28} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] block mb-1">
                    If you're being supported
                  </span>
                  <h3 className="text-2xl font-bold text-[#3C3530] group-hover:text-[#5A5049] transition-colors">
                    Participant
                  </h3>
                  <p className="text-sm text-[#7F8C8D] mt-2 leading-relaxed">
                    A few short questions about your week, one screen at a time.
                  </p>
                </div>
                <ul className="text-xs text-[#7A726C] space-y-2 pt-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#5A5049] mr-2 shrink-0" />
                    One question per screen
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#5A5049] mr-2 shrink-0" />
                    Emergency help in the top bar
                  </li>
                </ul>
              </div>

              <button className="w-full py-3.5 rounded-xl bg-[#5A5049] text-white font-bold text-sm group-hover:bg-[#3C3530] transition-colors flex items-center justify-center space-x-2 cursor-pointer">
                <span>Continue as Participant</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Counselor Card */}
            <div
              onClick={() => onStart("worker")}
              className="group p-8 rounded-3xl bg-gradient-to-b from-[#EFE8E2]/40 to-white border-2 border-[#EFE8E2] hover:border-[#3C3530] hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#3C3530] text-[#DBC3B2] flex items-center justify-center shadow-md shadow-[#3C3530]/20 group-hover:scale-105 transition-transform">
                  <Users size={28} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#7F8C8D] block mb-1">
                    If you're the counselor
                  </span>
                  <h3 className="text-2xl font-bold text-[#3C3530] group-hover:text-[#5A5049] transition-colors">
                    Counselor dashboard
                  </h3>
                  <p className="text-sm text-[#7F8C8D] mt-2 leading-relaxed">
                    Everyone assigned to you, worst first.
                  </p>
                </div>
                <ul className="text-xs text-[#7A726C] space-y-2 pt-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    A 0-100 score, arithmetic shown
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    What moved it: sleep, stress, safety, connection
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    An audit log of who read what
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    Nothing escalates without you
                  </li>
                </ul>
              </div>

              <button className="w-full py-3.5 rounded-xl bg-[#3C3530] text-white font-bold text-sm group-hover:bg-[#3F4E4E] transition-colors flex items-center justify-center space-x-2 cursor-pointer">
                <span>Continue as Counselor</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars Section */}
      <section className="py-16 bg-[#FDF9F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <TrendingUp size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">Change, not snapshots</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                AURA compares today's answer to the ones before. That's where the slow climbs show up, the ones nobody says out loud.
              </p>
            </div>

            <div className="p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <Activity size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">No black boxes</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                Every signal shows its working.
              </p>
            </div>

            <div className="p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <Shield size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">A person decides</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                A counselor signs off before anyone is contacted. AURA never diagnoses, and never calls anybody's family on its own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The same four pieces a signed-in participant gets, in front of the
          sign-up wall rather than behind it.

          Someone deciding whether to hand their situation to a wellbeing app
          is exactly the person who benefits from reading what a counsellor
          here can and cannot do, and what happens to what they type, before
          they decide. Requiring an account first gets that backwards.

          Rendered through the shared component, so this copy and the one
          inside the app cannot say different things. */}
      <section className="py-16 bg-white border-t border-[#EFE8E2]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiteracyLibrary>
            <section className="rounded-3xl border border-[#E0D7CE] bg-[#FDFAF7] p-6 sm:p-7 space-y-4">
              <h3 className="text-lg font-bold text-[#3C3530]">When you're ready</h3>
              <p className="text-[15px] text-[#5A5049] leading-relaxed">
                Reading costs nothing and nobody is told you were here. If you want to start
                checking in, that takes about a minute.
              </p>
              <button
                onClick={() => onStart("participant")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors cursor-pointer"
              >
                <span>Start a check-in</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </section>
          </LiteracyLibrary>
        </div>
      </section>

      {/* Footer Banner */}
      <section className="bg-[#3C3530] text-white py-8 px-4 border-t border-[#3F4E4E] text-center">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="text-xs font-semibold text-[#DBC3B2]">
            AURA
          </p>
          <p className="text-xs text-[#EFE8E2]/70">
            A prototype, not a clinical tool.
          </p>
        </div>
      </section>
    </div>
  );
};
