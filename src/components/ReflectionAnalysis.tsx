import React from "react";
import { ReflectionAnalysisResult, GeminiAnalysisResult, VoiceToneAnalysisResult } from "../types";
import { Cpu, AlertTriangle, CheckCircle2, Info, MessageSquare, BrainCircuit, Volume2, Scale } from "lucide-react";

interface ReflectionAnalysisProps {
  analysis: ReflectionAnalysisResult;
  aiAnalysis?: GeminiAnalysisResult;
  voiceToneAnalysis?: VoiceToneAnalysisResult;
  isDemoSample?: boolean;
}

const TAXONOMY_LABELS: Record<string, string> = {
  physical_violence: "Physical violence",
  sexual_violence: "Sexual violence",
  death_or_loss: "Death or loss",
  forced_displacement: "Forced displacement",
  torture: "Torture",
  witnessing_atrocity: "Witnessing atrocity",
  psychological_abuse: "Psychological abuse",
  intrusive_memories: "Intrusive memories",
  hypervigilance: "Hypervigilance",
  emotional_numbing: "Emotional numbing",
  dissociation: "Dissociation",
  hopelessness: "Hopelessness",
  sleep_disturbance: "Sleep disturbance",
  survivor_guilt: "Survivor guilt",
  social_withdrawal: "Social withdrawal",
  none_detected: "None detected",
};

const riskBandStyle = (band?: string) => {
  switch (band) {
    case "high":
      return "bg-rose-100 text-rose-800 border-rose-300";
    case "elevated":
      return "bg-[#A55D25]/15 text-[#A55D25] border-[#A55D25]/30";
    case "moderate":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
};

export const ReflectionAnalysis: React.FC<ReflectionAnalysisProps> = ({
  analysis,
  aiAnalysis,
  voiceToneAnalysis,
  isDemoSample = false
}) => {
  const hasLanguageSignal = analysis.sentiment !== "none" && analysis.languageSignal && analysis.languageSignal !== "None";
  if (!hasLanguageSignal && !aiAnalysis && !voiceToneAnalysis) {
    return null;
  }

  // Visual styling based on sentiment category
  const getBadgeStyle = () => {
    switch (analysis.sentiment) {
      case "positive":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "overwhelmed":
      case "stressed":
        return "bg-[#A55D25]/15 text-[#A55D25] border-[#A55D25]/30";
      case "mixed":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "safety_concern":
        return "bg-rose-50 text-rose-800 border-rose-200 animate-pulse";
      case "neutral":
      default:
        return "bg-[#DBC3B2]/20 text-[#5A5049] border-[#DBC3B2]/40";
    }
  };

  const getBadgeIcon = () => {
    switch (analysis.sentiment) {
      case "positive":
        return <CheckCircle2 size={13} className="mr-1.5 text-emerald-600" />;
      case "overwhelmed":
      case "stressed":
      case "safety_concern":
        return <AlertTriangle size={13} className="mr-1.5 text-[#A55D25]" />;
      case "mixed":
        return <Scale size={13} className="mr-1.5 text-amber-600" />;
      case "neutral":
      default:
        return <MessageSquare size={13} className="mr-1.5 text-[#5A5049]" />;
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EFE8E2] shadow-xs space-y-3.5">
      {/* Title Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Cpu size={15} className="text-[#5A5049]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-[#3C3530]">
            {isDemoSample || analysis.isDemoSample
              ? "Simulated Language Signal Analysis (Demo)"
              : "Language-Based Reflection Signal"}
          </h4>
        </div>
        <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider">
          Assistive NLP Processing
        </span>
      </div>

      {/* Signal Banner */}
      {hasLanguageSignal && (
        <div className={`p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${getBadgeStyle()}`}>
          <div className="flex items-center font-bold text-xs">
            {getBadgeIcon()}
            <span>Signal: {analysis.languageSignal}</span>
          </div>
          <span className="text-[10px] font-semibold opacity-90">
            {analysis.sentiment === "positive" && "Positive Outlook Signal"}
            {analysis.sentiment === "stressed" && "Stress Language Identified"}
            {analysis.sentiment === "overwhelmed" && "Elevated Strain Phrasing"}
            {analysis.sentiment === "mixed" && "Multifaceted Narrative"}
            {analysis.sentiment === "neutral" && "Baseline Routine Activity"}
            {analysis.sentiment === "safety_concern" && "Safety Protocol Signal"}
          </span>
        </div>
      )}

      {/* Contributing Patterns */}
      {hasLanguageSignal && analysis.contributingPatterns && analysis.contributingPatterns.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7F8C8D] block">
            Contributing Language Patterns:
          </span>
          <ul className="space-y-1">
            {analysis.contributingPatterns.map((pattern, idx) => (
              <li key={idx} className="text-xs text-[#7A726C] flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5A5049] mt-1.5 shrink-0" />
                <span className="capitalize">{pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plain Language Explanation */}
      {hasLanguageSignal && (
        <div className="p-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#7A726C] space-y-1">
          <span className="font-bold text-[#3C3530] block text-[11px]">Why this signal?</span>
          <p data-no-translate className="leading-relaxed">{analysis.explanation}</p>
        </div>
      )}

      {/* Gemini trauma-informed screening (text content) */}
      {aiAnalysis && (
        <div className="mt-4 p-4 rounded-xl bg-[#FDF9F5]/50 border border-[#EFE8E2] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-[#7A4A20]">
              <BrainCircuit size={15} />
              <span className="text-xs font-bold uppercase tracking-wider">Gemini Trauma-Informed Screening</span>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${riskBandStyle(aiAnalysis.riskBand)}`}>
              {aiAnalysis.riskBand} risk band
            </span>
          </div>

          {aiAnalysis.traumaIndicators?.filter((t) => t !== "none_detected").length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#5A5049]/90">Trauma indicators noted:</span>
              <div className="flex flex-wrap gap-1.5">
                {aiAnalysis.traumaIndicators.filter((t) => t !== "none_detected").map((t) => (
                  <span key={t} className="text-[10px] font-semibold bg-[#F3E7D8] text-[#3C3530] px-2 py-0.5 rounded-full">
                    {TAXONOMY_LABELS[t] || t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis.distressSignals?.filter((d) => d !== "none_detected").length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#5A5049]/90">Distress signals noted:</span>
              <div className="flex flex-wrap gap-1.5">
                {aiAnalysis.distressSignals.filter((d) => d !== "none_detected").map((d) => (
                  <span key={d} className="text-[10px] font-semibold bg-[#F3E7D8] text-[#3C3530] px-2 py-0.5 rounded-full">
                    {TAXONOMY_LABELS[d] || d}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 text-xs text-[#5A5049] border-t border-[#EFE8E2]/50 space-y-1">
            <div><strong>Language:</strong> {aiAnalysis.language} &nbsp;·&nbsp; <strong>Emotional state:</strong> {aiAnalysis.emotionalState} &nbsp;·&nbsp; <strong>Confidence:</strong> {aiAnalysis.confidence}</div>
            <div className="italic text-[11px]">"{aiAnalysis.rationale || aiAnalysis.evidence}"</div>
            <div className="pt-1"><strong>Suggested human action:</strong> {aiAnalysis.suggestedHumanAction}</div>
          </div>
        </div>
      )}

      {/* Voice-tone reasoning: transcript + measured vocal delivery */}
      {voiceToneAnalysis && (
        <div className="mt-4 p-4 rounded-xl bg-[#FDF9F5]/60 border border-[#EFE8E2] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-[#7A4A20]">
              <Volume2 size={15} />
              <span className="text-xs font-bold uppercase tracking-wider">Voice Tone: Delivery + Content</span>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${riskBandStyle(voiceToneAnalysis.riskBand)}`}>
              {voiceToneAnalysis.riskBand} risk band
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-black text-[#3C3530]">{voiceToneAnalysis.emotionalTone}</span>
            <span className="text-[10px] text-[#8A5A2B]">({voiceToneAnalysis.toneConfidence} confidence)</span>
            {voiceToneAnalysis.contentVsDeliveryAlignment === "mismatched" && (
              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                Words vs. tone mismatch
              </span>
            )}
          </div>

          <p className="text-xs text-[#5A5049] leading-relaxed">{voiceToneAnalysis.toneRationale}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-[#5A5049]/90 pt-1 border-t border-[#EFE8E2]/60">
            <div><strong>Pitch variability:</strong> {(voiceToneAnalysis.acousticFeatures.pitchVariabilityScore * 100).toFixed(0)}%</div>
            <div><strong>Pace:</strong> {Math.round(voiceToneAnalysis.acousticFeatures.speakingRateWpm)} wpm</div>
            <div><strong>Pauses:</strong> {(voiceToneAnalysis.acousticFeatures.pauseRatio * 100).toFixed(0)}%</div>
            <div><strong>Vocal energy:</strong> {(voiceToneAnalysis.acousticFeatures.energyScore * 100).toFixed(0)}%</div>
          </div>

          <div className="pt-1 text-[11px] text-[#5A5049]">
            <strong>Suggested human action:</strong> {voiceToneAnalysis.suggestedHumanAction}
          </div>
        </div>
      )}

      {/* Non-Diagnostic Disclaimer */}
      <div className="flex items-start space-x-2 text-[10px] text-[#7F8C8D] pt-1">
        <Info size={13} className="text-[#DBC3B2] shrink-0 mt-0.5" />
        <p>
          <strong>Non-Diagnostic Notice:</strong> These signals are screening aids derived from your voluntary reflection
          {voiceToneAnalysis ? ", including measured pitch, pace, pauses and loudness, reasoned about together with your words by an LLM" : ""}.
          They do not diagnose mental health conditions and do not replace clinical judgment; a human reviewer always makes the final call.
        </p>
      </div>
    </div>
  );
};
