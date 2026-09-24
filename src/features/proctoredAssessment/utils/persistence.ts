/**
 * Conversion between a finished proctored session and a proctored_assessments
 * row (supabase/migrations/20260925090000_proctored_assessments.sql).
 *
 * Pure on purpose: no Supabase import, so the scoring-to-row rules can be
 * tested on their own (tests/proctored-assessment.test.mjs).
 *
 * Every score written is derived here from the raw responses, never taken
 * from the caller. A row whose total disagreed with its own item responses
 * could not be checked, which is the property the table exists to keep.
 */

import {
  CompletedAssessmentRecord,
  ProctorEvent,
  SensorMonitoringStats,
  SessionIntegrityRating,
} from '../types';
import { calculatePcl5Summary } from './scoring';

export interface ProctoredAssessmentInput {
  participantId: string;
  /** ISO date the session was completed */
  administeredAt: string;
  assessmentVersion: string;
  cutPoint: number;
  pcl5Responses: Record<number, number>;
  functionalResponses: Record<string, number>;
  pcPtsdResponses: Record<number, boolean>;
  indexTraumaLabel: string;
  events: ProctorEvent[];
  sensorStats?: SensorMonitoringStats | null;
  userReport: string;
  sessionReport: string;
  researchConsent: boolean;
}

export interface ProctoredAssessmentRow {
  id: string;
  participant_id: string;
  assessment_version: string;
  pcl5_responses: Record<string, number>;
  items_answered: number;
  total_score: number;
  cut_point: number;
  above_threshold: boolean;
  cluster_scores: { intrusion: number; avoidance: number; negativeCognitions: number; arousal: number };
  functional_responses: Record<string, number>;
  functional_average: number;
  pc_ptsd_responses: Record<string, boolean>;
  index_trauma_label: string | null;
  session_integrity: SessionIntegrityRating;
  sensor_stats: SensorMonitoringStats | null;
  session_events: ProctorEvent[];
  user_report: string;
  session_report: string;
  research_consent: boolean;
  administered_at: string;
}

const isScaleValue = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 4;

/** Keeps only PCL-5 items 1-20 answered 0-4. Anything else is dropped rather than coerced. */
export function sanitizePcl5Responses(responses: Record<number | string, unknown>): Record<number, number> {
  const clean: Record<number, number> = {};
  for (let i = 1; i <= 20; i++) {
    const v = responses[i];
    if (isScaleValue(v)) clean[i] = v;
  }
  return clean;
}

/** Keeps functional-impact ratings 0-4 under their domain id. */
export function sanitizeFunctionalResponses(responses: Record<string, unknown>): Record<string, number> {
  const clean: Record<string, number> = {};
  for (const [key, v] of Object.entries(responses || {})) {
    if (isScaleValue(v)) clean[key] = v;
  }
  return clean;
}

export function buildAssessmentRow(input: ProctoredAssessmentInput, id: string): ProctoredAssessmentRow {
  const pcl5 = sanitizePcl5Responses(input.pcl5Responses);
  const functional = sanitizeFunctionalResponses(input.functionalResponses);
  const summary = calculatePcl5Summary(pcl5, functional, input.events, input.cutPoint);

  const pcPtsd: Record<string, boolean> = {};
  for (const [key, v] of Object.entries(input.pcPtsdResponses || {})) {
    if (typeof v === 'boolean') pcPtsd[key] = v;
  }

  return {
    id,
    participant_id: input.participantId,
    assessment_version: input.assessmentVersion,
    pcl5_responses: pcl5,
    items_answered: summary.itemsAnswered,
    total_score: summary.totalScore,
    cut_point: summary.cutPoint,
    above_threshold: summary.isClinicallySignificant,
    cluster_scores: {
      intrusion: summary.clusters.B.score,
      avoidance: summary.clusters.C.score,
      negativeCognitions: summary.clusters.D.score,
      arousal: summary.clusters.E.score,
    },
    functional_responses: functional,
    functional_average: summary.functionalImpactAverage,
    pc_ptsd_responses: pcPtsd,
    index_trauma_label: input.indexTraumaLabel || null,
    session_integrity: summary.sessionIntegrityRating,
    sensor_stats: input.sensorStats ?? null,
    session_events: input.events,
    user_report: input.userReport || '',
    session_report: input.sessionReport || '',
    research_consent: Boolean(input.researchConsent),
    administered_at: input.administeredAt,
  };
}

export function recordFromRow(row: any): CompletedAssessmentRecord {
  const responses = sanitizePcl5Responses(row.pcl5_responses || {});
  const clusters = row.cluster_scores || {};
  return {
    id: String(row.id),
    date: String(row.administered_at),
    indexTraumaLabel: row.index_trauma_label || 'General traumatic stress',
    totalScore: Number(row.total_score) || 0,
    isClinicallySignificant: Boolean(row.above_threshold),
    clusterScores: {
      intrusion: Number(clusters.intrusion) || 0,
      avoidance: Number(clusters.avoidance) || 0,
      negativeCognitions: Number(clusters.negativeCognitions) || 0,
      arousal: Number(clusters.arousal) || 0,
    },
    functionalImpactAvg: Number(row.functional_average) || 0,
    sessionIntegrityRating: row.session_integrity as SessionIntegrityRating,
    summaryText: row.user_report || '',
    detailedReport: row.user_report || '',
    integrityReport: row.session_report || '',
    eventsCount: Array.isArray(row.session_events) ? row.session_events.length : 0,
    sensorStats: row.sensor_stats || undefined,
    responses,
    participantId: row.participant_id,
    cutPoint: Number(row.cut_point) || undefined,
    functionalProfile: sanitizeFunctionalResponses(row.functional_responses || {}),
    events: Array.isArray(row.session_events) ? row.session_events : [],
    itemsAnswered: Number.isInteger(row.items_answered) ? row.items_answered : Object.keys(responses).length,
  };
}
