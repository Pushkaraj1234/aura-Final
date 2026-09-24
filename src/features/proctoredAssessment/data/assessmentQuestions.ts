/**
 * Official validated trauma assessment instruments:
 * - LEC-5 (Life Events Checklist for DSM-5)
 * - PC-PTSD-5 (Primary Care PTSD Screen for DSM-5)
 * - PCL-5 (PTSD Checklist for DSM-5 - 20 items, Clusters B, C, D, E)
 * - Structured Functional Impact Domains
 */

import { FunctionalImpactDomain, Lec5EventItem, Pcl5Question, SessionConfiguration } from '../types';

export const PCL5_RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all', description: 'Did not experience this' },
  { value: 1, label: 'A little bit', description: 'Experienced slightly or rarely' },
  { value: 2, label: 'Moderately', description: 'Experienced somewhat / occasionally' },
  { value: 3, label: 'Quite a bit', description: 'Experienced frequently or substantially' },
  { value: 4, label: 'Extremely', description: 'Experienced almost constantly / overwhelming' },
];

export const LEC5_EVENTS: Lec5EventItem[] = [
  {
    id: 'natural_disaster',
    category: 'Natural Disaster',
    description: 'Major earthquake, flood, tornado, hurricane, or severe wildfire',
  },
  {
    id: 'accident',
    category: 'Severe Accident',
    description: 'Serious transportation accident, major car crash, or industrial/work injury',
  },
  {
    id: 'physical_assault',
    category: 'Physical Violence / Assault',
    description: 'Being attacked, hit, threatened with a weapon, or subjected to severe violence',
  },
  {
    id: 'sexual_violence',
    category: 'Sexual Violence / Coercion',
    description: 'Unwanted sexual contact, assault, coercion, or severe violation of boundaries',
  },
  {
    id: 'combat_war',
    category: 'Combat / War Zone Exposure',
    description: 'Direct military combat, terrorist incident, artillery/bombing, or armed conflict',
  },
  {
    id: 'captivity_kidnapping',
    category: 'Captivity or Unlawful Detention',
    description: 'Being kidnapped, held hostage, prisoner of war, or unlawfully detained',
  },
  {
    id: 'life_threatening_illness',
    category: 'Life-Threatening Illness or Medical Emergency',
    description: 'Severe acute medical crisis, emergency resuscitation, or ICU survival',
  },
  {
    id: 'sudden_violent_death',
    category: 'Sudden Violent or Unnatural Death of a Loved One',
    description: 'Homicide, fatal accident, or sudden tragic loss of a close family member or friend',
  },
  {
    id: 'severe_human_suffering',
    category: 'Severe Human Suffering / Humanitarian Crisis',
    description: 'Mass displacement, famine, witnessing severe atrocity, or extreme persecution',
  },
  {
    id: 'other_overwhelming_event',
    category: 'Other Extremely Stressful or Traumatic Experience',
    description: 'Any other deeply overwhelming, traumatic, or terrifying event not listed above',
  },
];

export const PC_PTSD_5_QUESTIONS = [
  {
    id: 1,
    text: 'In the past month, have you had nightmares about the event(s) or thought about the event(s) when you did not want to?',
    shortLabel: 'Intrusive memories or nightmares',
  },
  {
    id: 2,
    text: 'In the past month, have you tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?',
    shortLabel: 'Active avoidance of reminders',
  },
  {
    id: 3,
    text: 'In the past month, have you been constantly on guard, watchful, or easily startled?',
    shortLabel: 'Hypervigilance and exaggerated startle',
  },
  {
    id: 4,
    text: 'In the past month, have you felt numb or detached from people, activities, or your surroundings?',
    shortLabel: 'Emotional numbness or detachment',
  },
  {
    id: 5,
    text: 'In the past month, have you felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?',
    shortLabel: 'Persistent guilt or blame',
  },
];

export const PCL5_QUESTIONS: Pcl5Question[] = [
  // Cluster B: Intrusion Symptoms (Items 1 - 5)
  {
    id: 1,
    cluster: 'B',
    clusterName: 'Intrusion Symptoms',
    text: 'Repeated, disturbing, and unwanted memories of the stressful experience?',
    subtext: 'Memories that enter your mind involuntarily even when you do not want them to.',
  },
  {
    id: 2,
    cluster: 'B',
    clusterName: 'Intrusion Symptoms',
    text: 'Repeated, disturbing dreams of the stressful experience?',
    subtext: 'Distressing dreams, nightmares, or disrupted sleep related to the event.',
  },
  {
    id: 3,
    cluster: 'B',
    clusterName: 'Intrusion Symptoms',
    text: 'Suddenly feeling or acting as if the stressful experience were actually happening again?',
    subtext: 'Flashbacks or sensation as if you were actually back there reliving the experience.',
  },
  {
    id: 4,
    cluster: 'B',
    clusterName: 'Intrusion Symptoms',
    text: 'Feeling very upset when something reminded you of the stressful experience?',
    subtext: 'Intense emotional distress triggered by external sights, sounds, smells, or thoughts.',
  },
  {
    id: 5,
    cluster: 'B',
    clusterName: 'Intrusion Symptoms',
    text: 'Having strong physical reactions when something reminded you of the stressful experience?',
    subtext: 'For example: heart pounding or racing, trouble breathing, sweating, or dizziness.',
  },

  // Cluster C: Avoidance (Items 6 - 7)
  {
    id: 6,
    cluster: 'C',
    clusterName: 'Avoidance',
    text: 'Avoiding memories, thoughts, or feelings related to the stressful experience?',
    subtext: 'Trying to push away memories, internal thoughts, or emotional reactions connected to what occurred.',
  },
  {
    id: 7,
    cluster: 'C',
    clusterName: 'Avoidance',
    text: 'Avoiding external reminders of the stressful experience?',
    subtext: 'For example: staying away from specific people, places, conversations, activities, objects, or situations.',
  },

  // Cluster D: Negative Alterations in Cognitions and Mood (Items 8 - 14)
  {
    id: 8,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Trouble remembering important parts of the stressful experience?',
    subtext: 'Gaps in memory not caused by physical head injury, alcohol, or medication.',
  },
  {
    id: 9,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Having strong negative beliefs about yourself, other people, or the world?',
    subtext: 'For example, thoughts such as: "I am bad", "No one can be trusted", or "The world is completely dangerous".',
  },
  {
    id: 10,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Blaming yourself or someone else for the stressful experience or what happened after it?',
    subtext: 'Persistent, distorted blame directed inward toward yourself or toward others.',
  },
  {
    id: 11,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Having strong negative feelings such as fear, horror, anger, guilt, or shame?',
    subtext: 'Persistent presence of severe distressing emotions in your day-to-day life.',
  },
  {
    id: 12,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Loss of interest in activities that you used to enjoy?',
    subtext: 'Noticeable reduction in enthusiasm or participation in previously meaningful hobbies or routines.',
  },
  {
    id: 13,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Feeling distant or cut off from other people?',
    subtext: 'A sense of isolation, emotional estrangement, or alienation from family and friends.',
  },
  {
    id: 14,
    cluster: 'D',
    clusterName: 'Negative Cognitions & Mood',
    text: 'Trouble experiencing positive feelings?',
    subtext: 'Being unable to feel happiness, satisfaction, warmth, or loving feelings for people close to you.',
  },

  // Cluster E: Alterations in Arousal and Reactivity (Items 15 - 20)
  {
    id: 15,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Irritable behavior, angry outbursts, or acting aggressively?',
    subtext: 'Short temper, verbal snapping, or aggressive impulses with little or no provocation.',
  },
  {
    id: 16,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Taking too many risks or doing things that could cause you harm?',
    subtext: 'Reckless or self-destructive behaviors such as dangerous driving or substance misuse.',
  },
  {
    id: 17,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Being "superalert", watchful, or constantly on guard?',
    subtext: 'Scanning rooms, checking exits, or hyper-vigilance about potential threats.',
  },
  {
    id: 18,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Feeling jumpy or easily startled?',
    subtext: 'Exaggerated physical reaction to sudden sounds, unexpected movements, or surprises.',
  },
  {
    id: 19,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Having difficulty concentrating?',
    subtext: 'Struggling to follow conversations, read, work, or focus on simple tasks.',
  },
  {
    id: 20,
    cluster: 'E',
    clusterName: 'Arousal & Reactivity',
    text: 'Trouble falling or staying asleep?',
    subtext: 'Restless sleep, frequent night awakenings, or difficulty falling asleep.',
  },
];

export const FUNCTIONAL_IMPACT_DOMAINS: FunctionalImpactDomain[] = [
  {
    id: 'work',
    domain: 'Work & Employment',
    description: 'Ability to complete work tasks, maintain employment, or sustain productivity.',
  },
  {
    id: 'education',
    domain: 'Education & Study',
    description: 'Ability to attend classes, study, comprehend material, or take tests.',
  },
  {
    id: 'relationships',
    domain: 'Close Relationships & Family',
    description: 'Connection with spouse/partner, children, parents, or close friends.',
  },
  {
    id: 'sleep',
    domain: 'Sleep & Physical Recovery',
    description: 'Ability to obtain restorative sleep and physical rest without nightmares or agitation.',
  },
  {
    id: 'concentration',
    domain: 'Concentration & Daily Focus',
    description: 'Ability to organize thoughts, remember appointments, and finish everyday tasks.',
  },
  {
    id: 'social',
    domain: 'Social Life & Community',
    description: 'Engaging in social gatherings, recreational activities, and community life.',
  },
  {
    id: 'responsibilities',
    domain: 'Self-Care & Daily Responsibilities',
    description: 'Handling nutrition, hygiene, household duties, finances, and essential logistics.',
  },
];

export const CRISIS_SUPPORT_RESOURCES = [
  {
    name: '988 Suicide & Crisis Lifeline',
    contact: 'Call or text 988',
    details: 'Free, confidential, available 24/7 in English and Spanish across the US and Canada.',
    type: 'National Hotline',
  },
  {
    name: 'Crisis Text Line',
    contact: 'Text HOME to 741741',
    details: 'Free 24/7 support via SMS with a trained crisis counselor.',
    type: 'Text Service',
  },
  {
    name: 'Veterans Crisis Line',
    contact: 'Dial 988, then press 1',
    details: 'Dedicated support for veterans, service members, and their loved ones.',
    type: 'Specialized',
  },
  {
    name: 'International Crisis Support',
    contact: 'findahelpline.com / befrienders.org',
    details: 'Free confidential support directories across 130+ countries worldwide.',
    type: 'Global Resource',
  },
];

export const DEFAULT_SESSION_CONFIG: SessionConfiguration = {
  version: 'AURA-PCL5-v2.1',
  sessionTimeoutMinutes: 45,
  cameraLossGraceSeconds: 10,
  faceAbsenceThresholdSeconds: 8,
  requireScreenShare: false, // Optional for user privacy / mobile readiness, active when enabled
  allowVoiceInput: true,
  clinicalCutPoint: 33, // Validated DSM-5 cutoff for provisional PTSD screen
  retentionPolicyDays: 30,
};
