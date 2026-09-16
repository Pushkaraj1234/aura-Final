import { supabase } from "./supabaseClient";
import type {
  CompensationApplication,
  DocumentType,
  LegalAidApplication,
  RecoveryCase,
  RecoveryCaseBundle,
  RecoveryDocument,
  RecoveryFir,
  RecoveryIncident,
  RecoveryNotification,
  RecoveryTimelineEvent,
} from "../types/recovery";

/**
 * Persistence for the Recovery Hub.
 *
 * NOTHING HERE TOUCHES localStorage, AND THAT IS THE POINT.
 *
 * participantStore keeps check-ins, notes and alerts in localStorage under
 * aura_participants_v2, which is defensible for a demo of clinical trend data.
 * It is not defensible for this. An FIR number, a caste certificate and an
 * account of an assault, sitting unencrypted in a browser profile, is a file
 * waiting to be found on a shared or confiscated phone, for the population
 * least able to absorb that. AURA already ships a quick-exit button because
 * people's devices get checked.
 *
 * So every read and write below goes to Supabase, where row level security
 * enforces `owner_id = auth.uid()`, and the only thing that persists locally is
 * the session token the rest of the app already relies on.
 *
 * WHY THE CLIENT TALKS TO SUPABASE DIRECTLY
 *
 * The Express API exists for work that needs a server: model calls, Bhashini,
 * the admin service role. None of that applies here, and routing this through
 * the server would mean re-implementing ownership checks in application code
 * that the database already enforces. Fewer places to get it wrong.
 *
 * ERRORS SURFACE, THEY DO NOT GET SWALLOWED
 *
 * Every method either returns data or throws with the message the caller shows.
 * The pattern elsewhere in this codebase of warning to the console and
 * returning null would, here, mean a person believing their FIR number was
 * saved when it was not.
 */

const DOCUMENT_BUCKET = "recovery-documents";

/** 15 MB, matching the limit set on the bucket itself. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/** Matches allowed_mime_types on the bucket. Storage rejects anything else. */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const fail = (op: string, error: { message?: string } | null): never => {
  throw new Error(`${op}: ${error?.message || "something went wrong"}`);
};

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    throw new Error("You need to be signed in to open your recovery file.");
  }
  return data.session.user.id;
}

// ---------------------------------------------------------------------------
// Row mapping
//
// Written out rather than generated, because a silent rename between a column
// and a field here would lose somebody's FIR number without any error.
// ---------------------------------------------------------------------------

const toCase = (r: any): RecoveryCase => ({
  id: r.id,
  ownerId: r.owner_id,
  displayName: r.display_name ?? undefined,
  contactPhone: r.contact_phone ?? undefined,
  contactEmail: r.contact_email ?? undefined,
  state: r.state ?? undefined,
  district: r.district ?? undefined,
  language: r.language ?? "en",
  status: r.status,
  financialImpacts: r.financial_impacts ?? [],
  priorAssistance: r.prior_assistance ?? undefined,
  openedAt: r.opened_at,
  closedAt: r.closed_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toIncident = (r: any): RecoveryIncident => ({
  id: r.id,
  caseId: r.case_id,
  category: r.category ?? undefined,
  occurredOn: r.occurred_on ?? undefined,
  occurredTimeNote: r.occurred_time_note ?? undefined,
  location: r.location ?? undefined,
  state: r.state ?? undefined,
  district: r.district ?? undefined,
  policeStation: r.police_station ?? undefined,
  account: r.account ?? undefined,
  accountSource: r.account_source ?? undefined,
  impacts: r.impacts ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toFir = (r: any): RecoveryFir => ({
  id: r.id,
  caseId: r.case_id,
  hasFir: r.has_fir,
  firNumber: r.fir_number ?? undefined,
  firYear: r.fir_year ?? undefined,
  policeStation: r.police_station ?? undefined,
  district: r.district ?? undefined,
  firDate: r.fir_date ?? undefined,
  caseStage: r.case_stage ?? undefined,
  verification: r.verification,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTimelineEvent = (r: any): RecoveryTimelineEvent => ({
  id: r.id,
  caseId: r.case_id,
  stage: r.stage,
  occurredOn: r.occurred_on ?? undefined,
  status: r.status,
  description: r.description ?? undefined,
  sourceName: r.source_name ?? undefined,
  sourceUrl: r.source_url ?? undefined,
  sourceCheckedOn: r.source_checked_on ?? undefined,
  verification: r.verification,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toDocument = (r: any): RecoveryDocument => ({
  id: r.id,
  caseId: r.case_id,
  docType: r.doc_type,
  label: r.label ?? undefined,
  storagePath: r.storage_path,
  mimeType: r.mime_type ?? undefined,
  sizeBytes: r.size_bytes ?? undefined,
  verification: r.verification,
  uploadedAt: r.uploaded_at,
});

const toLegalAid = (r: any): LegalAidApplication => ({
  id: r.id,
  caseId: r.case_id,
  applicationNumber: r.application_number ?? undefined,
  appliedOn: r.applied_on ?? undefined,
  authority: r.authority ?? undefined,
  lawyerName: r.lawyer_name ?? undefined,
  lawyerContact: r.lawyer_contact ?? undefined,
  status: r.status,
  verification: r.verification,
  nextFollowUpOn: r.next_follow_up_on ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toCompensation = (r: any): CompensationApplication => ({
  id: r.id,
  caseId: r.case_id,
  schemeKey: r.scheme_key ?? undefined,
  applicationNumber: r.application_number ?? undefined,
  appliedOn: r.applied_on ?? undefined,
  authority: r.authority ?? undefined,
  status: r.status,
  verification: r.verification,
  nextFollowUpOn: r.next_follow_up_on ?? undefined,
  notes: r.notes ?? undefined,
  draft: r.draft ?? {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toNotification = (r: any): RecoveryNotification => ({
  id: r.id,
  ownerId: r.owner_id,
  caseId: r.case_id ?? undefined,
  kind: r.kind,
  title: r.title,
  body: r.body ?? undefined,
  readAt: r.read_at ?? undefined,
  createdAt: r.created_at,
});

/** Drops undefined keys so a partial update never nulls a column it omitted. */
const defined = <T extends Record<string, unknown>>(patch: T): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const recoveryService = {
  // -- cases ----------------------------------------------------------------

  async listCases(): Promise<RecoveryCase[]> {
    await requireUserId();
    const { data, error } = await supabase
      .from("recovery_cases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) fail("Could not load your recovery files", error);
    return (data ?? []).map(toCase);
  },

  /**
   * Opens a file.
   *
   * The id comes from the database default (VR-YYYY-NNNNN), never from the
   * client: a client-chosen id is a client-chosen collision.
   */
  async createCase(fields: {
    displayName?: string;
    contactPhone?: string;
    contactEmail?: string;
    state?: string;
    district?: string;
    language?: string;
  }): Promise<RecoveryCase> {
    const ownerId = await requireUserId();
    const { data, error } = await supabase
      .from("recovery_cases")
      .insert({
        owner_id: ownerId,
        display_name: fields.displayName || null,
        contact_phone: fields.contactPhone || null,
        contact_email: fields.contactEmail || null,
        state: fields.state || null,
        district: fields.district || null,
        language: fields.language || "en",
      })
      .select("*")
      .single();
    if (error || !data) fail("Could not open your recovery file", error);

    const created = toCase(data);
    await recoveryService.log(created.id, "case_created", {});
    // The first timeline entry, so the file is never an empty page.
    await recoveryService.addTimelineEvent(created.id, {
      stage: "incident",
      status: "IN_PROGRESS",
      description: "Recovery file opened.",
      verification: "USER_REPORTED",
    });
    return created;
  },

  async updateCase(id: string, patch: Partial<RecoveryCase>): Promise<RecoveryCase> {
    await requireUserId();
    const { data, error } = await supabase
      .from("recovery_cases")
      .update(
        defined({
          display_name: patch.displayName,
          contact_phone: patch.contactPhone,
          contact_email: patch.contactEmail,
          state: patch.state,
          district: patch.district,
          language: patch.language,
          status: patch.status,
          financial_impacts: patch.financialImpacts,
          prior_assistance: patch.priorAssistance,
          closed_at: patch.closedAt,
        })
      )
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) fail("Could not save your changes", error);
    return toCase(data);
  },

  /** Everything for the dashboard, in one round trip per table. */
  async loadBundle(caseId: string): Promise<RecoveryCaseBundle> {
    await requireUserId();
    const [c, incident, fir, timeline, documents, legalAid, compensation] =
      await Promise.all([
        supabase.from("recovery_cases").select("*").eq("id", caseId).single(),
        supabase.from("recovery_incidents").select("*").eq("case_id", caseId).maybeSingle(),
        supabase.from("recovery_firs").select("*").eq("case_id", caseId).maybeSingle(),
        supabase
          .from("recovery_timeline_events")
          .select("*")
          .eq("case_id", caseId)
          .order("occurred_on", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true }),
        supabase
          .from("recovery_documents")
          .select("*")
          .eq("case_id", caseId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("recovery_legal_aid_applications")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recovery_compensation_applications")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
      ]);

    if (c.error || !c.data) fail("Could not load your recovery file", c.error);

    return {
      case: toCase(c.data),
      incident: incident.data ? toIncident(incident.data) : null,
      fir: fir.data ? toFir(fir.data) : null,
      timeline: (timeline.data ?? []).map(toTimelineEvent),
      documents: (documents.data ?? []).map(toDocument),
      legalAid: (legalAid.data ?? []).map(toLegalAid),
      compensation: (compensation.data ?? []).map(toCompensation),
    };
  },

  /**
   * Deletes a file and everything in it, including stored objects.
   *
   * Objects first: the rows carry the storage paths, so deleting rows first
   * would orphan the files with nothing left pointing at them.
   */
  async deleteCase(caseId: string): Promise<void> {
    await requireUserId();
    const { data: docs } = await supabase
      .from("recovery_documents")
      .select("storage_path")
      .eq("case_id", caseId);
    const paths = (docs ?? []).map((d: any) => d.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove(paths);
    }
    const { error } = await supabase.from("recovery_cases").delete().eq("id", caseId);
    if (error) fail("Could not delete your recovery file", error);
  },

  // -- incident -------------------------------------------------------------

  async saveIncident(
    caseId: string,
    patch: Partial<RecoveryIncident>
  ): Promise<RecoveryIncident> {
    await requireUserId();
    const { data: existing } = await supabase
      .from("recovery_incidents")
      .select("id")
      .eq("case_id", caseId)
      .maybeSingle();

    const row = defined({
      category: patch.category,
      occurred_on: patch.occurredOn,
      occurred_time_note: patch.occurredTimeNote,
      location: patch.location,
      state: patch.state,
      district: patch.district,
      police_station: patch.policeStation,
      account: patch.account,
      account_source: patch.accountSource,
      impacts: patch.impacts,
    });

    const query = existing
      ? supabase.from("recovery_incidents").update(row).eq("id", existing.id)
      : supabase
          .from("recovery_incidents")
          .insert({ ...row, id: newId("inc"), case_id: caseId });

    const { data, error } = await query.select("*").single();
    if (error || !data) fail("Could not save what you told us", error);
    return toIncident(data);
  },

  // -- FIR ------------------------------------------------------------------

  async saveFir(caseId: string, patch: Partial<RecoveryFir>): Promise<RecoveryFir> {
    await requireUserId();
    const { data: existing } = await supabase
      .from("recovery_firs")
      .select("id")
      .eq("case_id", caseId)
      .maybeSingle();

    const row = defined({
      has_fir: patch.hasFir,
      fir_number: patch.firNumber,
      fir_year: patch.firYear,
      police_station: patch.policeStation,
      district: patch.district,
      fir_date: patch.firDate,
      case_stage: patch.caseStage,
      // Never widened here. Only a verified document or an authorised source
      // may move this off USER_REPORTED, and neither exists yet.
      verification: patch.verification,
    });

    const query = existing
      ? supabase.from("recovery_firs").update(row).eq("id", existing.id)
      : supabase.from("recovery_firs").insert({ ...row, id: newId("fir"), case_id: caseId });

    const { data, error } = await query.select("*").single();
    if (error || !data) fail("Could not save the FIR details", error);
    return toFir(data);
  },

  // -- timeline -------------------------------------------------------------

  async addTimelineEvent(
    caseId: string,
    event: Partial<RecoveryTimelineEvent> & Pick<RecoveryTimelineEvent, "stage">
  ): Promise<RecoveryTimelineEvent> {
    await requireUserId();
    const { data, error } = await supabase
      .from("recovery_timeline_events")
      .insert({
        id: newId("tl"),
        case_id: caseId,
        stage: event.stage,
        occurred_on: event.occurredOn ?? null,
        status: event.status ?? "NOT_STARTED",
        description: event.description ?? null,
        source_name: event.sourceName ?? null,
        source_url: event.sourceUrl ?? null,
        source_checked_on: event.sourceCheckedOn ?? null,
        verification: event.verification ?? "USER_REPORTED",
        notes: event.notes ?? null,
      })
      .select("*")
      .single();
    if (error || !data) fail("Could not add to your timeline", error);
    return toTimelineEvent(data);
  },

  async updateTimelineEvent(
    id: string,
    patch: Partial<RecoveryTimelineEvent>
  ): Promise<RecoveryTimelineEvent> {
    await requireUserId();
    const { data, error } = await supabase
      .from("recovery_timeline_events")
      .update(
        defined({
          stage: patch.stage,
          occurred_on: patch.occurredOn,
          status: patch.status,
          description: patch.description,
          notes: patch.notes,
          verification: patch.verification,
        })
      )
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) fail("Could not update that timeline entry", error);
    return toTimelineEvent(data);
  },

  async deleteTimelineEvent(id: string): Promise<void> {
    await requireUserId();
    const { error } = await supabase.from("recovery_timeline_events").delete().eq("id", id);
    if (error) fail("Could not remove that timeline entry", error);
  },

  // -- documents ------------------------------------------------------------

  /**
   * Uploads one file.
   *
   * The path always starts with the owner's uid, because that first segment is
   * what the storage policy checks. Type and size are validated here for a
   * clear message, and again by the bucket, which is the check that actually
   * holds: a modified client can skip the first but not the second.
   *
   * AURA does not scan uploads for malware. The document centre says so.
   */
  async uploadDocument(
    caseId: string,
    file: File,
    docType: DocumentType,
    label?: string
  ): Promise<RecoveryDocument> {
    const ownerId = await requireUserId();

    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error(
        "That file is larger than 15 MB. Your existing documents are safe."
      );
    }
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      throw new Error(
        "That file type isn't accepted. PDF and photo files work. Your existing documents are safe."
      );
    }

    const id = newId("doc");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const storagePath = `${ownerId}/${caseId}/${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      throw new Error(
        `We couldn't upload this document. Your existing documents are safe. (${uploadError.message})`
      );
    }

    const { data, error } = await supabase
      .from("recovery_documents")
      .insert({
        id,
        case_id: caseId,
        doc_type: docType,
        label: label || null,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("*")
      .single();

    if (error || !data) {
      // The row is the index; an object with no row is unreachable, so take it
      // back out rather than leaving it paid for and invisible.
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      fail("We couldn't save this document. Your existing documents are safe", error);
    }

    await recoveryService.log(caseId, "document_uploaded", { docType });
    return toDocument(data);
  },

  /**
   * A short-lived link to one document.
   *
   * Signed and expiring rather than public: a link that works forever is a link
   * that works after it has been forwarded, screenshotted or left in a browser
   * history somebody else reads.
   */
  async documentUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
    await requireUserId();
    const { data, error } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) fail("Could not open that document", error);
    return data.signedUrl;
  },

  async deleteDocument(doc: RecoveryDocument): Promise<void> {
    await requireUserId();
    await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.storagePath]);
    const { error } = await supabase.from("recovery_documents").delete().eq("id", doc.id);
    if (error) fail("Could not remove that document", error);
    await recoveryService.log(doc.caseId, "document_deleted", { docType: doc.docType });
  },

  // -- legal aid ------------------------------------------------------------

  async saveLegalAid(
    caseId: string,
    patch: Partial<LegalAidApplication> & { id?: string }
  ): Promise<LegalAidApplication> {
    await requireUserId();
    const row = defined({
      application_number: patch.applicationNumber,
      applied_on: patch.appliedOn,
      authority: patch.authority,
      lawyer_name: patch.lawyerName,
      lawyer_contact: patch.lawyerContact,
      status: patch.status,
      next_follow_up_on: patch.nextFollowUpOn,
      notes: patch.notes,
    });

    const query = patch.id
      ? supabase.from("recovery_legal_aid_applications").update(row).eq("id", patch.id)
      : supabase
          .from("recovery_legal_aid_applications")
          .insert({ ...row, id: newId("la"), case_id: caseId });

    const { data, error } = await query.select("*").single();
    if (error || !data) fail("Could not save the legal aid details", error);
    return toLegalAid(data);
  },

  async deleteLegalAid(id: string): Promise<void> {
    await requireUserId();
    const { error } = await supabase
      .from("recovery_legal_aid_applications")
      .delete()
      .eq("id", id);
    if (error) fail("Could not remove that application", error);
  },

  // -- compensation ---------------------------------------------------------

  async saveCompensation(
    caseId: string,
    patch: Partial<CompensationApplication> & { id?: string }
  ): Promise<CompensationApplication> {
    await requireUserId();
    const row = defined({
      scheme_key: patch.schemeKey,
      application_number: patch.applicationNumber,
      applied_on: patch.appliedOn,
      authority: patch.authority,
      status: patch.status,
      next_follow_up_on: patch.nextFollowUpOn,
      notes: patch.notes,
      draft: patch.draft,
    });

    const query = patch.id
      ? supabase.from("recovery_compensation_applications").update(row).eq("id", patch.id)
      : supabase
          .from("recovery_compensation_applications")
          .insert({ ...row, id: newId("comp"), case_id: caseId });

    const { data, error } = await query.select("*").single();
    if (error || !data) fail("Could not save the application", error);
    return toCompensation(data);
  },

  async deleteCompensation(id: string): Promise<void> {
    await requireUserId();
    const { error } = await supabase
      .from("recovery_compensation_applications")
      .delete()
      .eq("id", id);
    if (error) fail("Could not remove that application", error);
  },

  /**
   * Everything in the file, as a file the person can keep.
   *
   * §21 asks for export alongside deletion, and the two belong together: being
   * able to leave without losing what you recorded is what makes deletion a
   * real choice rather than a threat. Documents are listed by name and type
   * rather than embedded, because a survivor's certificates inside a JSON blob
   * in a Downloads folder is the device-search problem again, one directory
   * over. The originals stay in the document centre, where they can be opened
   * one at a time through a link that expires.
   */
  async exportCase(caseId: string): Promise<string> {
    const bundle = await recoveryService.loadBundle(caseId);
    await recoveryService.log(caseId, "case_exported", {});
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        note:
          "Your own copy of your AURA Recovery Hub file. Statuses here are what " +
          "you recorded; AURA has no connection to any police, court or " +
          "compensation system. Uploaded documents are listed but not included.",
        case: bundle.case,
        incident: bundle.incident,
        fir: bundle.fir,
        timeline: bundle.timeline,
        documents: bundle.documents.map((d) => ({
          docType: d.docType,
          label: d.label,
          uploadedAt: d.uploadedAt,
          sizeBytes: d.sizeBytes,
        })),
        legalAid: bundle.legalAid,
        compensation: bundle.compensation,
      },
      null,
      2
    );
  },

  // -- notifications --------------------------------------------------------

  async listNotifications(): Promise<RecoveryNotification[]> {
    await requireUserId();
    const { data, error } = await supabase
      .from("recovery_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) fail("Could not load your reminders", error);
    return (data ?? []).map(toNotification);
  },

  /**
   * Records a reminder, unless the same one is already sitting unread.
   *
   * Without the guard, every dashboard load would add another copy of "your
   * checklist is incomplete" until the list is nothing but that sentence.
   */
  async pushNotification(
    caseId: string | null,
    kind: string,
    title: string,
    body?: string
  ): Promise<void> {
    const ownerId = await requireUserId();
    const { data: existing } = await supabase
      .from("recovery_notifications")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("kind", kind)
      .is("read_at", null)
      .limit(1);
    if (existing && existing.length > 0) return;

    await supabase.from("recovery_notifications").insert({
      id: newId("rn"),
      owner_id: ownerId,
      case_id: caseId,
      kind,
      title,
      body: body ?? null,
    });
  },

  async markNotificationRead(id: string): Promise<void> {
    await requireUserId();
    await supabase
      .from("recovery_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  },

  // -- audit ----------------------------------------------------------------

  /**
   * Append-only. Best effort by design: a failed log line must never stop a
   * person saving their own FIR number, and there is no UPDATE or DELETE policy
   * on the table, so nothing written here can be rewritten later.
   */
  async log(caseId: string | null, action: string, detail: Record<string, unknown>) {
    try {
      const ownerId = await requireUserId();
      await supabase.from("recovery_audit_log").insert({
        id: newId("rlog"),
        owner_id: ownerId,
        case_id: caseId,
        action,
        detail,
      });
    } catch {
      /* logging must not become the thing that breaks the save */
    }
  },
};
