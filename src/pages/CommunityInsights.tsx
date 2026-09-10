import React, { useState } from "react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  MapPin,
  BarChart3,
  ShieldCheck,
  Building,
  UserPlus,
  HelpCircle,
  Info
} from "lucide-react";
import { RegionPlanningData } from "../types";

export const MOCK_REGIONS: RegionPlanningData[] = [
  {
    regionId: "reg-b",
    name: "Region B — Central Relief Hub & Transit Camp",
    code: "REG-B",
    activeParticipants: 48,
    demandTrend: "increasing",
    demandScore: 82,
    supportRequestsCount: 19,
    currentCounselors: 3,
    recommendedCounselors: 6,
    signalNote: "Potential resource planning signal: Rapid rise in relocation stress and sleep disruption. Deploy additional humanitarian counselors."
  },
  {
    regionId: "reg-a",
    name: "Region A — Northern District Residential Zone",
    code: "REG-A",
    activeParticipants: 36,
    demandTrend: "stable",
    demandScore: 42,
    supportRequestsCount: 6,
    currentCounselors: 3,
    recommendedCounselors: 3,
    signalNote: "Stable wellbeing indicators. Adequate staffing levels for routine voluntary reflections."
  },
  {
    regionId: "reg-c",
    name: "Region C — Eastern Community Shelter Complex",
    code: "REG-C",
    activeParticipants: 28,
    demandTrend: "decreasing",
    demandScore: 35,
    supportRequestsCount: 4,
    currentCounselors: 2,
    recommendedCounselors: 2,
    signalNote: "Positive recovery trajectory following community center peer circle rollout."
  },
  {
    regionId: "reg-d",
    name: "Region D — Western Outpost Logistics Center",
    code: "REG-D",
    activeParticipants: 16,
    demandTrend: "increasing",
    demandScore: 68,
    supportRequestsCount: 7,
    currentCounselors: 1,
    recommendedCounselors: 3,
    signalNote: "Moderate increase in isolation indicators. Recommend expanding peer group outreach."
  }
];

export const CommunityInsights: React.FC = () => {
  const [regions, setRegions] = useState<RegionPlanningData[]>(MOCK_REGIONS);

  // Common signals aggregate breakdown
  const commonSignals = [
    { name: "Reported Stress / Tension", count: 72, percent: 56, impact: "high" },
    { name: "Sleep Quality Disruption", count: 54, percent: 42, impact: "high" },
    { name: "Social Disconnection / Isolation", count: 39, percent: 30, impact: "medium" },
    { name: "Environmental Safety Uncertainty", count: 23, percent: 18, impact: "medium" },
    { name: "Explicit Support Counselor Requests", count: 18, percent: 14, impact: "high" }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Anonymous Macro Analytics
            </span>
            <span className="text-xs text-[#7F8C8D] font-mono">
              Privacy-Preserving Aggregations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#3C3530] mt-1 tracking-tight">
            Community Wellbeing & Resource Planning
          </h1>
          <p className="text-sm text-[#7A726C] max-w-3xl mt-1 leading-relaxed">
            Macro-level synthetic insights help humanitarian NGOs and aid coordinators allocate counselors, supplies, and community spaces without exposing individual participant identities.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs font-bold text-[#7A726C]">
          <span>Synthetic Demonstration Aggregates</span>
        </div>
      </div>

      {/* Hero Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Monitored */}
        <div className="p-5 rounded-3xl bg-[#3C3530] text-white col-span-2 sm:col-span-1 shadow-xs">
          <span className="text-[11px] font-bold text-[#DBC3B2] uppercase tracking-wider block mb-1">
            Participants Monitored
          </span>
          <span className="text-4xl font-black text-white">128</span>
          <span className="text-[11px] text-[#EFE8E2]/70 mt-2 block">
            Across 4 humanitarian zones
          </span>
        </div>

        {/* Improving */}
        <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Improving
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-emerald-600">46%</span>
            <span className="text-xs text-[#7F8C8D]">(59)</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            Downward distress trend
          </span>
        </div>

        {/* Stable */}
        <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Stable
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-[#3C3530]">31%</span>
            <span className="text-xs text-[#7F8C8D]">(40)</span>
          </div>
          <span className="text-[11px] text-[#7A726C] mt-1 block">
            Baseline routine maintained
          </span>
        </div>

        {/* Increasing */}
        <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Increasing Distress
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-[#A55D25]">18%</span>
            <span className="text-xs text-[#7F8C8D]">(23)</span>
          </div>
          <span className="text-[11px] text-[#A55D25] font-semibold mt-1 block">
            Rising stress / sleep signals
          </span>
        </div>

        {/* Urgent Safety */}
        <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Urgent Signals
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-[#A55D25]">5%</span>
            <span className="text-xs text-[#7F8C8D]">(6)</span>
          </div>
          <span className="text-[11px] text-[#A55D25] font-semibold mt-1 block">
            Immediate human priority
          </span>
        </div>
      </div>

      {/* Aggregate Signals & Trend Chart Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most Common Signals Breakdown */}
        <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#5A5049] text-[#DBC3B2] flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3C3530]">
                  Most Common Community Signals
                </h3>
                <p className="text-xs text-[#7F8C8D]">
                  Frequency of self-reported indicators across all cohorts
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {commonSignals.map((sig, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#3C3530]">{sig.name}</span>
                  <span className="font-mono text-[#7A726C] font-bold">
                    {sig.percent}% ({sig.count} participants)
                  </span>
                </div>
                <div className="w-full bg-[#EFE8E2] h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0
                        ? "bg-[#A55D25]"
                        : idx === 1
                        ? "bg-[#D49B6A]"
                        : "bg-[#5A5049]"
                    }`}
                    style={{ width: `${sig.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#7A726C] flex items-start space-x-2">
            <Info size={15} className="text-[#5A5049] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Stress and sleep disruption represent <strong>78% of compound signal triggers</strong>. Early environmental intervention (such as quiet zones) significantly lowers escalation risk.
            </p>
          </div>
        </div>

        {/* 14-Day Community Trend Visualization */}
        <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#3C3530] text-[#DBC3B2] flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3C3530]">
                  14-Day Community Distress Curve
                </h3>
                <p className="text-xs text-[#7F8C8D]">
                  Average distress score across all 128 synthetic participants
                </p>
              </div>
            </div>
          </div>

          {/* SVG Trend Chart */}
          <div className="h-44 w-full relative pt-2 pb-2">
            <svg className="w-full h-full" viewBox="0 0 450 120" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="450" y2="20" stroke="#EFE8E2" strokeWidth="1" />
              <line x1="0" y1="60" x2="450" y2="60" stroke="#EFE8E2" strokeWidth="1" />
              <line x1="0" y1="100" x2="450" y2="100" stroke="#EFE8E2" strokeWidth="1" />

              {/* Area gradient */}
              <defs>
                <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DBC3B2" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#DBC3B2" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Line path: 58 -> 55 -> 52 -> 61 -> 64 -> 59 -> 54 -> 49 -> 46 -> 43 -> 41 */}
              <path
                d="M 10 50 L 50 54 L 95 60 L 140 46 L 185 41 L 230 48 L 275 56 L 320 64 L 365 70 L 410 74 L 440 76"
                fill="none"
                stroke="#5A5049"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              <path
                d="M 10 50 L 50 54 L 95 60 L 140 46 L 185 41 L 230 48 L 275 56 L 320 64 L 365 70 L 410 74 L 440 76 L 440 120 L 10 120 Z"
                fill="url(#commGrad)"
              />

              {/* Nodes */}
              {[
                { x: 10, y: 50, val: "52" },
                { x: 140, y: 46, val: "58" },
                { x: 230, y: 48, val: "54" },
                { x: 320, y: 64, val: "44" },
                { x: 440, y: 76, val: "38" }
              ].map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r={4.5} fill="#3C3530" stroke="#ffffff" strokeWidth="2" />
                  <text x={pt.x} y={pt.y - 8} textAnchor="middle" className="text-[10px] font-bold fill-[#3C3530]">
                    {pt.val}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#7F8C8D] pt-1">
            <span>Day -14 (Relocation Peak)</span>
            <span className="font-bold text-emerald-700">Day 0 (Post-Intervention Recovery: 38/100)</span>
          </div>
        </div>
      </div>

      {/* Model-Agreement Tracking / AI Trust Calibration (Requirement #10) */}
      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFE8E2] pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#5A5049] text-white flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFE8E2] text-[#5A5049]">
                Clinical Trust & Governance
              </span>
              <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
                Model-Agreement & Override Tracking
              </h3>
            </div>
          </div>
          <div className="text-xs text-[#7F8C8D] italic">
            Evaluates how often clinicians trust vs. override the AI's distress score.
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
            <h4 className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wider">AI Score Overrides</h4>
            <div className="flex items-end space-x-3">
              <span className="text-4xl font-serif font-bold text-[#3C3530]">4.2%</span>
              <span className="text-sm font-medium text-emerald-600 mb-1 flex items-center"><TrendingDown size={14} className="mr-1"/> 1.1%</span>
            </div>
            <p className="text-xs text-[#5A5049] leading-relaxed">
              Caseworkers overrode the AI's risk score in 4.2% of flagged check-ins this month (down from 5.3% last month). This low rate indicates high baseline clinical trust.
            </p>
          </div>
          
          <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
            <h4 className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wider">Direction of Override</h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#3C3530]">Score reduced by human (False Positives)</span>
                  <span className="text-[#A55D25]">78%</span>
                </div>
                <div className="w-full bg-[#EFE8E2] rounded-full h-1.5"><div className="bg-[#A55D25] h-1.5 rounded-full" style={{ width: '78%' }}></div></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#3C3530]">Score increased by human (False Negatives)</span>
                  <span className="text-[#5A5049]">22%</span>
                </div>
                <div className="w-full bg-[#EFE8E2] rounded-full h-1.5"><div className="bg-[#5A5049] h-1.5 rounded-full" style={{ width: '22%' }}></div></div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#A55D25]/10 border border-[#A55D25]/30 space-y-3">
            <h4 className="text-xs font-bold text-[#A55D25] uppercase tracking-wider">Clinician Feedback Loop</h4>
            <p className="text-xs text-[#3C3530] leading-relaxed mb-2">
              The AI tends to slightly over-index on isolated keywords like "overwhelmed" even in positive contexts. 
              The threshold configs in <span className="font-mono bg-white/50 px-1 rounded text-[#A55D25]">alertConfig.ts</span> have been naturally recalibrating based on these override logs to reduce alarm fatigue.
            </p>
          </div>
        </div>
      </div>

      {/* Geographic / Regional Resource Planning Simulation (Requirement #12) */}
      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFE8E2] pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#A55D25]/20 text-[#A55D25] flex items-center justify-center">
              <MapPin size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A55D25]/15 text-[#A55D25]">
                Regional Support Simulation
              </span>
              <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
                Broad-Area Support Demand & Resource Planning
              </h3>
            </div>
          </div>

          <div className="text-xs text-[#7F8C8D] italic">
            Synthetic broad-area aggregation — no exact locations stored or displayed.
          </div>
        </div>

        {/* Regional Cards Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {regions.map((reg) => {
            const isHighDemand = reg.demandTrend === "increasing";
            return (
              <div
                key={reg.regionId}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isHighDemand
                    ? "bg-[#A55D25]/5 border-[#A55D25]/30 shadow-xs"
                    : "bg-[#FDF9F5] border-[#EFE8E2]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-black text-[#7F8C8D]">
                      {reg.code}
                    </span>
                    <h4 className="text-base font-black text-[#3C3530] mt-0.5">
                      {reg.name}
                    </h4>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1 ${
                    isHighDemand
                      ? "bg-[#A55D25] text-white"
                      : reg.demandTrend === "decreasing"
                      ? "bg-emerald-600 text-white"
                      : "bg-[#5A5049] text-white"
                  }`}>
                    {isHighDemand ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                    <span>{reg.demandTrend} demand</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#7F8C8D] uppercase block">Participants</span>
                    <span className="font-black text-sm text-[#3C3530]">{reg.activeParticipants}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#7F8C8D] uppercase block">Support Asks</span>
                    <span className="font-black text-sm text-[#3C3530]">{reg.supportRequestsCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#7F8C8D] uppercase block">Counselors</span>
                    <span className={`font-black text-sm ${reg.currentCounselors < reg.recommendedCounselors ? "text-[#A55D25]" : "text-[#5A5049]"}`}>
                      {reg.currentCounselors} / {reg.recommendedCounselors} rec.
                    </span>
                  </div>
                </div>

                {/* Resource Planning Signal Callout */}
                <div className="p-3 rounded-xl bg-white border border-[#EFE8E2] text-xs text-[#3C3530] flex items-start space-x-2">
                  <AlertTriangle size={15} className={`shrink-0 mt-0.5 ${isHighDemand ? "text-[#A55D25]" : "text-[#5A5049]"}`} />
                  <p className="leading-relaxed">
                    {reg.signalNote}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Privacy Note */}
        <div className="p-4 rounded-2xl bg-[#DBC3B2]/15 border border-[#DBC3B2]/30 flex items-start space-x-3 text-xs text-[#3C3530]">
          <ShieldCheck size={18} className="text-[#5A5049] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Humanitarian Privacy Guarantee:</strong> Aggregated insights help aid agencies plan resources, staff shifts, and distribute wellness materials across general zones without exposing individual participant records or personal data.
          </p>
        </div>
      </div>
    </div>
  );
};
