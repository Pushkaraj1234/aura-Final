/**
 * The logic that decides what to tell a person next.
 *
 * Pure on purpose: no Supabase import, no React, no clock beyond what is passed
 * in. This is the part of the Recovery Hub that has to be testable, because it
 * is the part that decides what a distressed person sees when they open the
 * page, and a wrong answer here sends somebody to the wrong office.
 *
 * THE RULE THIS FILE EXISTS FOR
 *
 * "Do not make the victim navigate the system. Make the system guide the
 * victim." Everything below serves one output: a single next step, always
 * present, phrased as something a person can do today. Never a list of
 * outstanding tasks, because a list is the system asking the victim to
 * navigate it.
 *
 * WHAT IT WILL NOT DO
 *
 * It never concludes anything legal. It never says a document is required,
 * only that it is commonly asked for, because requirements vary by scheme, by
 * state and by case. It never promises an outcome. The copy rules are enforced
 * by tests/recovery-copy.test.mjs rather than by good intentions.
 */

import type {
  CompensationApplication,
  DocumentType,
  IncidentCategory,
  ImpactType,
  FinancialImpactType,
  LegalAidApplication,
  PriorAssistance,
  RecoveryCaseBundle,
  TimelineStage,
} from "../types/recovery";
import { TIMELINE_STAGE_ORDER } from "../types/recovery";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  physical_violence: "Physical violence",
  sexual_violence: "Sexual violence",
  caste_based_atrocity: "Caste-based atrocity",
  communal_violence: "Religious or communal violence",
  threat_intimidation: "Threat or intimidation",
  property_destruction: "Property destruction",
  discrimination: "Discrimination",
  trafficking_exploitation: "Trafficking or exploitation",
  other: "Something else",
  unknown: "I don't know",
};

export const IMPACT_LABELS: Record<ImpactType, string> = {
  physical_injury: "Physical injury",
  emotional_impact: "Emotional or psychological impact",
  medical_expenses: "Medical expenses",
  loss_of_income: "Loss of income",
  property_damage: "Property damage",
  disability: "Disability",
  death_of_family_member: "Death of a family member",
  displacement: "Having to leave home",
  other: "Something else",
};

export const FINANCIAL_IMPACT_LABELS: Record<FinancialImpactType, string> = {
  medical_expenses: "Medical expenses",
  loss_of_income: "Loss of income",
  disability: "Disability",
  property_damage: "Property damage",
  death_of_family_member: "Death of a family member",
  rehabilitation_expenses: "Rehabilitation expenses",
  education_disruption: "Education interrupted",
  housing_displacement: "Housing or displacement costs",
  other: "Something else",
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  fir: "FIR",
  police_complaint: "Police complaint",
  medical_report: "Medical report",
  identity: "Identity document",
  caste_certificate: "Caste certificate",
  disability_certificate: "Disability certificate",
  death_certificate: "Death certificate",
  court_document: "Court document",
  bank_details: "Bank details",
  prior_assistance_record: "Record of assistance already received",
  photo: "Photo",
  video: "Video",
  other: "Other document",
};

// ---------------------------------------------------------------------------
// Document checklist
// ---------------------------------------------------------------------------

/**
 * Never "required".
 *
 * `commonly_asked_for` is the strongest word used, because what an office
 * actually demands varies by scheme, by state and by the facts of the case.
 * Telling someone a document is required, when the scheme they end up applying
 * to does not ask for it, sends them to chase a certificate they did not need.
 * Telling them it is not required when it is, is worse.
 */
export type ChecklistWeight = "commonly_asked_for" | "may_help";

export interface ChecklistItem {
  docType: DocumentType;
  group: "Identity" | "Police" | "Medical" | "Legal" | "Financial" | "Other";
  weight: ChecklistWeight;
  /** Why an office tends to ask for this. Plain, and specific to the situation. */
  why: string;
  /** Where it usually comes from, when that can be said reliably. */
  howToGet?: string;
  present: boolean;
}

export interface ChecklistSummary {
  items: ChecklistItem[];
  /** Counted over commonly_asked_for items only: the bar people are measured against. */
  completed: number;
  total: number;
  missing: ChecklistItem[];
}

interface ChecklistInput {
  category?: IncidentCategory;
  impacts: ImpactType[];
  financialImpacts: FinancialImpactType[];
  hasFir?: boolean | null;
  /**
   * Whether the person has already received assistance.
   *
   * Read here rather than merely stored, because it changes what an office
   * will ask for: schemes routinely want to know what has already been paid,
   * and interim relief under the atrocity provisions is released in stages, so
   * the earlier sanction is the document that shows which stage you are at.
   */
  priorAssistance?: PriorAssistance;
  heldDocTypes: DocumentType[];
}

/**
 * The checklist for one person's situation, not a generic list of paperwork.
 *
 * A caste certificate appears only for a caste-based atrocity; a death
 * certificate only where a family member died. Showing everyone every document
 * turns the page into a wall and buries the two things that actually matter to
 * them.
 */
export function buildChecklist(input: ChecklistInput): ChecklistSummary {
  const held = new Set(input.heldDocTypes);
  const items: ChecklistItem[] = [];

  const add = (
    docType: DocumentType,
    group: ChecklistItem["group"],
    weight: ChecklistWeight,
    why: string,
    howToGet?: string
  ) => {
    items.push({ docType, group, weight, why, howToGet, present: held.has(docType) });
  };

  add(
    "identity",
    "Identity",
    "commonly_asked_for",
    "Almost every application asks you to show who you are.",
    "An Aadhaar card, voter ID, PAN card or passport is usually accepted."
  );

  if (input.hasFir) {
    add(
      "fir",
      "Police",
      "commonly_asked_for",
      "Compensation and legal aid applications usually ask for the FIR that records what happened.",
      "The police station that registered it can give you a copy. In Maharashtra some FIRs are also published online."
    );
  } else {
    add(
      "police_complaint",
      "Police",
      "may_help",
      "If you have made a complaint but no FIR has been registered, a copy of the complaint shows what you reported and when.",
      "Ask the police station for an acknowledgement of the complaint you filed."
    );
  }

  if (
    input.impacts.includes("physical_injury") ||
    input.impacts.includes("medical_expenses") ||
    input.financialImpacts.includes("medical_expenses")
  ) {
    add(
      "medical_report",
      "Medical",
      "commonly_asked_for",
      "You mentioned injury or medical costs, and these are usually supported by a medical record.",
      "The hospital or clinic that treated you holds this."
    );
  }

  if (input.category === "caste_based_atrocity") {
    add(
      "caste_certificate",
      "Identity",
      "commonly_asked_for",
      "Assistance under the SC/ST atrocity provisions is generally tied to a caste certificate.",
      "Issued by the revenue authority in your district, such as the Tehsildar's office."
    );
  }

  if (
    input.impacts.includes("disability") ||
    input.financialImpacts.includes("disability")
  ) {
    add(
      "disability_certificate",
      "Medical",
      "commonly_asked_for",
      "Where a disability has resulted, assistance usually depends on it being certified.",
      "Issued by a medical board at a government hospital."
    );
  }

  if (
    input.impacts.includes("death_of_family_member") ||
    input.financialImpacts.includes("death_of_family_member")
  ) {
    add(
      "death_certificate",
      "Identity",
      "commonly_asked_for",
      "Assistance to a family after a death is generally tied to the death certificate.",
      "Issued by the municipal corporation or gram panchayat where the death was registered."
    );
  }

  if (input.priorAssistance === "yes") {
    add(
      "prior_assistance_record",
      "Financial",
      "commonly_asked_for",
      "You said some assistance has already come through. Applications usually ask what that was, and the sanction or payment record is what answers it.",
      "The office that paid it can give you a copy of the sanction order. Your bank statement showing the credit also works."
    );
  }

  if (input.financialImpacts.length > 0) {
    add(
      "bank_details",
      "Financial",
      "commonly_asked_for",
      "Any money that is awarded has to be paid somewhere, so account details are asked for.",
      "A cancelled cheque or the first page of a passbook is usually enough."
    );
  }

  add(
    "court_document",
    "Legal",
    "may_help",
    "If the case has reached court, orders and the charge sheet help show where it has got to.",
    "Your lawyer, or the court's filing counter, can provide copies."
  );

  if (input.impacts.includes("property_damage") ||
      input.financialImpacts.includes("property_damage")) {
    add(
      "photo",
      "Other",
      "may_help",
      "Photographs of damage are often the clearest record of what was destroyed.",
      undefined
    );
  }

  const counted = items.filter((i) => i.weight === "commonly_asked_for");
  return {
    items,
    completed: counted.filter((i) => i.present).length,
    total: counted.length,
    missing: items.filter((i) => !i.present),
  };
}

// ---------------------------------------------------------------------------
// Next step
// ---------------------------------------------------------------------------

/** Where a next step sends the person. Matches the Recovery Hub view names. */
export type RecoveryDestination =
  | "recovery_hub"
  | "recovery_case_new"
  | "recovery_incident"
  | "recovery_fir"
  | "recovery_documents"
  | "recovery_legal_aid"
  | "recovery_financial"
  | "recovery_compensation"
  | "recovery_timeline";

export interface NextStep {
  /** Stable id, so a test can assert which rule fired. */
  id: string;
  /** One sentence, addressed to the person, describing one action. */
  title: string;
  /** Why this, now. Optional, and never a warning. */
  detail?: string;
  actionLabel: string;
  destination: RecoveryDestination;
}

interface NextStepInput {
  bundle: RecoveryCaseBundle | null;
  checklist?: ChecklistSummary;
}

/**
 * The single thing to do next.
 *
 * Ordered by what blocks what, not by how the spec is numbered: a person with
 * no incident recorded cannot usefully be asked about compensation documents,
 * and someone whose FIR question is unanswered is asked that before being
 * offered schemes that will ask for an FIR number.
 *
 * Always returns something. "Everything is up to date" is a state, not an
 * absence, and a blank space where the next step goes is the failure this
 * whole engine exists to prevent.
 */
export function nextStep({ bundle, checklist }: NextStepInput): NextStep {
  if (!bundle) {
    return {
      id: "create_case",
      title: "Start by opening a recovery file",
      detail: "It takes a minute, and you can add everything else whenever you're ready.",
      actionLabel: "Open a file",
      destination: "recovery_case_new",
    };
  }

  const { incident, fir, documents, legalAid, compensation } = bundle;

  if (!incident || !incident.category) {
    return {
      id: "incident_category",
      title: "Tell us what happened, in your own words",
      detail: "Only what you want to. You can stop and come back at any point.",
      actionLabel: "Continue",
      destination: "recovery_incident",
    };
  }

  // Files opened before the intake required these can still reach here empty,
  // and they are what every compensation form asks for first.
  if (!incident.occurredOn && !incident.occurredTimeNote) {
    return {
      id: "incident_when",
      title: "Add when this happened",
      detail: "An approximate answer is fine if you don't remember the exact date.",
      actionLabel: "Continue",
      destination: "recovery_incident",
    };
  }

  if (!incident.location && !incident.district) {
    return {
      id: "incident_where",
      title: "Add where this happened",
      detail: "A place or a district. Applications ask which area it falls in.",
      actionLabel: "Continue",
      destination: "recovery_incident",
    };
  }

  if (!incident.account) {
    return {
      id: "incident_account",
      title: "Add your account of what happened",
      detail: "You can type it or speak it. What you write stays in your words.",
      actionLabel: "Continue",
      destination: "recovery_incident",
    };
  }

  if (incident.impacts.length === 0) {
    return {
      id: "incident_impacts",
      title: "Tell us how this has affected you",
      detail: "Your document checklist and the support we show you are built from this.",
      actionLabel: "Continue",
      destination: "recovery_incident",
    };
  }

  if (!fir || fir.hasFir === null || fir.hasFir === undefined) {
    return {
      id: "fir_question",
      title: "Let us know whether an FIR has been registered",
      detail: "If there isn't one, we'll explain how the process usually works.",
      actionLabel: "Continue",
      destination: "recovery_fir",
    };
  }

  if (fir.hasFir && !fir.firNumber) {
    return {
      id: "fir_details",
      title: "Add your FIR number and police station",
      detail: "Applications ask for these, so having them saved here saves you looking later.",
      actionLabel: "Add FIR details",
      destination: "recovery_fir",
    };
  }

  if (!fir.hasFir) {
    return {
      id: "fir_process",
      title: "Read how reporting to the police usually works",
      detail: "AURA cannot register an FIR. This explains who can, and where.",
      actionLabel: "Read this",
      destination: "recovery_fir",
    };
  }

  if (checklist && checklist.missing.some((m) => m.weight === "commonly_asked_for")) {
    const first = checklist.missing.find((m) => m.weight === "commonly_asked_for")!;
    return {
      id: `document_${first.docType}`,
      title: `Add your ${DOCUMENT_LABELS[first.docType].toLowerCase()}`,
      detail: first.why,
      actionLabel: "Add document",
      destination: "recovery_documents",
    };
  }

  if (documents.length === 0) {
    return {
      id: "documents_empty",
      title: "Put your documents somewhere you can find them",
      detail: "Anything you already have. You can add the rest later.",
      actionLabel: "Open document centre",
      destination: "recovery_documents",
    };
  }

  if (legalAid.length === 0) {
    return {
      id: "legal_aid_explore",
      title: "See whether you can get a lawyer at no cost",
      detail: "Legal services authorities provide free representation to many people.",
      actionLabel: "Read about legal aid",
      destination: "recovery_legal_aid",
    };
  }

  const openLegalAid = legalAid.find(
    (a) => a.status !== "COMPLETED" && a.status !== "CLOSED" && a.status !== "REJECTED"
  );
  if (openLegalAid && !openLegalAid.applicationNumber) {
    return {
      id: "legal_aid_number",
      title: "Add your legal aid application number",
      detail: "The diary number you were given when you applied is what tracking asks for.",
      actionLabel: "Add the number",
      destination: "recovery_legal_aid",
    };
  }

  if (bundle.case.financialImpacts.length === 0) {
    return {
      id: "financial_explore",
      title: "Look at what financial support might apply",
      detail: "A few questions about costs, and we'll show what may be worth reading.",
      actionLabel: "Explore support",
      destination: "recovery_financial",
    };
  }

  if (!bundle.case.priorAssistance) {
    return {
      id: "financial_prior_assistance",
      title: "Tell us whether any assistance has already come through",
      detail: "It changes what an application will ask you for, so it is worth answering either way.",
      actionLabel: "Answer this",
      destination: "recovery_financial",
    };
  }

  if (compensation.length === 0) {
    return {
      id: "compensation_explore",
      title: "Prepare a compensation application",
      detail: "We'll fill in what you've already told us so you aren't typing it twice.",
      actionLabel: "Start preparing",
      destination: "recovery_compensation",
    };
  }

  const openCompensation = compensation.find(
    (a) => a.status !== "COMPLETED" && a.status !== "CLOSED" && a.status !== "REJECTED"
  );
  if (openCompensation && !openCompensation.applicationNumber) {
    return {
      id: "compensation_number",
      title: "Add your compensation application number",
      detail: "Once you've submitted on the official portal, saving the number here keeps it safe.",
      actionLabel: "Add the number",
      destination: "recovery_compensation",
    };
  }

  if (openCompensation) {
    return {
      id: "compensation_track",
      title: "Check where your compensation application has got to",
      detail: "Tracking happens on the official portal using your diary number.",
      actionLabel: "Open tracking",
      destination: "recovery_compensation",
    };
  }

  return {
    id: "all_current",
    title: "Everything you've told us is up to date",
    detail: "Nothing is waiting on you. Come back whenever something changes.",
    actionLabel: "View your timeline",
    destination: "recovery_timeline",
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface RecoveryProgress {
  /** 0-100. A view of how much of the file is filled in, never of how the case will go. */
  percent: number;
  /** The furthest stage with anything recorded against it. */
  stage: TimelineStage;
  completedStages: TimelineStage[];
}

/**
 * How far through the file a person is.
 *
 * Measures what has been recorded, not how the case is going. A bar that rose
 * as a case "progressed" would be reading a court's behaviour off a form, and
 * would fall when nothing had actually gone wrong.
 */
export function recoveryProgress(bundle: RecoveryCaseBundle | null): RecoveryProgress {
  if (!bundle) {
    return { percent: 0, stage: "incident", completedStages: [] };
  }

  const done = new Set<TimelineStage>();
  if (bundle.incident?.category) done.add("incident");
  if (bundle.fir?.hasFir === false || bundle.fir?.firNumber) done.add("complaint");
  if (bundle.fir?.firNumber) done.add("fir");
  for (const e of bundle.timeline) {
    if (e.status === "COMPLETED" || e.status === "APPROVED") done.add(e.stage);
  }
  if (bundle.compensation.some((c) => c.status === "SUBMITTED" ||
                                      c.status === "UNDER_REVIEW" ||
                                      c.status === "APPROVED")) {
    done.add("compensation");
  }
  if (bundle.case.status === "CLOSED") done.add("closure");

  const completedStages = TIMELINE_STAGE_ORDER.filter((s) => done.has(s));
  const furthest =
    [...TIMELINE_STAGE_ORDER].reverse().find((s) => done.has(s)) ?? "incident";

  return {
    percent: Math.round((completedStages.length / TIMELINE_STAGE_ORDER.length) * 100),
    stage: furthest,
    completedStages,
  };
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderDraft {
  kind: string;
  /** Safe in an out-of-app preview: no case detail, no FIR number, no scheme. */
  title: string;
  body: string;
}

/**
 * What is worth telling someone about, given the state of their file.
 *
 * Titles carry no case detail because a title may surface in an email subject
 * or a lock-screen preview, and a phone that other people look at is the normal
 * case for this population rather than the exception.
 */
export function pendingReminders(
  bundle: RecoveryCaseBundle | null,
  checklist: ChecklistSummary | undefined,
  now: Date
): ReminderDraft[] {
  if (!bundle) return [];
  const out: ReminderDraft[] = [];
  const DAY = 86_400_000;

  if (checklist && checklist.completed < checklist.total) {
    out.push({
      kind: "documents_incomplete",
      title: "Something is waiting in your recovery file",
      // No count here on purpose. An unread reminder of a given kind is never
      // replaced, so a number written into this body freezes while the real
      // checklist moves on, and the two then disagree on screen. The document
      // centre shows the live figure.
      body: "Your document checklist isn't complete yet.",
    });
  }

  const missingLegalAidNumber = bundle.legalAid.some(
    (a) => !a.applicationNumber && a.status !== "NOT_STARTED"
  );
  if (missingLegalAidNumber) {
    out.push({
      kind: "legal_aid_number_missing",
      title: "An application number hasn't been added",
      body: "Your legal aid application number is not saved yet.",
    });
  }

  const missingCompensationNumber = bundle.compensation.some(
    (a) => !a.applicationNumber && a.status === "SUBMITTED"
  );
  if (missingCompensationNumber) {
    out.push({
      kind: "compensation_number_missing",
      title: "An application number hasn't been added",
      body: "Your compensation application number is not saved yet.",
    });
  }

  for (const a of [...bundle.legalAid, ...bundle.compensation]) {
    if (a.nextFollowUpOn && new Date(a.nextFollowUpOn).getTime() <= now.getTime()) {
      out.push({
        kind: "follow_up_due",
        title: "A follow-up date you set has arrived",
        body: "You asked to be reminded to follow up on an application today.",
      });
      break;
    }
  }

  const lastTouch = new Date(bundle.case.updatedAt).getTime();
  if (now.getTime() - lastTouch > 30 * DAY && bundle.case.status !== "CLOSED") {
    out.push({
      kind: "case_stale",
      title: "It has been a while since you updated your file",
      body: "Nothing is wrong. If anything has changed, you can add it whenever you like.",
    });
  }

  return out;
}
