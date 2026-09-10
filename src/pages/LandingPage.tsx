import React from "react";
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
          {/* Top Pill */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#DBC3B2]/25 border border-[#DBC3B2]/50 text-[#5A5049] text-xs sm:text-sm font-semibold shadow-xs">
              <span>Humanitarian Technology</span>
            </div>
          </div>

          {/* Main Hero Header */}
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#3C3530] tracking-tight leading-[1.08]">
              Adaptive Wellbeing & Distress Monitoring
            </h1>
            <p className="text-xl sm:text-2xl font-medium text-[#5A5049] max-w-3xl mx-auto">
              AI-assisted dynamic support for trauma-affected communities
            </p>
            <p className="text-base sm:text-lg text-[#7A726C] max-w-2xl mx-auto leading-relaxed">
              Empowering counselors, humanitarian NGOs, and support teams to identify meaningful changes in psychological distress over time — with explainable indicators and human-in-the-loop governance.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => onStart()}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#5A5049] text-white font-bold text-base hover:bg-[#3C3530] transition-all shadow-lg shadow-[#5A5049]/20 flex items-center justify-center space-x-2 group active:scale-95 cursor-pointer"
              >
                <span>Explore Prototype Demo</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Ethical Disclaimer Callout */}
            <div className="pt-6">
              <div className="inline-flex items-center space-x-2 text-xs font-semibold text-[#7A726C] bg-white/90 border border-[#EFE8E2] px-4 py-2 rounded-xl shadow-xs">
                <AlertCircle size={14} className="text-[#A55D25] shrink-0" />
                <span>
                  Synthetic Demonstration Data • <strong>Does NOT diagnose mental disorders</strong> • Human Review Always Required
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
              Select Demonstration Role
            </h2>
            <p className="text-sm text-[#7F8C8D] mt-2">
              Experience the end-to-end trauma-informed workflow from either viewpoint.
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
                    Role 1 — Voluntary Intake
                  </span>
                  <h3 className="text-2xl font-bold text-[#3C3530] group-hover:text-[#5A5049] transition-colors">
                    Participant Experience
                  </h3>
                  <p className="text-sm text-[#7F8C8D] mt-2 leading-relaxed">
                    A person affected by traumatic events who voluntarily completes low-friction, dignity-first wellbeing reflections and accesses localized support.
                  </p>
                </div>
                <ul className="text-xs text-[#7A726C] space-y-2 pt-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#5A5049] mr-2 shrink-0" />
                    Informed, trauma-conscious consent flow
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#5A5049] mr-2 shrink-0" />
                    1-question-per-screen responsive check-in
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#5A5049] mr-2 shrink-0" />
                    Immediate emergency crisis interception
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
                    Role 2 — Authorized Support
                  </span>
                  <h3 className="text-2xl font-bold text-[#3C3530] group-hover:text-[#5A5049] transition-colors">
                    Counselor Dashboard
                  </h3>
                  <p className="text-sm text-[#7F8C8D] mt-2 leading-relaxed">
                    Counselors, case workers, and humanitarian teams reviewing aggregated trends, explainable AI factors, and escalating care where needed.
                  </p>
                </div>
                <ul className="text-xs text-[#7A726C] space-y-2 pt-2">
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    Dynamic multi-day trend analysis (0-100 score)
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    Explainable AI: Transparent factor breakdown
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 size={14} className="text-[#3C3530] mr-2 shrink-0" />
                    Human-in-the-loop review & escalation log
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
            <div className="bg-white p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <TrendingUp size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">1. Monitor Dynamically</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                Rather than relying on one-off questionnaires, AURA measures <strong>change over time</strong>, catching gradual distress climbs before acute escalation.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <Activity size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">2. Understand with XAI</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                No black-box predictions. Every signal is accompanied by transparent contributing factors (sleep, stress, safety, connection, support requests).
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-4">
                <Shield size={24} />
              </div>
              <h4 className="text-xl font-bold text-[#3C3530]">3. Human-in-the-Loop</h4>
              <p className="text-sm text-[#7A726C] leading-relaxed">
                AI provides signals — humans make care decisions. No automatic medical diagnoses or non-consensual authority contact.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Banner */}
      <section className="bg-[#3C3530] text-white py-8 px-4 border-t border-[#3F4E4E] text-center">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="text-xs font-semibold text-[#DBC3B2] uppercase tracking-widest">
            AURA Humanitarian Technology Initiative
          </p>
          <p className="text-xs text-[#EFE8E2]/70">
            Synthetic dataset only • Built in accordance with trauma-informed and privacy-first design principles.
          </p>
        </div>
      </section>
    </div>
  );
};
