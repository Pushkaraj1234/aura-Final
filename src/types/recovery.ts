/**
 * Victim Recovery Hub types.
 *
 * Kept in their own file rather than added to types/index.ts because this data
 * has a different owner and a different access rule from everything else in
 * AURA. The rest of the app models a person as a participant that staff are
 * entitled to see; a recovery case is the person's own administrative file and
 * no counsellor can read it. Mixing the two in one file invites somebody to
 * reach for `Participant` when they mean `RecoveryCase`.
 *
 * TWO IDEAS RUN THROUGH ALL OF THIS
 *
 * Status and verification are separate. "Under review" is a claim; who is
 * making the claim is a different fact. AURA has no authorised feed from any
 * police, court or compensation system, so almost everything here is
 * USER_REPORTED and the UI has to keep saying so. A survivor who plans around
 * a status this app invented has been actively harmed, which is the whole
 * reason the two fields never collapse into one.
 *
 * Nothing infers anything legal. The category a person picks is what they
 * picked. The resources shown are ones that MAY be relevant. Eligibility is
 * decided by an authority, never here.
 */

// ---------------------------------------------------------------------------
// Status vocabulary
// ---------------------------------------------------------------------------

/**
 * Where a piece of work has got to. Mirrors the check constraint in
 * 20260916120000_recovery_hub.sql; the database is the authority and this list
 * must not drift from it.
 */
export type RecoveryStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "VERIFICATION_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CLOSED";

/**
 * How we came to believe something.
 *
 * OFFICIALLY_VERIFIED means an authoritative source said it, not that the user
 * typed it confidently or that a screenshot looked convincing. Nothing in this
 * codebase writes that value today, because there is no integration that could
 * justify it.
 */
export type RecoveryVerification =
  | "USER_REPORTED"
  | "DOCUMENT_VERIFIED"
  | "OFFICIALLY_VERIFIED";

export const RECOVERY_STATUS_LABELS: Record<RecoveryStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  VERIFICATION_REQUIRED: "Verification needed",
  APPROVED: "Approved",
  REJECTED: "Not approved",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

export const RECOVERY_VERIFICATION_LABELS: Record<RecoveryVerification, string> = {
  USER_REPORTED: "You told us this",
  DOCUMENT_VERIFIED: "From a document you uploaded",
  OFFICIALLY_VERIFIED: "From an official source",
};

// ---------------------------------------------------------------------------
// Incident
// ---------------------------------------------------------------------------

export type IncidentCategory =
  | "physical_violence"
  | "sexual_violence"
  | "caste_based_atrocity"
  | "communal_violence"
  | "threat_intimidation"
  | "property_destruction"
  | "discrimination"
  | "trafficking_exploitation"
  | "other"
  | "unknown";

export type ImpactType =
  | "physical_injury"
  | "emotional_impact"
  | "medical_expenses"
  | "loss_of_income"
  | "property_damage"
  | "disability"
  | "death_of_family_member"
  | "displacement"
  | "other";

export type FinancialImpactType =
  | "medical_expenses"
  | "loss_of_income"
  | "disability"
  | "property_damage"
  | "death_of_family_member"
  | "rehabilitation_expenses"
  | "education_disruption"
  | "housing_displacement"
  | "other";

/** Answer to "have you already received financial assistance?" */
export type PriorAssistance = "yes" | "no" | "unsure";

/** How the person gave their account. Recorded, never used to weight it. */
export type AccountSource = "typed" | "voice";

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentType =
  | "fir"
  | "police_complaint"
  | "medical_report"
  | "identity"
  | "caste_certificate"
  | "disability_certificate"
  | "death_certificate"
  | "court_document"
  | "bank_details"
  | "prior_assistance_record"
  | "photo"
  | "video"
  | "other";

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/**
 * The stages of a case as a person experiences it, in order.
 *
 * Not the same vocabulary as RecoveryStatus, deliberately: "investigation" is
 * a stage of a criminal case, "UNDER_REVIEW" is a state of a form. Collapsing
 * them would make the timeline describe paperwork rather than what is
 * happening to the person.
 */
export type TimelineStage =
  | "incident"
  | "complaint"
  | "fir"
  | "investigation"
  | "charge_sheet"
  | "court"
  | "compensation"
  | "recovery"
  | "closure";

export const TIMELINE_STAGE_ORDER: TimelineStage[] = [
  "incident",
  "complaint",
  "fir",
  "investigation",
  "charge_sheet",
  "court",
  "compensation",
  "recovery",
  "closure",
];

export const TIMELINE_STAGE_LABELS: Record<TimelineStage, string> = {
  incident: "Incident recorded",
  complaint: "Complaint submitted",
  fir: "FIR registered",
  investigation: "Investigation",
  charge_sheet: "Charge sheet",
  court: "Court proceedings",
  compensation: "Compensation",
  recovery: "Recovery",
  closure: "Closure",
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface RecoveryCase {
  id: string;
  ownerId: string;
  displayName?: string;
  contactPhone?: string;
  contactEmail?: string;
  state?: string;
  district?: string;
  language: string;
  status: RecoveryStatus;
  financialImpacts: FinancialImpactType[];
  priorAssistance?: PriorAssistance;
  openedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryIncident {
  id: string;
  caseId: string;
  category?: IncidentCategory;
  occurredOn?: string;
  occurredTimeNote?: string;
  location?: string;
  state?: string;
  district?: string;
  policeStation?: string;
  /** The person's own words. Never rewritten. */
  account?: string;
  accountSource?: AccountSource;
  impacts: ImpactType[];
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryFir {
  id: string;
  caseId: string;
  /** null means "not asked yet", which is not the same as "no FIR". */
  hasFir?: boolean | null;
  firNumber?: string;
  firYear?: number;
  policeStation?: string;
  district?: string;
  firDate?: string;
  caseStage?: string;
  verification: RecoveryVerification;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryTimelineEvent {
  id: string;
  caseId: string;
  stage: TimelineStage;
  occurredOn?: string;
  status: RecoveryStatus;
  description?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceCheckedOn?: string;
  verification: RecoveryVerification;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryDocument {
  id: string;
  caseId: string;
  docType: DocumentType;
  label?: string;
  storagePath: string;
  mimeType?: string;
  sizeBytes?: number;
  verification: RecoveryVerification;
  uploadedAt: string;
}

export interface LegalAidApplication {
  id: string;
  caseId: string;
  applicationNumber?: string;
  appliedOn?: string;
  authority?: string;
  lawyerName?: string;
  lawyerContact?: string;
  status: RecoveryStatus;
  verification: RecoveryVerification;
  nextFollowUpOn?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationApplication {
  id: string;
  caseId: string;
  /** Key into OFFICIAL_RESOURCES, not a URL, so a portal move cannot orphan it. */
  schemeKey?: string;
  applicationNumber?: string;
  appliedOn?: string;
  authority?: string;
  status: RecoveryStatus;
  verification: RecoveryVerification;
  nextFollowUpOn?: string;
  notes?: string;
  /** Answers prepared in the guided workflow, for review before submission. */
  draft: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryNotification {
  id: string;
  ownerId: string;
  caseId?: string;
  kind: string;
  /** Written to be safe in an out-of-app preview. No case detail. */
  title: string;
  body?: string;
  readAt?: string;
  createdAt: string;
}

/** Everything about one case, loaded together for the dashboard. */
export interface RecoveryCaseBundle {
  case: RecoveryCase;
  incident: RecoveryIncident | null;
  fir: RecoveryFir | null;
  timeline: RecoveryTimelineEvent[];
  documents: RecoveryDocument[];
  legalAid: LegalAidApplication[];
  compensation: CompensationApplication[];
}
