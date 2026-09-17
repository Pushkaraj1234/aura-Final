import React, { useMemo } from "react";
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
import { Participant } from "../types";
import {
  computeCommunityAggregates,
  computeCommonSignals,
  computeCohortTrend,
  computeDailyTrend,
  MIN_GROUP_SIZE,
} from "../services/communityAggregates";
import { computeOverrideStats } from "../services/overrideStats";
import { Alert } from "../types";

interface Props {
  onOpenEmergency: () => void;
  /**
   * The real participant records. This page used to render a MOCK_REGIONS
   * constant -- four hardcoded rows, a fabricated counsellor recommendation
   * and invented advice -- beneath the headings "Anonymous Macro Analytics"
   * and "Privacy-Preserving Aggregations". Everything below now comes from
   * these, or is withheld and says so.
   */
  participants: Participant[];
  /**
   * Alerts, for the model-agreement panel. That panel used to assert a 4.2%
   * override rate, a 78/22 split and a self-recalibrating threshold config,
   * none of which were measured and the last of which does not exist.
   */
  alerts?: Alert[];
}

export const CommunityInsights: React.FC<Props> = ({ participants, alerts = [] }) => {
  const aggregates = useMemo(() => computeCommunityAggregates(participants), [participants]);
  const common = useMemo(() => computeCommonSignals(participants), [participants]);
  const cohort = useMemo(() => computeCohortTrend(participants), [participants]);
  const overrides = useMemo(() => computeOverrideStats(alerts), [alerts]);
  const trend = useMemo(() => computeDailyTrend(participants), [participants]);

  /**
   * The trend chart's geometry, in the viewBox the card already used.
   *
   * Split into runs rather than one path, because a day without enough
   * check-ins is an absence of data and a line drawn through it would assert a
   * value nobody reported. The y-axis is fixed to the full 0-100 scale rather
   * than scaled to the data: an axis that rescales itself makes a two-point
   * wobble look like a collapse, which on this page is the exact
   * misreading that matters.
   */
  const { trendRuns, trendNodes } = useMemo(() => {
    const points = trend.points;
    if (points.length === 0) return { trendRuns: [], trendNodes: [] };

    const xFor = (i: number) =>
      points.length === 1 ? 225 : 10 + (i / (points.length - 1)) * 430;
    // 100 (worst) at the top of the plot, 0 at the bottom.
    const yFor = (mean: number) => 110 - (Math.max(0, Math.min(100, mean)) / 100) * 100;

    const runs: { line: string; area: string }[] = [];
    const nodes: { date: string; x: number; y: number; mean: number }[] = [];
    let current: { x: number; y: number }[] = [];

    const flush = () => {
      if (current.length === 0) return;
      // A lone day still gets a visible mark via its node; a one-point path
      // with strokeLinecap="round" renders as a dot, which is what we want.
      const line = current.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      const first = current[0]!;
      const last = current[current.length - 1]!;
      runs.push({ line, area: `${line} L ${last.x} 120 L ${first.x} 120 Z` });
      current = [];
    };

    points.forEach((point, i) => {
      if (point.mean === null) {
        flush();
        return;
      }
      const x = xFor(i);
      const y = yFor(point.mean);
      current.push({ x, y });
      nodes.push({ date: point.date, x, y, mean: point.mean });
    });
    flush();

    // Label at most five nodes, evenly spaced, or they collide at this width.
    const labelled =
      nodes.length <= 5
        ? nodes
        : nodes.filter((_, i) => i % Math.ceil(nodes.length / 5) === 0 || i === nodes.length - 1);

    return { trendRuns: runs, trendNodes: labelled };
  }, [trend]);
  const regions = aggregates.regions;
  const commonSignals = common.signals;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Anonymous Macro Analytics
            </span>
            <span className="text-xs text-[#68625D] font-mono">
              Privacy-Preserving Aggregations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#3C3530] mt-1 tracking-tight">
            Community Wellbeing & Resource Planning
          </h1>
          <p className="text-sm text-[#6B635C] max-w-3xl mt-1 leading-relaxed">
            Counts across everyone using AURA, so coordinators can see where support is needed without anything here identifying a person. Groups smaller than {MIN_GROUP_SIZE} are withheld rather than shown, and the page says what it withheld.
          </p>
        </div>

        {/* Was "Synthetic Demonstration Aggregates", which stopped being true
            once the figures above it started coming from real records. */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs font-bold text-[#6B635C]">
          <span>Computed from real records, k-anonymised at {MIN_GROUP_SIZE}</span>
        </div>
      </div>

      {/* Hero Overview Grid.
          Every figure here was hardcoded: 128 participants, 46/31/18/5 with
          invented counts in brackets, "across 4 humanitarian zones". A badge
          overhead said "Synthetic Demonstration Aggregates", which labels the
          problem honestly and does not fix it, because the grid still reads at
          a glance as a report on real people. These are computed now, and
          withheld when there are too few people to compute them over. */}
      {cohort.suppressed ? (
        <div className="p-6 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs flex items-start gap-3">
          <Info size={18} className="shrink-0 mt-0.5 text-[#A55D25]" aria-hidden="true" />
          <div>
            <h2 className="font-black text-[#3C3530]">Not enough check-ins to report a trend</h2>
            <p className="text-sm text-[#6B635C] mt-1 leading-relaxed">
              {cohort.basis === 0
                ? "Nobody has completed a check-in yet."
                : `${cohort.basis} of ${cohort.totalParticipants} participants have checked in, which is below the floor of ${MIN_GROUP_SIZE}.`}{" "}
              A breakdown over this few people describes those people rather than a community.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-3xl bg-[#3C3530] text-white col-span-2 sm:col-span-1 shadow-xs">
            <span className="text-[11px] font-bold text-[#DBC3B2] uppercase tracking-wider block mb-1">
              Participants with check-ins
            </span>
            <span className="text-4xl font-black text-white">{cohort.basis}</span>
            <span className="text-[11px] text-[#EFE8E2]/70 mt-2 block">
              of {cohort.totalParticipants} enrolled
              {cohort.regionsReported > 0 && `, across ${cohort.regionsReported} ${cohort.regionsReported === 1 ? "district" : "districts"}`}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
            <span className="text-[11px] font-bold text-[#68625D] uppercase tracking-wider block mb-1">
              Improving
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-emerald-600">{cohort.improving}</span>
              <span className="text-xs text-[#68625D]">
                ({Math.round((cohort.improving / cohort.basis) * 100)}%)
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
              Lower than their last check-in
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
            <span className="text-[11px] font-bold text-[#68625D] uppercase tracking-wider block mb-1">
              Steady
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-[#3C3530]">{cohort.stable}</span>
              <span className="text-xs text-[#68625D]">
                ({Math.round((cohort.stable / cohort.basis) * 100)}%)
              </span>
            </div>
            <span className="text-[11px] text-[#6B635C] mt-1 block">
              Little movement either way
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs">
            <span className="text-[11px] font-bold text-[#68625D] uppercase tracking-wider block mb-1">
              Rising
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-[#A55D25]">{cohort.increasing}</span>
              <span className="text-xs text-[#68625D]">
                ({Math.round((cohort.increasing / cohort.basis) * 100)}%)
              </span>
            </div>
            <span className="text-[11px] text-[#A55D25] font-semibold mt-1 block">
              Higher than their last check-in
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-[#EFE8E2] shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-[#68625D] uppercase tracking-wider block mb-1">
              Safety concern
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-[#A55D25]">{cohort.urgent}</span>
            </div>
            <span className="text-[11px] text-[#A55D25] font-semibold mt-1 block">
              Reported on their latest check-in
            </span>
          </div>
        </div>
      )}

      {cohort.tooEarly > 0 && !cohort.suppressed && (
        <p className="text-xs text-[#6B635C]">
          {cohort.tooEarly} {cohort.tooEarly === 1 ? "person has" : "people have"} checked in only
          once, so there is no direction to report for them yet. They are counted in the total and
          in none of the three directions.
        </p>
      )}

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
                <p className="text-xs text-[#68625D]">
                  {common.suppressed
                    ? "Withheld until the cohort is larger"
                    : `Counted once per person, on their most recent check-in (${common.basis} ${common.basis === 1 ? "person" : "people"})`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {common.suppressed && (
              <p className="text-xs text-[#68625D] leading-relaxed">
                Fewer than {MIN_GROUP_SIZE} people have completed a check-in, so a breakdown here
                would describe them individually rather than a group.
              </p>
            )}
            {commonSignals.map((sig, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#3C3530]">{sig.name}</span>
                  <span className="font-mono text-[#6B635C] font-bold">
                    {sig.percent}% ({sig.count} of {common.basis})
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

          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#6B635C] flex items-start space-x-2">
            <Info size={15} className="text-[#5A5049] shrink-0 mt-0.5" />
            {/* Was: "Stress and sleep disruption represent 78% of compound
                signal triggers. Early environmental intervention (such as
                quiet zones) significantly lowers escalation risk." The 78%
                was not measured, and the second sentence was a causal claim
                about an intervention AURA has never run or evaluated. */}
            <p className="leading-relaxed">
              These are counts of what people reported on their most recent check-in, out of{" "}
              {common.basis} {common.basis === 1 ? "person" : "people"} who have checked in. They
              say what is being reported, not what is causing it, and nothing here has been tested
              against an intervention.
            </p>
          </div>
        </div>

        {/* 14-day community trend.
            Was a hand-drawn SVG path: a fixed `d` attribute with five labelled
            nodes reading 52, 58, 54, 44, 38, captioned "across all 128
            synthetic participants". It drew a recovery that never happened to
            anybody. The same chart shape now plots real daily means, and days
            with too few check-ins are gaps rather than invented points. */}
        <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#3C3530] text-[#DBC3B2] flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3C3530]">
                  {trend.windowDays}-day community distress curve
                </h3>
                <p className="text-xs text-[#68625D]">
                  {trend.suppressed
                    ? "Not enough check-ins on any day to plot"
                    : `Mean score per day, on the ${trend.reportedDays} ${trend.reportedDays === 1 ? "day" : "days"} with at least ${MIN_GROUP_SIZE} check-ins`}
                </p>
              </div>
            </div>
          </div>

          {trend.suppressed ? (
            <div className="h-44 flex items-center justify-center text-center px-6">
              <p className="text-sm text-[#6B635C] leading-relaxed">
                No single day in the last {trend.windowDays} has {MIN_GROUP_SIZE} or more check-ins.
                A daily average over fewer than that describes the people who happened to check in,
                so nothing is plotted.
              </p>
            </div>
          ) : (
            <div className="h-44 w-full relative pt-2 pb-2">
              <svg className="w-full h-full" viewBox="0 0 450 120" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="450" y2="20" stroke="#EFE8E2" strokeWidth="1" />
                <line x1="0" y1="60" x2="450" y2="60" stroke="#EFE8E2" strokeWidth="1" />
                <line x1="0" y1="100" x2="450" y2="100" stroke="#EFE8E2" strokeWidth="1" />

                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DBC3B2" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#DBC3B2" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* One path per unbroken run of reportable days. A gap is a
                    real absence of data and is not drawn across. */}
                {trendRuns.map((run, i) => (
                  <path
                    key={`line-${i}`}
                    d={run.line}
                    fill="none"
                    stroke="#5A5049"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                ))}
                {trendRuns.map((run, i) => (
                  <path key={`area-${i}`} d={run.area} fill="url(#commGrad)" />
                ))}

                {trendNodes.map((pt) => (
                  <g key={pt.date}>
                    <circle cx={pt.x} cy={pt.y} r={4.5} fill="#3C3530" stroke="#ffffff" strokeWidth="2" />
                    <text
                      x={pt.x}
                      y={pt.y - 8}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-[#3C3530]"
                    >
                      {Math.round(pt.mean)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}

          {trend.suppressedDays > 0 && (
            <p className="text-xs text-[#6B635C]">
              {trend.suppressedDays} {trend.suppressedDays === 1 ? "day is" : "days are"} missing
              from the line: there were check-ins, but fewer than {MIN_GROUP_SIZE}, so they are
              withheld rather than plotted.
            </p>
          )}
        </div>
      </div>

      {/* Model agreement.
          This panel used to assert a 4.2% override rate "down from 5.3% last
          month", a 78/22 split between false positives and false negatives,
          and that alertConfig.ts "has been naturally recalibrating based on
          these override logs". Nothing was measured, and the last claim
          described a mechanism AURA does not have: those thresholds move when
          an administrator edits them in the settings panel, and nowhere else.
          What follows is computed from decisions humans actually recorded, and
          withheld when there are too few of them. */}
      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#EFE8E2] pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#5A5049]/15 text-[#5A5049] flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5A5049]/10 text-[#5A5049]">
                Human Review
              </span>
              <h3 className="text-xl font-black text-[#3C3530] mt-0.5">
                How often a person disagreed
              </h3>
            </div>
          </div>
        </div>

        {overrides.suppressed ? (
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
            <Info size={17} className="shrink-0 mt-0.5 text-[#A55D25]" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-[#3C3530]">Not enough decisions to report a rate</p>
              <p className="text-xs text-[#5A5049] leading-relaxed">
                {overrides.raised} {overrides.raised === 1 ? "alert has" : "alerts have"} been
                raised and {overrides.decided} {overrides.decided === 1 ? "has" : "have"} a
                recorded decision. A rate needs at least {MIN_GROUP_SIZE} before it says anything
                about the model rather than about a handful of afternoons.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
              <h4 className="text-xs font-bold text-[#68625D] uppercase tracking-wider">
                Alerts stood down
              </h4>
              <div className="flex items-end space-x-3">
                <span className="text-4xl font-serif font-bold text-[#3C3530]">
                  {overrides.overrideRate}%
                </span>
              </div>
              <p className="text-xs text-[#5A5049] leading-relaxed">
                Of {overrides.agreed + overrides.stoodDown} alerts a person decided on,{" "}
                {overrides.stoodDown} were resolved or returned to routine monitoring rather than
                acted on.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-3">
              <h4 className="text-xs font-bold text-[#68625D] uppercase tracking-wider">
                What was decided
              </h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#3C3530]">Acted on</span>
                    <span className="text-[#5A5049]">{overrides.agreed}</span>
                  </div>
                  <div className="w-full bg-[#EFE8E2] rounded-full h-1.5">
                    <div
                      className="bg-[#5A5049] h-1.5 rounded-full"
                      style={{ width: `${(overrides.agreed / (overrides.agreed + overrides.stoodDown)) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#3C3530]">Stood down</span>
                    <span className="text-[#A55D25]">{overrides.stoodDown}</span>
                  </div>
                  <div className="w-full bg-[#EFE8E2] rounded-full h-1.5">
                    <div
                      className="bg-[#A55D25] h-1.5 rounded-full"
                      style={{ width: `${(overrides.stoodDown / (overrides.agreed + overrides.stoodDown)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[#6B635C] leading-relaxed">
                {overrides.raised - overrides.decided} of {overrides.raised} raised alerts have no
                recorded decision and are counted in neither bar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F1EBE5] border border-[#E0D7CE] space-y-3">
              <h4 className="text-xs font-bold text-[#5A5049] uppercase tracking-wider">
                How to read this
              </h4>
              <p className="text-xs text-[#3C3530] leading-relaxed">
                A low stand-down rate is not evidence the model is trusted. It reads the same
                whether counsellors agree with the alerts or nobody is examining them closely, and
                this page cannot tell those apart.
              </p>
              <p className="text-xs text-[#3C3530] leading-relaxed">
                Nothing adjusts itself from these numbers. The alert thresholds change when an
                administrator edits them, and at no other time.
              </p>
            </div>
          </div>
        )}
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

          <div className="text-xs text-[#68625D] italic">
            Broad areas only. No exact location is stored or shown.
          </div>
        </div>

        {/* Regional Cards Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {regions.map((reg) => {
            // "Needs attention" is a count of people, not a judgement about a
            // district, and there is deliberately no recommended-staffing
            // figure: the old card printed one, and nothing in this data
            // supports telling a coordinator how many counsellors to send.
            const needsAttention = reg.elevated > 0;
            return (
              <div
                key={reg.region}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  needsAttention
                    ? "bg-[#A55D25]/5 border-[#A55D25]/30 shadow-xs"
                    : "bg-[#FDF9F5] border-[#EFE8E2]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-black text-[#68625D]">
                      {reg.checkIns} check-ins
                    </span>
                    <h4 className="text-base font-black text-[#3C3530] mt-0.5">
                      {reg.region}
                    </h4>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1 ${
                    needsAttention ? "bg-[#A55D25] text-white" : "bg-[#5A5049] text-white"
                  }`}>
                    {needsAttention
                      ? <TrendingUp size={12} className="mr-1" />
                      : <TrendingDown size={12} className="mr-1" />}
                    <span>{needsAttention ? "someone is high" : "none high"}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#68625D] uppercase block">Participants</span>
                    <span className="font-black text-sm text-[#3C3530]">{reg.participants}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#68625D] uppercase block">Mean score</span>
                    <span className="font-black text-sm text-[#3C3530]">
                      {reg.meanScore === null ? "no data" : reg.meanScore}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#EFE8E2]">
                    <span className="text-[10px] text-[#68625D] uppercase block">Gone quiet</span>
                    <span className={`font-black text-sm ${reg.quiet > 0 ? "text-[#A55D25]" : "text-[#5A5049]"}`}>
                      {reg.quiet}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#EFE8E2] text-xs text-[#3C3530] flex items-start space-x-2">
                  <AlertTriangle size={15} className={`shrink-0 mt-0.5 ${needsAttention ? "text-[#A55D25]" : "text-[#5A5049]"}`} />
                  <p className="leading-relaxed">
                    {reg.elevated} of {reg.participants} scored 60 or above on their most recent
                    check-in. {reg.quiet} have not checked in for two weeks.
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What is not on this page, and why. A dashboard that silently drops
            five of eight regions reads as a complete picture of three. */}
        {(aggregates.suppressedRegions > 0 || aggregates.unassigned > 0 || regions.length === 0) && (
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs text-[#5A5049] leading-relaxed">
            {regions.length === 0 ? (
              <>
                <strong>Nothing to show yet.</strong> No area has {MIN_GROUP_SIZE} or more
                participants, so publishing any of it would describe individuals rather than a
                population.
              </>
            ) : (
              <>
                <strong>Showing {regions.length} of {regions.length + aggregates.suppressedRegions} areas.</strong>{" "}
                {aggregates.suppressedRegions} withheld, covering {aggregates.suppressedParticipants}{" "}
                {aggregates.suppressedParticipants === 1 ? "person" : "people"}, because an area with
                fewer than {MIN_GROUP_SIZE} participants cannot be summarised without describing
                them.
              </>
            )}
            {aggregates.unassigned > 0 && (
              <> {aggregates.unassigned} {aggregates.unassigned === 1 ? "participant has" : "participants have"} no
              area recorded and {aggregates.unassigned === 1 ? "is" : "are"} counted nowhere above.</>
            )}
          </div>
        )}

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
