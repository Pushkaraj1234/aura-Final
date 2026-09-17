import React, { useState } from "react";
import {
  Shield,
  Lock,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Eye,
  Server,
  UserCheck,
  LifeBuoy,
  WifiOff,
  Cpu,
  RefreshCw,
  Scale,
  Layers,
  FileDown
} from "lucide-react";
import { ResponsibleAIBadges } from "../components/ResponsibleAIBadges";

interface Props {
  onOpenEmergency: () => void;
}

export const PrivacyArchitecture: React.FC<Props> = ({ onOpenEmergency }) => {
  const [activeTab, setActiveTab] = useState<"pipeline" | "offline" | "governance">("pipeline");

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Top Banner */}
      <div className="bg-[#3C3530] text-white rounded-3xl p-6 sm:p-10 shadow-xs space-y-3 border border-[#3F4E4E]">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2] text-xs font-bold">
          <Shield size={13} />
          <span>Responsible AI &amp; system architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          System Architecture & Ethical Governance
        </h1>
        <p className="text-[#EFE8E2]/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
          How AURA safeguards vulnerable populations affected by atrocities through data minimization, explainable trajectory modeling, offline mesh readiness, and human-in-the-loop oversight.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#EFE8E2] pb-2">
        {[
          { id: "pipeline", label: "7-Stage Intelligence Pipeline" },
          { id: "offline", label: "Offline Field-Sync Architecture" },
          { id: "governance", label: "Fairness, Bias & Privacy Guarantees" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#3C3530] text-white shadow-xs"
                : "text-[#6B635C] hover:bg-[#FDF9F5]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: 7-Stage Intelligence Pipeline */}
      {activeTab === "pipeline" && (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#EFE8E2] shadow-xs space-y-6">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
              End-to-End Decision-Support Flow
            </span>
            <h2 className="text-2xl font-black text-[#3C3530] mt-1">
              Monitor → Detect → Predict → Explain → Recommend → Review → Measure
            </h2>
            <p className="text-xs text-[#68625D] mt-0.5">
              This does not diagnose anything. It helps a counselor decide who to check on first.
            </p>
          </div>

          {/* 7-Step Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {[
              {
                step: "01",
                title: "Voluntary Check-in",
                subtitle: "Trauma-Informed Intake",
                desc: "Participant consents to voluntary 1-question screens with full skip capability and voice support.",
                tag: "Zero-Surveillance",
                color: "bg-[#5A5049] text-white"
              },
              {
                step: "02",
                title: "Change Detection",
                subtitle: "Multi-Day Delta",
                desc: "Engine computes slope, sleep degradation, and social isolation score deltas over rolling windows.",
                tag: "Dynamic Delta",
                color: "bg-[#3C3530] text-white"
              },
              {
                step: "03",
                title: "Predictive Trajectory",
                subtitle: "Early-Warning Model",
                desc: "Simulates 7-day trajectory forecasts (Rapid, Gradual, Fluctuating, Improving) with confidence intervals.",
                tag: "Simulated Forecast",
                color: "bg-[#A85D2E] text-white"
              },
              {
                step: "04",
                title: "Explainable Factors",
                subtitle: "Transparent XAI",
                desc: "Deconstructs distress scores into contributing factor percentages (Sleep: 35%, Stress: 30%, etc.).",
                tag: "No Black Box",
                color: "bg-[#5A5049] text-white"
              },
              {
                step: "05",
                title: "Support Plan Gen",
                subtitle: "Recommendation Engine",
                desc: "Matches what the trend is doing to a written humanitarian protocol, and suggests the next step.",
                tag: "Humanitarian Matching",
                color: "bg-[#3C3530] text-white"
              },
              {
                step: "06",
                title: "Human Review",
                subtitle: "Counselor Sign-Off",
                desc: "Authorized workers review, accept, modify, or decline AI suggestions before taking any action.",
                tag: "Human-in-the-Loop",
                color: "bg-[#A85D2E] text-white"
              },
              {
                step: "07",
                title: "Outcome Tracking",
                subtitle: "Follow-Up Loop",
                desc: "Measures pre- and post-support recovery score deltas to validate intervention efficacy.",
                tag: "Efficacy Metric",
                color: "bg-emerald-700 text-white"
              },
              {
                step: "08",
                title: "Crisis Interception",
                subtitle: "Safety Bypass",
                desc: "Direct safety concerns bypass predictive scoring and trigger immediate 24/7 hotline directory.",
                tag: "Safety First",
                color: "bg-[#A55D25] text-white"
              }
            ].map((item, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${item.color}`}>
                      {item.step}
                    </span>
                    <span className="text-[10px] font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-2 py-0.5 rounded">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#3C3530] text-sm">{item.title}</h3>
                  <p className="text-[11px] font-semibold text-[#68625D]">{item.subtitle}</p>
                  <p className="text-xs text-[#6B635C] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Offline Field-Sync Architecture */}
      {activeTab === "offline" && (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#EFE8E2] shadow-xs space-y-6">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
              Disaster & Low-Connectivity Deployment
            </span>
            <h2 className="text-2xl font-black text-[#3C3530] mt-1">
              Offline-First Mesh Architecture
            </h2>
            <p className="text-xs text-[#68625D] mt-0.5">
              Engineered for refugee settlements, conflict zones, and disaster response sites without reliable cellular network.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <Database size={22} />
              </div>
              <h3 className="text-base font-bold text-[#3C3530]">Local Storage Cache</h3>
              <p className="text-xs text-[#6B635C] leading-relaxed">
                Check-ins, trend calculations, and emergency contacts are cached in encrypted browser storage (IndexedDB/AES-256) for instant offline operation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <RefreshCw size={22} />
              </div>
              <h3 className="text-base font-bold text-[#3C3530]">Opportunistic Re-Sync</h3>
              <p className="text-xs text-[#6B635C] leading-relaxed">
                When humanitarian workers reach network coverage, local batches are cryptographically signed and securely uploaded without data loss or conflicts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <Cpu size={22} />
              </div>
              <h3 className="text-base font-bold text-[#3C3530]">Client-Side Scoring</h3>
              <p className="text-xs text-[#6B635C] leading-relaxed">
                The distress trajectory engine runs 100% on the device without requiring cloud round-trips or costly external LLM APIs during intake.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Governance & Guardrails */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          <ResponsibleAIBadges />
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <Lock size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#3C3530]">Data Minimization</h3>
              <p className="text-xs sm:text-sm text-[#6B635C] leading-relaxed">
                We store only anonymous IDs, age brackets (not full birthdates), and aggregate reflection scores. No biometric, GPS location, or device telemetry is collected.
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <Eye size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#3C3530]">No Black-Box Scoring</h3>
              <p className="text-xs sm:text-sm text-[#6B635C] leading-relaxed">
                Every indicator score is 100% explainable to both participant and counselor with clear factor percentages (sleep, stress, safety, connection).
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EFE8E2] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#DBC3B2]/20 text-[#5A5049] flex items-center justify-center mb-2">
                <HeartHandshake size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#3C3530]">Non-Diagnostic Mandate</h3>
              <p className="text-xs sm:text-sm text-[#6B635C] leading-relaxed">
                AURA explicitly forbids medical diagnostic labeling (e.g. PTSD, major depression). The system strictly outputs assistive distress risk flags for human practitioners.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Crisis Contact Callout */}
      <div className="bg-[#A55D25] text-white rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-bold">Looking for immediate crisis assistance?</h3>
          <p className="text-xs sm:text-sm text-white/90">
            Access free, confidential 24/7 global and regional humanitarian hotlines.
          </p>
        </div>
        <button
          onClick={onOpenEmergency}
          className="px-6 py-3.5 rounded-2xl bg-white text-[#A55D25] font-bold text-sm hover:bg-[#FDF9F5] transition-colors shadow-xs shrink-0 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <LifeBuoy size={16} />
          <span>Open Emergency Directory</span>
        </button>
      </div>
    </div>
  );
};
