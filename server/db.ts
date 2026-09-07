import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  email: string;
  password_hash?: string;
  role: string;
  name: string;
  language?: string;
  age_range?: string;
  support_preference?: string;
  consent_given: boolean;
  created_at: string;
}

export interface ParticipantRecord {
  id: string;
  user_id?: string;
  consent_given: boolean;
  status: string;
  preferred_support: string;
  language: string;
  age_group: string;
  assigned_worker?: string;
  last_review_date?: string;
  region?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckInRecord {
  id: string;
  participant_id: string;
  wellbeing: number;
  stress: number;
  sleep: number;
  safety: string;
  connection: number;
  support_requested: boolean;
  immediate_safety_concern: boolean;
  calculated_score?: number;
  notes?: string;
  optional_note?: string;
  share_note_with_worker: boolean;
  voice_input_used: boolean;
  consent_context?: any;
  timestamp: string;
  created_at: string;
}

export interface ReflectionRecord {
  id: string;
  check_in_id?: string;
  participant_id: string;
  type: string;
  transcript: string;
  audio_recorded: boolean;
  share_with_worker: boolean;
  sentiment?: string;
  language_signal?: string;
  contributing_patterns?: any;
  keywords?: any;
  factors?: any;
  explanation?: string;
  has_urgent_safety_mention: boolean;
  submitted_at: string;
}

export interface RiskPredictionRecord {
  id: string;
  participant_id: string;
  check_in_id?: string;
  model_version_id?: string;
  distress_score: number;
  risk_level: string;
  trajectory: string;
  confidence: number;
  change_delta?: number;
  contributing_factors?: any;
  factor_breakdown?: any;
  explanation?: string;
  explanation_points?: any;
  requires_human_review: boolean;
  is_explicit_safety_concern: boolean;
  prediction_metadata?: any;
  created_at: string;
}

export interface RiskHistoryRecord {
  id: string;
  participant_id: string;
  score: number;
  level: string;
  source: string;
  recorded_at: string;
}

export interface AlertRecord {
  id: string;
  participant_id: string;
  category: string;
  severity: string;
  title: string;
  reason: string;
  description?: string;
  recommended_action?: string;
  status: string;
  score: number;
  change_delta?: number;
  assigned_to?: string;
  human_decision?: string;
  decision_notes?: string;
  action_taken?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  contributing_factors?: any;
  trajectory?: string;
  requires_human_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id?: string;
  participant_id?: string;
  category: string;
  filter_category: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  action_label?: string;
  action_view?: string;
  action_participant_id?: string;
  metadata_json?: any;
  created_at: string;
}

export interface InterventionRecord {
  id: string;
  participant_id: string;
  alert_id?: string;
  intervention_type: string;
  assigned_worker: string;
  date: string;
  outcome: string;
  notes: string;
  previous_risk?: number;
  follow_up_risk?: number;
  follow_up_date?: string;
  created_at: string;
}

export interface FollowUpRecord {
  id: string;
  participant_id: string;
  intervention_id?: string;
  alert_id?: string;
  original_score: number;
  intervention_type: string;
  intervention_date: string;
  worker_name: string;
  follow_up_score?: number;
  follow_up_date?: string;
  score_delta?: number;
  outcome: string;
  outcome_label: string;
  notes: string;
  created_at: string;
}

export interface ConsentRecord {
  id: string;
  participant_id?: string;
  user_id?: string;
  wellbeing_check_ins: boolean;
  support_worker_sharing: boolean;
  optional_free_text_sharing: boolean;
  optional_voice_feature: boolean;
  community_aggregate_analytics: boolean;
  status: string;
  version: string;
  revocation_reason?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportResourceRecord {
  id: string;
  name: string;
  resource_type: string;
  region: string;
  language: string[];
  contact_method: string;
  phone?: string;
  website?: string;
  hours?: string;
  emergency_flag: boolean;
  accessibility?: string;
  verification_status: string;
  last_verified_date?: string;
  created_at: string;
}

export interface SupportNoteRecord {
  id: string;
  participant_id: string;
  author: string;
  timestamp: string;
  text: string;
  action_taken?: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string;
  actor_role: string;
  actor_name?: string;
  action: string;
  category: string;
  participant_id?: string;
  target_id?: string;
  description: string;
  severity: string;
  metadata_json?: any;
  timestamp: string;
}

export interface AuraDatabaseSchema {
  users: UserRecord[];
  participants: ParticipantRecord[];
  check_ins: CheckInRecord[];
  reflections: ReflectionRecord[];
  risk_predictions: RiskPredictionRecord[];
  risk_history: RiskHistoryRecord[];
  alerts: AlertRecord[];
  notifications: NotificationRecord[];
  interventions: InterventionRecord[];
  follow_ups: FollowUpRecord[];
  consents: ConsentRecord[];
  support_resources: SupportResourceRecord[];
  support_notes: SupportNoteRecord[];
  audit_logs: AuditLogRecord[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'aura_database.json');

class AuraDatabase {
  private data: AuraDatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): AuraDatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read existing database file, initializing fresh:', err);
    }
    const initial = this.getInitialSeed();
    this.saveDirect(initial);
    return initial;
  }

  private saveDirect(data: AuraDatabaseSchema) {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  public get db(): AuraDatabaseSchema {
    return this.data;
  }

  private getInitialSeed(): AuraDatabaseSchema {
    const now = new Date().toISOString();
    return {
      users: [
        {
          id: 'worker-1',
          email: 'worker@aura.test',
          role: 'support_worker',
          name: 'Sarah Jenkins, MSW',
          language: 'English',
          consent_given: true,
          created_at: now
        },
        {
          id: 'user-1001',
          email: 'maria@aura.test',
          role: 'participant',
          name: 'Maria Santos',
          language: 'Spanish',
          age_range: '25-34',
          support_preference: 'Human counselor',
          consent_given: true,
          created_at: now
        },
        {
          id: 'user-1002',
          email: 'david@aura.test',
          role: 'participant',
          name: 'David Kim',
          language: 'English',
          age_range: '35-44',
          support_preference: 'Human counselor',
          consent_given: true,
          created_at: now
        },
        {
          id: 'user-1003',
          email: 'amara@aura.test',
          role: 'participant',
          name: 'Amara Diallo',
          language: 'English',
          age_range: '18-24',
          support_preference: 'Self-guided tools',
          consent_given: true,
          created_at: now
        }
      ],
      participants: [
        {
          id: 'P-1001',
          user_id: 'user-1001',
          consent_given: true,
          status: 'ELEVATED',
          preferred_support: 'Human counselor',
          language: 'Spanish',
          age_group: '25-34',
          assigned_worker: 'Sarah Jenkins, MSW',
          last_review_date: now,
          region: 'North America',
          created_at: now,
          updated_at: now
        },
        {
          id: 'P-1002',
          user_id: 'user-1002',
          consent_given: true,
          status: 'REVIEW_NEEDED',
          preferred_support: 'Human counselor',
          language: 'English',
          age_group: '35-44',
          assigned_worker: 'Sarah Jenkins, MSW',
          last_review_date: now,
          region: 'North America',
          created_at: now,
          updated_at: now
        },
        {
          id: 'P-1003',
          user_id: 'user-1003',
          consent_given: true,
          status: 'Stable',
          preferred_support: 'Self-guided tools',
          language: 'English',
          age_group: '18-24',
          assigned_worker: 'Marcus Vance',
          last_review_date: now,
          region: 'Europe',
          created_at: now,
          updated_at: now
        },
        {
          id: 'P-1004',
          consent_given: true,
          status: 'Stable',
          preferred_support: 'Human counselor',
          language: 'Ukrainian',
          age_group: '45-54',
          assigned_worker: 'Elena Rostova, LCSW',
          last_review_date: now,
          region: 'Europe',
          created_at: now,
          updated_at: now
        },
        {
          id: 'P-1005',
          consent_given: true,
          status: 'Stable',
          preferred_support: 'Bilingual Specialist',
          language: 'Arabic',
          age_group: '25-34',
          assigned_worker: 'Tariq Al-Mansoor',
          last_review_date: now,
          region: 'Middle East',
          created_at: now,
          updated_at: now
        }
      ],
      check_ins: [
        {
          id: 'chk-1001-1',
          participant_id: 'P-1001',
          wellbeing: 2,
          stress: 4,
          sleep: 2,
          safety: 'Mostly',
          connection: 2,
          support_requested: true,
          immediate_safety_concern: false,
          calculated_score: 74.0,
          notes: 'Frequent nightmares returning; struggling to concentrate at work.',
          optional_note: 'Frequent nightmares returning; struggling to concentrate at work.',
          share_note_with_worker: true,
          voice_input_used: false,
          timestamp: now,
          created_at: now
        },
        {
          id: 'chk-1002-1',
          participant_id: 'P-1002',
          wellbeing: 2,
          stress: 5,
          sleep: 1,
          safety: 'Mostly',
          connection: 1,
          support_requested: true,
          immediate_safety_concern: false,
          calculated_score: 82.5,
          notes: 'Intense flashbacks past two days after legal hearing.',
          optional_note: 'Intense flashbacks past two days after legal hearing.',
          share_note_with_worker: true,
          voice_input_used: false,
          timestamp: now,
          created_at: now
        },
        {
          id: 'chk-1003-1',
          participant_id: 'P-1003',
          wellbeing: 4,
          stress: 2,
          sleep: 4,
          safety: 'Yes',
          connection: 4,
          support_requested: false,
          immediate_safety_concern: false,
          calculated_score: 28.0,
          notes: 'Feeling calmer after connecting with the community art group.',
          optional_note: 'Feeling calmer after connecting with the community art group.',
          share_note_with_worker: true,
          voice_input_used: false,
          timestamp: now,
          created_at: now
        }
      ],
      reflections: [
        {
          id: 'ref-1001',
          participant_id: 'P-1001',
          type: 'text',
          transcript: 'It has been really hard to sleep lately. The sounds outside wake me up and remind me of home.',
          audio_recorded: false,
          share_with_worker: true,
          sentiment: 'Negative',
          language_signal: 'Trauma trigger recall',
          has_urgent_safety_mention: false,
          submitted_at: now
        }
      ],
      risk_predictions: [
        {
          id: 'pred-1001',
          participant_id: 'P-1001',
          distress_score: 74.0,
          risk_level: 'HIGH',
          trajectory: 'Rapid Escalation',
          confidence: 0.91,
          change_delta: 18.0,
          contributing_factors: ['Severe sleep disturbance (Score 2/5)', 'Elevated anxiety & stress (Score 4/5)', 'Trauma recall cues in note'],
          factor_breakdown: { 'Sleep Deficit': 38, 'Stress/Anxiety': 32, 'Isolation': 18, 'External Triggers': 12 },
          explanation: 'Sharp drop in reported sleep quality paired with acute nightmare recall over 72 hours.',
          requires_human_review: true,
          is_explicit_safety_concern: false,
          created_at: now
        },
        {
          id: 'pred-1002',
          participant_id: 'P-1002',
          distress_score: 82.5,
          risk_level: 'CRITICAL',
          trajectory: 'Crisis Warning',
          confidence: 0.94,
          change_delta: 24.5,
          contributing_factors: ['Legal proceeding trigger', 'Extreme sleep deprivation', 'Acute social withdrawal'],
          factor_breakdown: { 'Flashbacks': 42, 'Insomnia': 30, 'Social Alienation': 28 },
          explanation: 'Acute distress spike following court appearance; participant explicitly requested human worker check-in.',
          requires_human_review: true,
          is_explicit_safety_concern: false,
          created_at: now
        }
      ],
      risk_history: [
        { id: 'rh-1', participant_id: 'P-1001', score: 45.0, level: 'MODERATE', source: 'check_in', recorded_at: new Date(Date.now() - 86400000 * 3).toISOString() },
        { id: 'rh-2', participant_id: 'P-1001', score: 56.0, level: 'MODERATE', source: 'check_in', recorded_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'rh-3', participant_id: 'P-1001', score: 74.0, level: 'HIGH', source: 'check_in', recorded_at: now },
        { id: 'rh-4', participant_id: 'P-1002', score: 58.0, level: 'MODERATE', source: 'check_in', recorded_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'rh-5', participant_id: 'P-1002', score: 82.5, level: 'CRITICAL', source: 'check_in', recorded_at: now }
      ],
      alerts: [
        {
          id: 'ALT-1001',
          participant_id: 'P-1001',
          category: 'ELEVATED_DISTRESS',
          severity: 'ORANGE',
          title: 'Elevated Distress Spike (+18 pts)',
          reason: 'Score rose from 56 to 74 with marked sleep deprivation and recurring trauma dreams.',
          description: 'Participant Maria Santos reported acute difficulty sleeping with intrusive thoughts.',
          recommended_action: 'Initiate supportive reach-out within 4 hours; offer grounding techniques.',
          status: 'NEW',
          score: 74.0,
          change_delta: 18.0,
          assigned_to: 'Sarah Jenkins, MSW',
          trajectory: 'Rapid Escalation',
          requires_human_review: true,
          created_at: now,
          updated_at: now
        },
        {
          id: 'ALT-1002',
          participant_id: 'P-1002',
          category: 'CRITICAL_RISK',
          severity: 'RED',
          title: 'Critical Distress & Worker Outreach Requested',
          reason: 'Flashback recurrence following legal testimony with distress score 82.5.',
          description: 'David Kim requested immediate counselor check-in.',
          recommended_action: 'Direct human contact protocol required within 60 minutes.',
          status: 'NEW',
          score: 82.5,
          change_delta: 24.5,
          assigned_to: 'Sarah Jenkins, MSW',
          trajectory: 'Crisis Warning',
          requires_human_review: true,
          created_at: now,
          updated_at: now
        }
      ],
      notifications: [
        {
          id: 'notif-1',
          user_id: 'worker-1',
          participant_id: 'P-1002',
          category: 'CRISIS_ALERT',
          filter_category: 'alert',
          severity: 'HIGH',
          title: 'High Priority Alert: David Kim (P-1002)',
          message: 'Acute distress spike (82.5) after legal proceedings. Check-in requested.',
          read: false,
          action_label: 'Review Alert',
          action_view: 'alerts',
          action_participant_id: 'P-1002',
          created_at: now
        },
        {
          id: 'notif-2',
          user_id: 'worker-1',
          participant_id: 'P-1001',
          category: 'ELEVATED_ALERT',
          filter_category: 'alert',
          severity: 'MEDIUM',
          title: 'Distress Escalation: Maria Santos (P-1001)',
          message: 'Nightmare recall and sleep disruption reported. Follow-up recommended.',
          read: false,
          action_label: 'View Participant',
          action_view: 'participants',
          action_participant_id: 'P-1001',
          created_at: now
        }
      ],
      interventions: [
        {
          id: 'intv-1',
          participant_id: 'P-1001',
          alert_id: 'ALT-1001',
          intervention_type: 'Trauma Grounding & Sleep Hygiene Protocol',
          assigned_worker: 'Sarah Jenkins, MSW',
          date: now,
          outcome: 'in_progress',
          notes: 'Provided sensory grounding exercises; scheduled follow-up call tomorrow at 10 AM.',
          previous_risk: 74.0,
          created_at: now
        }
      ],
      follow_ups: [
        {
          id: 'flw-1',
          participant_id: 'P-1001',
          intervention_id: 'intv-1',
          alert_id: 'ALT-1001',
          original_score: 74.0,
          intervention_type: 'Trauma Grounding & Sleep Hygiene Protocol',
          intervention_date: now,
          worker_name: 'Sarah Jenkins, MSW',
          outcome: 'pending',
          outcome_label: 'Pending Next Check-in',
          notes: 'Participant agreed to test 5-4-3-2-1 technique before sleep tonight.',
          created_at: now
        }
      ],
      consents: [
        {
          id: 'cst-1001',
          participant_id: 'P-1001',
          user_id: 'user-1001',
          wellbeing_check_ins: true,
          support_worker_sharing: true,
          optional_free_text_sharing: true,
          optional_voice_feature: true,
          community_aggregate_analytics: false,
          status: 'active',
          version: '1.0',
          created_at: now,
          updated_at: now
        },
        {
          id: 'cst-1002',
          participant_id: 'P-1002',
          user_id: 'user-1002',
          wellbeing_check_ins: true,
          support_worker_sharing: true,
          optional_free_text_sharing: true,
          optional_voice_feature: false,
          community_aggregate_analytics: false,
          status: 'active',
          version: '1.0',
          created_at: now,
          updated_at: now
        },
        {
          id: 'cst-1003',
          participant_id: 'P-1003',
          user_id: 'user-1003',
          wellbeing_check_ins: true,
          support_worker_sharing: true,
          optional_free_text_sharing: true,
          optional_voice_feature: true,
          community_aggregate_analytics: true,
          status: 'active',
          version: '1.0',
          created_at: now,
          updated_at: now
        }
      ],
      support_resources: [
        {
          id: 'res-1',
          name: 'Global Trauma Survivor Hotline',
          resource_type: 'Crisis Support',
          region: 'Global',
          language: ['English', 'Spanish', 'French', 'Arabic'],
          contact_method: 'Phone, SMS',
          phone: '+1-800-273-8255',
          website: 'https://findahelpline.com',
          hours: '24/7',
          emergency_flag: true,
          accessibility: 'TDD/TTY, Multilingual interpretation',
          verification_status: 'verified',
          last_verified_date: now,
          created_at: now
        },
        {
          id: 'res-2',
          name: 'Freedom from Torture & Survivor Network',
          resource_type: 'Legal & Psychological',
          region: 'Europe / International',
          language: ['English', 'Ukrainian', 'Farsi', 'Arabic'],
          contact_method: 'Phone, Web',
          phone: '+44 20 7697 7777',
          website: 'https://freedomfromtorture.org',
          hours: 'Mon-Fri 9AM-5PM GMT',
          emergency_flag: false,
          accessibility: 'Wheelchair accessible, Telehealth',
          verification_status: 'verified',
          last_verified_date: now,
          created_at: now
        }
      ],
      support_notes: [
        {
          id: 'sn-1',
          participant_id: 'P-1001',
          author: 'Sarah Jenkins, MSW',
          timestamp: now,
          text: 'Participant expressed gratitude for the prompt follow-up. Agreed to trial sleep grounding audio tonight.',
          action_taken: 'Sent grounding audio guide; scheduled check-in.'
        }
      ],
      audit_logs: [
        {
          id: 'aud-1',
          actor_id: 'worker-1',
          actor_role: 'support_worker',
          actor_name: 'Sarah Jenkins, MSW',
          action: 'VIEW_PARTICIPANT_PROFILE',
          category: 'data_access',
          participant_id: 'P-1001',
          target_id: 'P-1001',
          description: 'Counselor accessed profile for Maria Santos following distress alert.',
          severity: 'INFO',
          timestamp: now
        },
        {
          id: 'aud-2',
          actor_id: 'system',
          actor_role: 'system',
          actor_name: 'AURA Dynamic AI Engine',
          action: 'GENERATE_RISK_PREDICTION',
          category: 'ai_evaluation',
          participant_id: 'P-1001',
          target_id: 'pred-1001',
          description: 'Model v2.4 generated risk assessment with 91% confidence for P-1001.',
          severity: 'INFO',
          timestamp: now
        }
      ]
    };
  }
}

export const auraDb = new AuraDatabase();
