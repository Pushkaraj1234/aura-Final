import React from 'react';
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { CompletedAssessmentRecord } from '../types';
import { compareAssessments } from '../utils/scoring';
import { INTEGRITY_LABELS } from '../utils/labels';

interface AssessmentHistoryViewProps {
  history: CompletedAssessmentRecord[];
  /** Saved results load from the participant's AURA record */
  status?: 'loading' | 'ready' | 'error';
  onRetry?: () => void;
  onBack: () => void;
  onSelectRecord: (record: CompletedAssessmentRecord) => void;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const AssessmentHistoryView: React.FC<AssessmentHistoryViewProps> = ({
  history,
  status = 'ready',
  onRetry,
  onBack,
  onSelectRecord,
}) => {
  // With two or more records, compare the most recent two
  const comparison =
    history.length >= 2 ? compareAssessments(history[history.length - 2], history[history.length - 1]) : null;

  const newestFirst = [...history].reverse();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Assessment history</h1>
          <p className="mt-1 text-sm text-stone-500">Compare your PCL-5 results over time.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>
      </div>

      {comparison && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Since your previous assessment</h2>
              <p className="mt-1 text-sm text-stone-600">{comparison.scoreChangeDescription}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {comparison.daysApart === 1 ? '1 day apart' : `${comparison.daysApart} days apart`}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-2.5">
              {comparison.scoreDelta < 0 ? (
                <TrendingDown className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              ) : comparison.scoreDelta > 0 ? (
                <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden="true" />
              ) : (
                <Minus className="h-5 w-5 text-stone-500" aria-hidden="true" />
              )}
              <span className="text-xl font-semibold text-stone-900">{signed(comparison.scoreDelta)}</span>
              <span className="text-xs text-stone-500">points</span>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 text-sm sm:grid-cols-4">
            {[
              { label: 'Intrusion', value: comparison.clusterChanges.intrusion },
              { label: 'Avoidance', value: comparison.clusterChanges.avoidance },
              { label: 'Thoughts and mood', value: comparison.clusterChanges.negativeCognitions },
              { label: 'Arousal', value: comparison.clusterChanges.arousal },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-stone-500">{item.label}</dt>
                <dd className="font-medium text-stone-900">{signed(item.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Saved assessments</h2>

        {status === 'loading' && history.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500">Loading your saved assessments…</p>
        ) : status === 'error' ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-stone-800">Your saved assessments couldn't be loaded.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-stone-800">No assessments yet.</p>
            <p className="mt-1 text-sm text-stone-500">When you save your results, they'll appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {newestFirst.map((rec) => (
              <li key={rec.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {new Date(rec.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-600">
                    Score {rec.totalScore} of 80
                    {rec.itemsAnswered !== undefined && rec.itemsAnswered < 20 && (
                      <span> ({rec.itemsAnswered} of 20 answered)</span>
                    )}
                    <span className="text-stone-400"> · </span>
                    {rec.isClinicallySignificant ? 'Above threshold' : 'Below threshold'}
                    <span className="text-stone-400"> · </span>
                    {INTEGRITY_LABELS[rec.sessionIntegrityRating]?.label ?? rec.sessionIntegrityRating}
                  </p>
                  {rec.indexTraumaLabel && <p className="mt-0.5 text-xs text-stone-500">{rec.indexTraumaLabel}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectRecord(rec)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  View results
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
