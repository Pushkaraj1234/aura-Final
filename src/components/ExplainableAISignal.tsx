import React, { useState } from "react";
import {
  HelpCircle,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  UserCheck,
  Scale
} from "lucide-react";
import { FactorContribution, RiskAnalysis, TrajectoryAnalysis } from "../types";

interface Props {
  riskAnalysis?: RiskAnalysis | null;
  trajectory?: TrajectoryAnalysis | null;
  participantId?: string;
  isCompact?: boolean;
  factors?: string[] | FactorContribution[];
  overallConfidence?: string;
  summaryStatement?: string;
}

export const ExplainableAISignal: React.FC<Props> = ({
  riskAnalysis,
  trajectory,
  participantId,
  isCompact = false,
  factors: customFactors,
  overallConfidence = "High (92%)",
  summaryStatement
}) => {
  const [expanded, setExpanded] = useState(!isCompact);

  // Normalize factors list
  let detailedFactorsList: FactorContribution[] = [];

  if (riskAnalysis?.detailedFactors && riskAnalysis.detailedFactors.length > 0) {
    detailedFactorsList = riskAnalysis.detailedFactors;
  } else if (Array.isArray(customFactors) && customFactors.length > 0) {
    if (typeof customFactors[0] === "string") {
      detailedFactorsList = (customFactors as string[]).map((f, i) => ({
        name: f,
        impact: i === 0 ? "high" : i === 1 ? "medium" : "low",
        description: `Identified reflection factor: ${f}`,
        weightPercent: Math.round(100 / customFactors.length)
      }));
    } else {
      detailedFactorsList = customFactors as FactorContribution[];
    }
  } else {
    detailedFactorsList = [
      { name: "Stress Indicators", impact: "high", description: "Perceived situational pressure or emotional load", weightPercent: 32 },
      { name: "Sleep Disruption", impact: "medium", description: "Reported difficulty falling or staying asleep", weightPercent: 24 },
      { name: "Perceived Safety", impact: "medium", description: "Environmental or situational uncertainty", weightPercent: 18 },
      { name: "Social Connection", impact: "low", description: "Reduced contact with friends/family", weightPercent: 14 },
      { name: "Recent Trajectory", impact: "medium", description: "Change across recent check-in reflections", weightPercent: 12 }
    ];
  }

  const score = riskAnalysis?.score ?? trajectory?.currentScore ?? 35;
  const changeVal = riskAnalysis?.change ?? trajectory?.rateOfChange ?? 0;
  const leadSummary = summaryStatement ||
    (riskAnalysis?.factors && riskAnalysis.factors[0]) ||
    trajectory?.summaryDescription ||
    "The distress indicator is based on self-reported stress, sleep quality, and situational safety reflections.";

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-[#A55D25] text-white";
      case "medium":
        return "bg-[#D49B6A] text-white";
      case "positive":
        return "bg-[#5A5049] text-white";
      default:
        return "bg-[#7F8C8D] text-white";
    }
  };

  const getImpactBarColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-[#A55D25]";
      case "medium":
        return "bg-[#D49B6A]";
      case "positive":
        return "bg-[#5A5049]";
      default:
        return "bg-[#DBC3B2]";
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#3C3530] to-[#5A5049] text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2]">
                Explainable AI (XAI)
              </span>
              {participantId && (
                <span className="text-[10px] font-mono text-[#EFE8E2]/80">
                  {/^[0-9a-f-]{20,}$/i.test(participantId) ? `ref ${participantId.slice(0, 8)}` : participantId}
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              Why did AURA generate this signal?
            </h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Toggle explanation details"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <p className="text-xs text-[#EFE8E2]/90 mt-2.5 leading-relaxed">
          {leadSummary}
        </p>
      </div>

      {expanded && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Contributing Indicators Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D] flex items-center">
                <Scale size={14} className="mr-1.5 text-[#5A5049]" />
                Contributing Indicators & Estimated Weights
              </h4>
              <span className="text-[11px] font-semibold text-[#7F8C8D]">
                Distress Indicator: <strong className="text-[#3C3530]">{score}/100</strong>
              </span>
            </div>

            <div className="space-y-3">
              {detailedFactorsList.map((factor, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] hover:border-[#DBC3B2] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#3C3530]">{factor.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${getImpactColor(factor.impact)}`}>
                        {factor.impact} impact
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#3C3530]">
                      {factor.weightPercent}% weight
                    </span>
                  </div>

                  <p className="text-xs text-[#7A726C] mb-2 leading-relaxed">
                    {factor.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#EFE8E2] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getImpactBarColor(factor.impact)}`}
                      style={{ width: `${Math.min(100, Math.max(8, factor.weightPercent * 1.8))}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plain Language Synthesis */}
          <div className="p-4 rounded-2xl bg-[#DBC3B2]/15 border border-[#DBC3B2]/30 space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#5A5049]">
              <Info size={14} />
              <span>Plain-Language Synthesis</span>
            </div>
            <p className="text-xs text-[#3C3530] leading-relaxed">
              Based on voluntary reflection records, the AI distress indicator is currently{" "}
              <strong>{score}/100</strong> (rate of change:{" "}
              <strong>{changeVal >= 0 ? `+${changeVal}` : `${changeVal}`} pts</strong>).
              Primary drivers reflect reported stress, sleep quality, and environmental comfort.
            </p>
          </div>

          {/* What the AI Does NOT Know (Crucial Responsible AI Card) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#A55D25]/10 border border-[#A55D25]/30 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#A55D25]">
              <ShieldCheck size={16} />
              <span>What the AI Does NOT Know (Human-in-the-Loop Guardrail)</span>
            </div>

            <ul className="grid sm:grid-cols-2 gap-2 text-xs text-[#3C3530] leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-[#A55D25] font-bold shrink-0">•</span>
                <span><strong>Cannot diagnose</strong> any clinical, mental-health, or psychiatric condition.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#A55D25] font-bold shrink-0">•</span>
                <span><strong>Cannot determine</strong> someone's actual objective physical safety.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#A55D25] font-bold shrink-0">•</span>
                <span><strong>Cannot understand</strong> the full lived context or cultural nuances of a person's life.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#A55D25] font-bold shrink-0">•</span>
                <span><strong>May be wrong</strong> or skewed by single-day fluctuations.</span>
              </li>
            </ul>

            <div className="pt-2 border-t border-[#A55D25]/20 flex items-center justify-between text-[11px] text-[#7A726C]">
              <span className="flex items-center font-medium">
                <UserCheck size={14} className="mr-1.5 text-[#5A5049]" />
                A trained human counselor must review all elevated signals before taking action.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
