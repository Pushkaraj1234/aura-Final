import React, { useEffect, useState } from "react";
import { apiService } from "../services/apiService";
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, Info, Database, Layers, Target, Clock } from "lucide-react";

interface Props {
  participantId: string;
}

export const PredictiveMLCard: React.FC<Props> = ({ participantId }) => {
  const [data, setData] = useState<{ prediction: any; metadata: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEval, setShowEval] = useState(false);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const result = await apiService.ml.getPrediction(participantId);
        setData(result);
      } catch (e: any) {
        setError("Failed to load predictive model: " + (e.message || "Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrediction();
  }, [participantId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded mb-4"></div>
        <div className="h-32 w-full bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs text-rose-600 text-sm">
        {error || "No prediction data available."}
      </div>
    );
  }

  const { prediction, metadata } = data;

  const getRiskColor = (cat: string) => {
    switch (cat) {
      case "Low": return "text-emerald-600 bg-emerald-50";
      case "Moderate": return "text-amber-600 bg-amber-50";
      case "High": return "text-rose-600 bg-rose-50";
      case "Critical": return "text-purple-600 bg-purple-50";
      default: return "text-slate-600 bg-slate-50";
    }
  };

  const riskColor = getRiskColor(prediction.riskCategory);
  const probPercent = Math.round(prediction.probability * 100);

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <Activity className="text-violet-600" size={20} />
          <h3 className="font-bold text-[#3C3530]">Predictive ML Horizon</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#68625D] bg-[#FDF9F5] px-2 py-1 rounded-md border border-[#EFE8E2]">
            {metadata.name} {metadata.version}
          </span>
          <button 
            onClick={() => setShowEval(!showEval)}
            className="text-violet-600 hover:text-violet-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-violet-50 transition-colors"
          >
            {showEval ? "Hide Model Details" : "View Model Details"}
          </button>
        </div>
      </div>

      {/* Main Prediction Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl flex flex-col ${riskColor}`}>
          <span className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Risk of Worsening</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black">{probPercent}%</span>
            <span className="text-sm font-semibold">{prediction.riskCategory}</span>
          </div>
          <span className="text-[10px] font-medium opacity-70 mt-1 flex items-center">
            <Clock size={10} className="mr-1" />
            {prediction.predictionHorizon} Horizon
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-[#68625D] mb-1 flex items-center">
            <Database size={12} className="mr-1" /> Data Completeness
          </span>
          <div className="flex items-baseline space-x-2 text-[#3C3530]">
            <span className="text-3xl font-black">{Math.round(prediction.dataCompleteness * 100)}%</span>
          </div>
          <span className="text-[10px] font-medium text-[#68625D] mt-1">
            {prediction.confidence === "Low" ? "Low confidence because insufficient historical observations are available." : `Confidence: ${prediction.confidence}`}
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] flex flex-col">
           <span className="text-xs font-bold uppercase tracking-wider text-[#68625D] mb-1 flex items-center">
            <Target size={12} className="mr-1" /> Primary Contributors
          </span>
          <div className="flex-1 overflow-y-auto space-y-1.5 mt-1">
            {prediction.majorContributingFeatures.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No significant features</span>
            ) : (
              prediction.majorContributingFeatures.map((f: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-[#6B635C] truncate mr-2">{f.name}</span>
                  <span className={`font-semibold ${f.impact === 'Increased' ? 'text-rose-500' : f.impact === 'Decreased' ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {f.impact}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Model Details & Evaluation Expandable */}
      {showEval && (
        <div className="p-4 rounded-xl bg-slate-800 text-slate-200 text-xs space-y-4 mt-2">
          <div className="flex items-start space-x-2 text-violet-300">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Synthetic Tabular ML Layer:</strong> This model estimates the likelihood of worsening distress over the next 7 days using logistic regression. It evaluates the participant's individual baseline (historical variance in sleep, stress, wellbeing) against their current trajectory.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 border-t border-slate-700 pt-3 md:border-t-0 md:pt-0">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Model Evaluation</h4>
              {metadata.evaluation.dataAvailable ? (
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div className="flex justify-between"><span className="text-slate-500">AUROC</span> <span className="font-mono text-emerald-400">{metadata.evaluation.auroc}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Precision</span> <span className="font-mono">{metadata.evaluation.precision}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Recall (Sensitivity)</span> <span className="font-mono text-emerald-400">{metadata.evaluation.recall}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Specificity</span> <span className="font-mono">{metadata.evaluation.specificity}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">F1 Score</span> <span className="font-mono">{metadata.evaluation.f1}</span></div>
                </div>
              ) : (
                <div className="text-slate-500 italic">Insufficient evaluation data.</div>
              )}
            </div>

            <div className="space-y-2 border-t border-slate-700 pt-3 md:border-t-0 md:pt-0">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Metadata & Constraints</h4>
              <ul className="space-y-1 text-slate-400">
                <li><strong className="text-slate-300">Training Data:</strong> {metadata.trainingDataset}</li>
                <li><strong className="text-slate-300">Feature Version:</strong> {metadata.featureVersion}</li>
                <li><strong className="text-slate-300">Limitations:</strong> {metadata.limitations}</li>
                <li><strong className="text-rose-400">Safety Directive:</strong> Model must never independently determine emergency actions. Always paired with deterministic safety rules.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
