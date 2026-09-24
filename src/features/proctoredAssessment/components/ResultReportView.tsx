import React, { useState } from 'react';
import { Camera, Mic, Monitor, Download, Printer, Check, HeartHandshake, RotateCcw, Loader2 } from 'lucide-react';
import { Pcl5ResultSummary, ProctorEvent } from '../types';
import { FUNCTIONAL_IMPACT_DOMAINS } from '../data/assessmentQuestions';
import { exportAssessmentReportToPdf } from '../utils/pdfExport';
import { INTEGRITY_LABELS, formatEventSource, formatEventType } from '../utils/labels';
import { ReportText } from './ReportText';

interface ResultReportViewProps {
  summary: Pcl5ResultSummary;
  indexTraumaLabel: string;
  userReportText: string;
  sessionReportText: string;
  events: ProctorEvent[];
  participantId: string;
  /** ISO date the assessment was completed */
  resultDate: string;
  /** Whether this result is already in history (owned by App so it survives remounts) */
  isSaved?: boolean;
  /** A saved assessment opened from history: read-only, nothing to save */
  isPastRecord?: boolean;
  /** False for older records that were saved without their event log */
  eventsSaved?: boolean;
  onSaveToHistory?: () => void;
  onRestart: () => void;
  onOpenCrisis: () => void;
}

const CLUSTERS = [
  { key: 'B', name: 'Intrusion', description: 'Unwanted memories, dreams, flashbacks' },
  { key: 'C', name: 'Avoidance', description: 'Avoiding thoughts, reminders, or situations' },
  { key: 'D', name: 'Thoughts and mood', description: 'Negative beliefs, blame, feeling cut off' },
  { key: 'E', name: 'Arousal and reactivity', description: 'Being on guard, startle, sleep, focus' },
] as const;

const IMPACT_LABELS = ['None', 'Mild', 'Moderate', 'Severe', 'Extreme'];

const SEVERITY_DOT: Record<ProctorEvent['severity'], string> = {
  GREEN: 'bg-emerald-500',
  YELLOW: 'bg-amber-400',
  ORANGE: 'bg-amber-500',
  RED: 'bg-rose-500',
};

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 py-1">
    <dt className="text-stone-500">{label}</dt>
    <dd className="text-right font-medium text-stone-900">{value}</dd>
  </div>
);

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
};

export const ResultReportView: React.FC<ResultReportViewProps> = ({
  summary,
  indexTraumaLabel,
  userReportText,
  sessionReportText,
  events,
  participantId,
  resultDate,
  isSaved = false,
  isPastRecord = false,
  eventsSaved = true,
  onSaveToHistory,
  onRestart,
  onOpenCrisis,
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'SESSION'>('SUMMARY');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      exportAssessmentReportToPdf({
        summary,
        indexTraumaLabel,
        userReportText,
        sessionReportText,
        events,
        participantId,
        date: resultDate,
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const integrity = INTEGRITY_LABELS[summary.sessionIntegrityRating];
  const stats = summary.sensorStats;

  const tabClass = (active: boolean) =>
    `border-b-2 pb-3 text-sm font-medium transition-colors ${
      active ? 'border-teal-800 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {isPastRecord ? 'Past results' : 'Your results'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {new Date(resultDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
            {participantId && <span> · {participantId}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isPastRecord && onSaveToHistory && (
            <button
              type="button"
              onClick={onSaveToHistory}
              disabled={isSaved}
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-800"
            >
              {isSaved && <Check className="h-4 w-4" aria-hidden="true" />}
              {isSaved ? 'Saved to history' : 'Save to history'}
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            {isDownloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : downloadSuccess ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {downloadSuccess ? 'Downloaded' : 'Download PDF'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 sm:flex"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-stone-200 px-1" role="tablist" aria-label="Report sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'SUMMARY'}
          onClick={() => setActiveTab('SUMMARY')}
          className={tabClass(activeTab === 'SUMMARY')}
        >
          Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'SESSION'}
          onClick={() => setActiveTab('SESSION')}
          className={tabClass(activeTab === 'SESSION')}
        >
          Session record
        </button>
      </div>

      {activeTab === 'SUMMARY' && (
        <div className="space-y-6" role="tabpanel">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid items-center gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
                <p className="text-sm text-stone-500">PCL-5 total score</p>
                <p className="my-1">
                  <span className="text-5xl font-semibold text-stone-900">{summary.totalScore}</span>
                  <span className="text-lg text-stone-400"> / 80</span>
                </p>
                <p className="text-xs text-stone-500">Screening threshold: {summary.cutPoint}</p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <p
                  className={`inline-block rounded-md px-2.5 py-1 text-sm font-medium ${
                    summary.isClinicallySignificant ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {summary.isClinicallySignificant ? 'Above the screening threshold' : 'Below the screening threshold'}
                </p>

                <p className="text-base leading-snug text-stone-900">
                  {summary.isClinicallySignificant
                    ? 'Your answers suggest trauma-related symptoms that are worth talking through with a qualified mental health professional.'
                    : 'Your answers about the past month are below the usual screening threshold for post-traumatic stress.'}
                </p>

                <p className="text-sm leading-relaxed text-stone-600">
                  This is a screening result, not a diagnosis. A diagnosis needs a clinical interview with a licensed
                  professional.
                </p>

                {indexTraumaLabel && (
                  <p className="text-sm text-stone-500">
                    Questions referred to: <span className="text-stone-700">{indexTraumaLabel}</span>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-stone-900">Symptom areas</h2>
            <p className="mb-5 text-sm text-stone-500">The PCL-5 groups reactions into four areas.</p>

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {CLUSTERS.map((c) => {
                const cluster = summary.clusters[c.key];
                return (
                  <div key={c.key}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-sm font-medium text-stone-900">{c.name}</span>
                      <span className="text-sm text-stone-600">
                        {cluster.score} / {cluster.maxScore}
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-stone-200"
                      role="img"
                      aria-label={`${c.name}: ${cluster.score} of ${cluster.maxScore}, ${cluster.symptomSeverity}`}
                    >
                      <div className="h-full bg-teal-700" style={{ width: `${cluster.percentage}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-stone-500">
                      <span>{c.description}</span>
                      <span className="shrink-0 pl-2 font-medium text-stone-700">{cluster.symptomSeverity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Effect on daily life</h2>
                <p className="text-sm text-stone-500">Recorded separately from the PCL-5 score.</p>
              </div>
              <p className="shrink-0 text-sm text-stone-600">
                Average <span className="text-lg font-semibold text-stone-900">{summary.functionalImpactAverage}</span> of 4
              </p>
            </div>

            {Object.keys(summary.functionalImpactProfile).length === 0 ? (
              <p className="text-sm text-stone-500">Answers for each area weren't saved with this assessment.</p>
            ) : (
            <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
              {FUNCTIONAL_IMPACT_DOMAINS.map((dom) => {
                const val = summary.functionalImpactProfile[dom.id];
                return (
                  <div key={dom.id} className="flex justify-between border-b border-stone-100 py-2">
                    <dt className="text-stone-700">{dom.domain}</dt>
                    <dd className="font-medium text-stone-900">{val === undefined ? 'Not answered' : IMPACT_LABELS[val]}</dd>
                  </div>
                );
              })}
            </dl>
            )}
          </section>

          {userReportText && (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-lg font-semibold text-stone-900">What this means</h2>
              <ReportText text={userReportText} />
            </section>
          )}
        </div>
      )}

      {activeTab === 'SESSION' && (
        <div className="space-y-6" role="tabpanel">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-stone-200 pb-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-stone-900">Session record</h2>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm font-medium text-stone-800">
                  {integrity.label}
                </span>
                {stats && (
                  <span className="text-sm text-stone-500">{formatDuration(stats.sessionDurationSeconds)}</span>
                )}
              </div>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-stone-600">
                {integrity.description} Aura checked the camera, microphone and window focus while you answered. These
                checks describe the session only. They are never used to judge your answers.
              </p>
            </div>

            {stats ? (
              <div className="mb-6 grid gap-6 text-sm sm:grid-cols-3">
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-medium text-stone-900">
                    <Camera className="h-4 w-4 text-stone-500" aria-hidden="true" /> Camera
                  </h3>
                  <dl>
                    <StatRow label="Face in view" value={`${stats.faceRetentionPercentage}%`} />
                    <StatRow label="Facing the screen" value={`${stats.centerPosePercentage}%`} />
                    <StatRow label="Covered or dark frames" value={stats.blackScreenFrames} />
                    <StatRow label="Another person in view" value={stats.multiplePersonsSuspectedCount} />
                  </dl>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-medium text-stone-900">
                    <Mic className="h-4 w-4 text-stone-500" aria-hidden="true" /> Microphone
                  </h3>
                  <dl>
                    <StatRow label="Average level" value={`${stats.averageVolumeDb} dB`} />
                    <StatRow label="Loudest moment" value={`${stats.peakVolumeDb} dB`} />
                    <StatRow label="Quiet time" value={`${stats.ambientSilencePercentage}%`} />
                    <StatRow label="Speaking" value={formatDuration(stats.speechActivitySeconds)} />
                  </dl>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-medium text-stone-900">
                    <Monitor className="h-4 w-4 text-stone-500" aria-hidden="true" /> Window
                  </h3>
                  <dl>
                    <StatRow
                      label="Method"
                      value={stats.screenShareType === 'display_stream' ? 'Screen sharing' : 'Focus tracking'}
                    />
                    <StatRow label="Time in window" value={`${stats.windowFocusPercentage}%`} />
                    <StatRow label="Tab switches" value={stats.tabSwitchCount} />
                    <StatRow label="Time away" value={formatDuration(stats.totalBlurDurationSeconds)} />
                  </dl>
                </div>
              </div>
            ) : (
              <p className="mb-6 text-sm text-stone-500">Detailed camera and microphone figures weren't recorded for this session.</p>
            )}

            {sessionReportText && (
              <div className="mb-6 rounded-xl bg-stone-50 p-5">
                <h3 className="mb-3 text-sm font-semibold text-stone-900">Notes</h3>
                <ReportText text={sessionReportText} />
              </div>
            )}

            <h3 className="mb-3 text-sm font-semibold text-stone-900">
              {eventsSaved ? `Events (${events.length})` : 'Events'}
            </h3>
            <div className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
              {events.length === 0 ? (
                <p className="p-4 text-center text-sm text-stone-500">
                  {eventsSaved ? 'No events were recorded.' : "The event log wasn't saved with this assessment."}
                </p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[ev.severity]}`} aria-hidden="true" />
                      <div>
                        <p className="font-medium text-stone-900">{formatEventType(ev.eventType)}</p>
                        <p className="text-stone-600">{ev.message}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-stone-500">
                      <p>{new Date(ev.timestamp).toLocaleTimeString()}</p>
                      <p>{formatEventSource(ev.source)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" aria-hidden="true" />
          <div className="text-sm text-teal-950">
            <p className="font-semibold">Need to talk to someone now?</p>
            <p>Free, confidential support is available any time through the 988 Suicide & Crisis Lifeline.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCrisis}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            See support options
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Start a new assessment
          </button>
        </div>
      </div>
    </div>
  );
};
