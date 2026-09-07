import React, { useState } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
import { apiService } from "../services/apiService";

interface Props {
  participantId: string;
}

export const AICaseSummaryCard: React.FC<Props> = ({ participantId }) => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAi(true);
    setError(null);
    try {
      const response = await apiService.ai.summarizeCase(participantId);
      setAiSummary(response.summary);
    } catch (e: any) {
      console.error("AI Summary generation failed", e);
      setError("Failed to generate AI summary. Error: " + (e.message || "Unknown"));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-indigo-100 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="text-indigo-600" size={20} />
          <h3 className="text-sm font-bold text-indigo-900">AI Case Summary (Gemini)</h3>
        </div>
        <button
          onClick={handleGenerateAiSummary}
          disabled={isGeneratingAi}
          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 flex items-center space-x-1.5"
        >
          {isGeneratingAi && <Loader2 size={13} className="animate-spin" />}
          <span>{aiSummary ? "Regenerate" : "Generate Summary"}</span>
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg">
          {error}
        </div>
      )}

      {aiSummary ? (
        <div className="prose prose-sm prose-indigo max-w-none bg-indigo-50/30 p-3.5 rounded-2xl border border-indigo-50 whitespace-pre-wrap text-xs text-indigo-900/80 leading-relaxed">
          {aiSummary}
        </div>
      ) : (
        <div className="text-center py-6 text-indigo-300/80 bg-[#FDF9F5] rounded-2xl border border-dashed border-[#EFE8E2]">
          <BrainCircuit size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-[11px] font-medium max-w-[200px] mx-auto">Generate a privacy-safe, non-diagnostic case summary.</p>
        </div>
      )}
    </div>
  );
};
