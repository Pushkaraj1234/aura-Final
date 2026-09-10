import React from "react";
import {
  FileText,
  Cpu,
  HeartHandshake,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  TrendingUp
} from "lucide-react";

export const DataInsightActionVisual: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-[#3C3530] to-[#5A5049] rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#DBC3B2]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#A55D25]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2] border border-[#DBC3B2]/30">
              Core AURA Paradigm
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
              Data → Insight → Action Lifecycle
            </h3>
          </div>
          <span className="text-xs text-[#EFE8E2]/70 font-medium">
            AI-Assisted Humanitarian Support Pipeline
          </span>
        </div>

        {/* 3 Connected Cards */}
        <div className="grid md:grid-cols-3 gap-4 items-stretch">
          {/* Card 1: DATA */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between hover:bg-white/15 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#DBC3B2]/20 text-[#DBC3B2] flex items-center justify-center font-black">
                <FileText size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#DBC3B2]">
                  Step 01
                </span>
                <h4 className="text-lg font-black text-white tracking-tight">
                  DATA
                </h4>
                <p className="text-xs text-[#EFE8E2]/90 mt-1 font-bold">
                  Voluntary Wellbeing Check-ins
                </p>
              </div>
              <ul className="text-xs text-[#EFE8E2]/75 space-y-1.5 pt-2 border-t border-white/10">
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Self-reported stress & sleep</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Environmental safety sentiment</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Social connection & support asks</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-[#DBC3B2] font-semibold flex items-center justify-between">
              <span>Consent-Protected</span>
              <ArrowRight size={14} className="hidden md:block" />
            </div>
          </div>

          {/* Card 2: INSIGHT */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between hover:bg-white/15 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#DBC3B2]/20 text-[#DBC3B2] flex items-center justify-center font-black">
                <Cpu size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#DBC3B2]">
                  Step 02
                </span>
                <h4 className="text-lg font-black text-white tracking-tight">
                  INSIGHT
                </h4>
                <p className="text-xs text-[#EFE8E2]/90 mt-1 font-bold">
                  Dynamic Trajectory & XAI Signal
                </p>
              </div>
              <ul className="text-xs text-[#EFE8E2]/75 space-y-1.5 pt-2 border-t border-white/10">
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Multi-check-in moving averages</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Rate-of-change & volatility scoring</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Transparent contributing factor weights</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-[#DBC3B2] font-semibold flex items-center justify-between">
              <span>Explainable AI</span>
              <ArrowRight size={14} className="hidden md:block" />
            </div>
          </div>

          {/* Card 3: ACTION */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between hover:bg-white/15 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#DBC3B2]/20 text-[#DBC3B2] flex items-center justify-center font-black">
                <HeartHandshake size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#DBC3B2]">
                  Step 03
                </span>
                <h4 className="text-lg font-black text-white tracking-tight">
                  ACTION
                </h4>
                <p className="text-xs text-[#EFE8E2]/90 mt-1 font-bold">
                  Human-Reviewed Support & Outcomes
                </p>
              </div>
              <ul className="text-xs text-[#EFE8E2]/75 space-y-1.5 pt-2 border-t border-white/10">
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Trained counselor 1-on-1 outreach</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Personalized coping resources</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#DBC3B2]"></span>
                  <span>Measurable outcome & recovery loop</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-[#DBC3B2] font-semibold flex items-center justify-between">
              <span>Human-In-The-Loop</span>
              <UserCheck size={14} />
            </div>
          </div>
        </div>

        {/* Bottom Callout Banner */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#EFE8E2]/80">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={16} className="text-[#DBC3B2] shrink-0" />
            <span>
              <strong>Guiding Philosophy:</strong> AI-assisted, not AI-decided. Distress indicator ≠ clinical diagnosis.
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#DBC3B2] font-bold">
            Monitor → Detect → Explain → Support → Measure
          </span>
        </div>
      </div>
    </div>
  );
};
