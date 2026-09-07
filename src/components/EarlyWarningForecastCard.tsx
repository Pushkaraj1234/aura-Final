import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Info
} from "lucide-react";
import { EarlyWarningForecast, TrajectoryAnalysis } from "../types";

interface Props {
  forecast?: EarlyWarningForecast | null;
  trajectory?: TrajectoryAnalysis | null;
  participantId?: string;
}

export const EarlyWarningForecastCard: React.FC<Props> = ({
  forecast,
  trajectory,
  participantId
}) => {
  const currentScore = forecast?.currentScore ?? trajectory?.currentScore ?? 35;
  const movingAvg3 = trajectory?.movingAvg3 ?? currentScore;
  const projectedMin = forecast?.projectedMin ?? Math.max(0, currentScore - 5);
  const projectedMax = forecast?.projectedMax ?? Math.min(100, currentScore + 10);
  const confidenceBand = forecast?.confidenceBand ?? "Moderate (70%)";
  const trajectoryCategory = trajectory?.category ?? "Stable Trajectory";
  const rateOfChange = trajectory?.rateOfChange ?? 0;
  const recommendedAction = forecast?.recommendedAction ?? "Maintain routine supportive check-ins and monitor changes.";

  const isRising = forecast?.trajectory === "Increasing" || rateOfChange > 5;
  const isFalling = forecast?.trajectory === "Decreasing" || rateOfChange < -5;

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFE8E2] pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-[#5A5049] text-[#DBC3B2] flex items-center justify-center shadow-xs">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
                Predictive Early-Warning Simulation
              </span>
              {participantId && (
                <span className="font-mono text-[10px] font-bold text-[#B9B0A6]">
                  {/^[0-9a-f-]{20,}$/i.test(participantId) ? `ref ${participantId.slice(0, 8)}` : participantId}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
              Trajectory Forecast & Early Signal
            </h3>
          </div>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs font-bold text-[#7A726C]">
          <Sparkles size={14} className="text-[#5A5049]" />
          <span>Synthetic Trend Model</span>
        </div>
      </div>

      {/* 4 Stat Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Indicator */}
        <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Current Indicator
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#3C3530]">
              {currentScore}
            </span>
            <span className="text-xs text-[#7F8C8D] font-bold">/ 100</span>
          </div>
          <span className="text-[11px] text-[#7A726C] mt-1 block">
            3-check-in avg: <strong>{movingAvg3}</strong>
          </span>
        </div>

        {/* Projected Range */}
        <div className={`p-4 rounded-2xl border ${
          isRising
            ? "bg-[#A55D25]/10 border-[#A55D25]/30"
            : isFalling
            ? "bg-[#DBC3B2]/20 border-[#DBC3B2]/40"
            : "bg-[#FDF9F5] border-[#EFE8E2]"
        }`}>
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Projected Next Range
          </span>
          <div className="flex items-baseline space-x-2">
            <span className={`text-3xl font-black ${
              isRising ? "text-[#A55D25]" : isFalling ? "text-[#5A5049]" : "text-[#3C3530]"
            }`}>
              {projectedMin}–{projectedMax}
            </span>
            <span className="text-xs text-[#7F8C8D] font-bold">pts</span>
          </div>
          <span className="text-[11px] text-[#7A726C] mt-1 block">
            Confidence: <strong>{confidenceBand}</strong>
          </span>
        </div>

        {/* Trajectory Category */}
        <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Trajectory
          </span>
          <div className="flex items-center space-x-1.5 mt-1">
            {isRising ? (
              <ArrowUpRight size={20} className="text-[#A55D25]" />
            ) : isFalling ? (
              <ArrowDownRight size={20} className="text-[#5A5049]" />
            ) : (
              <Activity size={18} className="text-[#7F8C8D]" />
            )}
            <span className="text-lg font-black text-[#3C3530]">
              {trajectoryCategory}
            </span>
          </div>
          <span className="text-[11px] text-[#7A726C] mt-1 block">
            Rate: <strong>{rateOfChange >= 0 ? `+${rateOfChange}` : rateOfChange} pts/step</strong>
          </span>
        </div>

        {/* Recommended Action */}
        <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[11px] font-bold text-[#7F8C8D] uppercase tracking-wider block mb-1">
            Signal Recommendation
          </span>
          <p className="text-xs font-bold text-[#3C3530] leading-snug line-clamp-2 mt-1">
            {recommendedAction}
          </p>
          <span className="text-[10px] text-[#5A5049] font-semibold mt-1 block">
            Human review enabled
          </span>
        </div>
      </div>

      {/* Visual Forecast Chart with Dashed Confidence Range */}
      <div className="p-5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D] flex items-center">
            <Activity size={14} className="mr-1.5 text-[#5A5049]" />
            Trajectory Progression & 72h Projection
          </h4>
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <span className="flex items-center text-[#3C3530]">
              <span className="w-3 h-0.5 bg-[#5A5049] inline-block mr-1.5"></span>
              Historical
            </span>
            <span className="flex items-center text-[#A55D25]">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-[#A55D25] inline-block mr-1.5"></span>
              Projected Range
            </span>
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="h-44 w-full relative pt-4 pb-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="20" x2="500" y2="20" stroke="#EFE8E2" strokeWidth="1" />
            <line x1="0" y1="60" x2="500" y2="60" stroke="#EFE8E2" strokeWidth="1" />
            <line x1="0" y1="100" x2="500" y2="100" stroke="#EFE8E2" strokeWidth="1" />

            {/* Threshold line at 70 pts */}
            <line x1="0" y1="36" x2="500" y2="36" stroke="#A55D25" strokeDasharray="3,3" strokeWidth="1" opacity="0.5" />

            {/* Render historical line */}
            {(() => {
              const pts = forecast?.historicalSeries || [
                { dayLabel: "Baseline", score: currentScore, isProjected: false },
                { dayLabel: "+24h Projected", score: Math.round((projectedMin + projectedMax) / 2), isProjected: true, min: projectedMin, max: projectedMax }
              ];
              const len = pts.length;
              if (len === 0) return null;

              const step = 460 / Math.max(1, len - 1);
              const getX = (i: number) => 20 + i * step;
              const getY = (score: number) => 110 - (score / 100) * 95;

              // Split into historical and projected
              const histPts = pts.filter(p => !p.isProjected);
              const projPt = pts.find(p => p.isProjected);
              const lastHistIndex = Math.max(0, histPts.length - 1);

              const histPath = histPts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(p.score)}`).join(" ");

              return (
                <>
                  {/* Projected Confidence Band Polygon */}
                  {projPt && projPt.min !== undefined && projPt.max !== undefined && histPts.length > 0 && (
                    <polygon
                      points={`
                        ${getX(lastHistIndex)},${getY(histPts[lastHistIndex].score)} 
                        ${getX(len - 1)},${getY(projPt.max)} 
                        ${getX(len - 1)},${getY(projPt.min)}
                      `}
                      fill="#A55D25"
                      fillOpacity="0.15"
                    />
                  )}

                  {/* Historical Solid Line */}
                  {histPts.length > 0 && (
                    <path d={histPath} fill="none" stroke="#5A5049" strokeWidth="3" strokeLinecap="round" />
                  )}

                  {/* Projected Dashed Line */}
                  {projPt && histPts.length > 0 && (
                    <line
                      x1={getX(lastHistIndex)}
                      y1={getY(histPts[lastHistIndex].score)}
                      x2={getX(len - 1)}
                      y2={getY(projPt.score)}
                      stroke={isRising ? "#A55D25" : "#5A5049"}
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                    />
                  )}

                  {/* Points */}
                  {pts.map((p, idx) => {
                    const cx = getX(idx);
                    const cy = getY(p.score);
                    return (
                      <g key={idx}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={p.isProjected ? 6 : 5}
                          fill={p.isProjected ? (isRising ? "#A55D25" : "#5A5049") : "#3C3530"}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-[#3C3530]"
                        >
                          {p.score}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#7F8C8D] pt-1">
          <span>Past Check-ins (Chronological)</span>
          <span className="font-bold text-[#3C3530]">Next 24–72h Forecast Range</span>
        </div>
      </div>

      {/* Heuristic Disclaimer Box */}
      <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start space-x-3 text-xs text-[#7A726C]">
        <Info size={16} className="text-[#5A5049] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Demonstration Note:</strong> This prototype estimates possible future changes from synthetic historical trends. It is not a clinically validated prediction model. All signals serve solely as prioritized decision-support for human humanitarian workers.
        </p>
      </div>
    </div>
  );
};
