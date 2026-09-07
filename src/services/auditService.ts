import {
  AuditEvent,
  AuditEventActorRole,
  AuditEventCategory,
  AuditEventSeverity
} from "../types";
import { apiService } from "./apiService";

const AUDIT_STORAGE_KEY = "aura_audit_events_v2";
const LEGACY_STORAGE_KEY = "aura_audit_logs_v2";

export interface CreateAuditEventInput {
  id?: string;
  timestamp?: string;
  actorId?: string;
  actorRole?: AuditEventActorRole;
  actorName?: string;
  action: string;
  category: AuditEventCategory | string;
  participantId?: string;
  targetId?: string;
  description: string;
  severity?: AuditEventSeverity;
  metadata?: Record<string, unknown>;
  workerName?: string;
  details?: string;
}

// Initial seed events for demonstration continuity
const SEED_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "aud-001",
    timestamp: "2026-08-31T11:12:00.000Z",
    actorId: "SW-001",
    actorRole: "SUPPORT_WORKER",
    actorName: "Dr. Sarah Jenkins, MSW",
    workerName: "Dr. Sarah Jenkins, MSW",
    action: "PARTICIPANT_REVIEWED",
    category: "SUPPORT",
    participantId: "P-1053",
    description: "Counselor reviewed participant P-1053 and verified trajectory recovery signal",
    details: "Reviewed AI trajectory shift, validated sleep disruption factor, and marked post-intervention recovery as verified.",
    severity: "INFO"
  },
  {
    id: "aud-002",
    timestamp: "2026-08-31T10:46:00.000Z",
    actorId: "SW-001",
    actorRole: "SUPPORT_WORKER",
    actorName: "Dr. Sarah Jenkins, MSW",
    workerName: "Dr. Sarah Jenkins, MSW",
    action: "FOLLOW_UP_ASSIGNED",
    category: "FOLLOW_UP",
    participantId: "P-1053",
    description: "Follow-up assigned for P-1053 (Elena Alvarez assigned for 48h check)",
    details: "Assigned case worker Elena Alvarez for 48-hour post-intervention sleep hygiene reflection check.",
    severity: "INFO"
  },
  {
    id: "aud-003",
    timestamp: "2026-08-31T10:44:00.000Z",
    actorId: "SYSTEM",
    actorRole: "SYSTEM",
    actorName: "AURA AI Signal Engine",
    workerName: "AURA AI Signal Engine",
    action: "ANALYSIS_GENERATED",
    category: "ANALYSIS",
    participantId: "P-1053",
    description: "AI Signal computed: Explainable breakdown (38% Stress, 26% Sleep, 20% Safety Uncertainty)",
    details: "Inspected Explainable AI breakdown: 38% Stress, 26% Sleep, 20% Safety Uncertainty. Confirmed non-clinical prioritization.",
    severity: "WARNING"
  },
  {
    id: "aud-004",
    timestamp: "2026-08-31T10:42:00.000Z",
    actorId: "SW-001",
    actorRole: "SUPPORT_WORKER",
    actorName: "Dr. Sarah Jenkins, MSW",
    workerName: "Dr. Sarah Jenkins, MSW",
    action: "PARTICIPANT_PROFILE_VIEWED",
    category: "SUPPORT",
    participantId: "P-1053",
    description: "Counselor inspected participant profile P-1053",
    details: "Authorized humanitarian worker viewed voluntary check-in history and 7-day trajectory chart.",
    severity: "INFO"
  },
  {
    id: "aud-005",
    timestamp: "2026-08-31T09:30:00.000Z",
    actorId: "SW-002",
    actorRole: "SUPPORT_WORKER",
    actorName: "Elena Alvarez",
    workerName: "Elena Alvarez",
    action: "SUPPORT_NOTE_ADDED",
    category: "SUPPORT",
    participantId: "P-1048",
    description: "Support case note recorded for participant P-1048",
    details: "Logged 1-on-1 counseling session regarding shelter environment conflict. Provided 4-4-4 breathing card.",
    severity: "INFO"
  },
  {
    id: "aud-006",
    timestamp: "2026-08-31T08:15:00.000Z",
    actorId: "SW-003",
    actorRole: "SUPPORT_WORKER",
    actorName: "Tariq Mansoor, LSW",
    workerName: "Tariq Mansoor, LSW",
    action: "STATUS_UPDATED",
    category: "SUPPORT",
    participantId: "P-1029",
    description: "Participant P-1029 status updated to Stable after improving reflections",
    details: "Updated participant status following two consecutive improving check-ins (-22 pts).",
    severity: "INFO"
  }
];

// Normalize legacy/incoming category strings to standard AuditEventCategory
function normalizeCategory(cat: string): AuditEventCategory {
  const upper = (cat || "").toUpperCase();
  if (
    upper === "AUTH" ||
    upper === "CHECK_IN" ||
    upper === "ANALYSIS" ||
    upper === "ALERT" ||
    upper === "NOTIFICATION" ||
    upper === "PROFILE" ||
    upper === "SUPPORT" ||
    upper === "FOLLOW_UP" ||
    upper === "SAFETY" ||
    upper === "SYSTEM"
  ) {
    return upper as AuditEventCategory;
  }

  // Map legacy categories
  if (upper === "REVIEW") return "SUPPORT";
  if (upper === "INTERVENTION") return "SUPPORT";
  if (upper === "ACCESS") return "SUPPORT";
  if (upper === "STATUS_CHANGE") return "SUPPORT";
  if (upper === "EXPORT") return "SYSTEM";
  if (upper === "CHECKIN" || upper === "CHECK_INS") return "CHECK_IN";
  if (upper === "FOLLOWUP" || upper === "FOLLOWUPS") return "FOLLOW_UP";

  return "SYSTEM";
}

// In-memory listeners registry
type AuditListener = (event?: AuditEvent) => void;
const listeners = new Set<AuditListener>();

// Anti-duplication cache: stores hash of (actorId, action, participantId, description) -> timestamp ms
const recentEventsCache = new Map<string, number>();

// Helper to get the active user's real role / id / name from the session, so
// audit events are attributed to whoever is actually signed in rather than a
// placeholder. Key must match authService's AUTH_KEY ("aura_auth_session").
export function getSessionActor(): { actorId: string; actorRole: AuditEventActorRole; actorName: string } {
  try {
    const rawAuth = typeof localStorage !== "undefined" ? localStorage.getItem("aura_auth_session") : null;
    if (rawAuth) {
      const user = JSON.parse(rawAuth);
      if (user && user.id) {
        return {
          actorId: user.id,
          actorRole: user.role === "support_worker" ? "SUPPORT_WORKER" : "PARTICIPANT",
          actorName: user.name || (user.role === "support_worker" ? "Counselor" : "Participant"),
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    actorId: "SYSTEM",
    actorRole: "SYSTEM",
    actorName: "AURA System"
  };
}

// Helper to load stored events safely
function loadStoredEvents(): AuditEvent[] {
  if (typeof localStorage === "undefined") {
    return SEED_AUDIT_EVENTS;
  }

  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed: AuditEvent[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    }

    // Check legacy storage
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        const migrated: AuditEvent[] = legacyParsed.map((l: any, i: number) => ({
          id: l.id || `migrated-${i}`,
          timestamp: l.timestamp || new Date().toISOString(),
          actorId: l.workerName ? "SW-001" : "SYSTEM",
          actorRole: l.workerName ? ("SUPPORT_WORKER" as AuditEventActorRole) : ("SYSTEM" as AuditEventActorRole),
          actorName: l.workerName || "System",
          workerName: l.workerName || "System",
          action: l.action || "ACTION_RECORDED",
          category: normalizeCategory(l.category),
          participantId: l.participantId,
          description: l.details || l.action || "Audit event",
          details: l.details || l.action,
          severity: (l.severity as AuditEventSeverity) || "INFO"
        }));
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(migrated));
        return migrated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    }

    // Seed initial events if nothing exists
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(SEED_AUDIT_EVENTS));
    return SEED_AUDIT_EVENTS;
  } catch (err) {
    console.warn("[AuditService] Storage read error:", err);
    return SEED_AUDIT_EVENTS;
  }
}

function saveEvents(events: AuditEvent[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn("[AuditService] Could not persist audit events to localStorage:", err);
  }
}

// Global Cross-Tab Storage Listener
let isCrossTabListening = false;
function initCrossTabSync() {
  if (typeof window === "undefined" || isCrossTabListening) return;
  isCrossTabListening = true;

  window.addEventListener("storage", (event) => {
    if (event.key === AUDIT_STORAGE_KEY && event.newValue) {
      try {
        const updatedEvents: AuditEvent[] = JSON.parse(event.newValue);
        const newest = updatedEvents[0];
        listeners.forEach((listener) => {
          try {
            listener(newest);
          } catch (e) {
            console.error("[AuditService] Listener error during cross-tab sync:", e);
          }
        });
      } catch (err) {
        console.warn("[AuditService] Failed parsing cross-tab storage event:", err);
      }
    }
  });
}

/**
 * Generate a unique ID using crypto.randomUUID if available
 */
function generateUniqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `aud-${crypto.randomUUID()}`;
  }
  return `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Central Audit Service
 */
export const auditService = {
  /**
   * Get all recorded audit events, sorted newest first
   */
  getAuditEvents: (): AuditEvent[] => {
    return loadStoredEvents();
  },

  /**
   * Record a new audit event into the centralized immutable audit trail
   */
  recordAuditEvent: (input: CreateAuditEventInput): AuditEvent => {
    const session = getSessionActor();

    // Legacy call sites pass placeholder actors ("SW-001", "Counselor",
    // "Dr. Sarah Jenkins, MSW"). When the current call is a support-worker
    // action and we have a real signed-in worker, attribute it to them so the
    // audit trail — and its per-counsellor scoping — reflects who really acted.
    const isPlaceholderId = (id?: string) =>
      !id || /^SW-\d+$/i.test(id) || id === "worker" || id === "counselor";
    const isPlaceholderName = (n?: string) =>
      !n || n === "Counselor" || /^dr\.?\s+sarah\s+jenkins/i.test(n);

    let actorId = input.actorId || session.actorId;
    let actorRole = input.actorRole || session.actorRole;
    let actorName = input.actorName || session.actorName;

    const inputIsWorkerAction =
      input.actorRole === "SUPPORT_WORKER" || isPlaceholderId(input.actorId);
    if (inputIsWorkerAction && session.actorRole === "SUPPORT_WORKER") {
      if (isPlaceholderId(input.actorId)) actorId = session.actorId;
      if (isPlaceholderName(input.actorName)) actorName = session.actorName;
      actorRole = "SUPPORT_WORKER";
    }

    const normalizedCategory = normalizeCategory(input.category);

    // Duplicate Prevention (within 400ms for same action + participant + actor)
    const dedupeKey = `${actorId}:${input.action}:${input.participantId || ""}:${input.description}`;
    const nowMs = Date.now();
    const lastSeen = recentEventsCache.get(dedupeKey);

    if (lastSeen && nowMs - lastSeen < 400) {
      // Return the most recent event from memory
      const currentList = loadStoredEvents();
      return currentList[0] || {
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        actorId,
        actorRole,
        actorName,
        action: input.action,
        category: normalizedCategory,
        participantId: input.participantId,
        description: input.description,
        severity: input.severity || "INFO"
      };
    }
    recentEventsCache.set(dedupeKey, nowMs);

    // Clean old deduplication cache entries
    if (recentEventsCache.size > 200) {
      for (const [k, v] of recentEventsCache.entries()) {
        if (nowMs - v > 5000) recentEventsCache.delete(k);
      }
    }

    const event: AuditEvent = {
      id: input.id || generateUniqueId(),
      timestamp: input.timestamp || new Date().toISOString(),
      actorId,
      actorRole,
      actorName,
      workerName: input.workerName || actorName,
      action: input.action,
      category: normalizedCategory,
      participantId: input.participantId,
      targetId: input.targetId,
      description: input.description,
      details: input.details || input.description,
      severity: input.severity || "INFO",
      metadata: input.metadata
    };

    // Load, Prepend & Persist
    const existing = loadStoredEvents();
    // Filter out if duplicate ID somehow provided
    const dedupedExisting = existing.filter((e) => e.id !== event.id);
    const updated = [event, ...dedupedExisting];
    saveEvents(updated);

    // Real-Time Notification to Subscribers immediately
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[AuditService] Listener callback error:", err);
      }
    });

    // Dispatch DOM CustomEvent for other parts of the application
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aura_audit_updated", { detail: event }));
      window.dispatchEvent(new CustomEvent("aura_data_updated"));
    }

    // Persist to PostgreSQL via FastAPI backend
    apiService.auditLogs.create({
      actorId,
      actorRole,
      actorName,
      action: input.action,
      category: normalizedCategory,
      participantId: input.participantId,
      targetId: input.targetId,
      description: input.description,
      severity: input.severity || "INFO",
      metadata: input.metadata
    }).catch((err) => {
      console.warn("[AuditService] Background backend sync notice:", err.message);
    });

    return event;
  },

  /**
   * Sync audit trail with FastAPI backend
   */
  syncFromBackend: async (): Promise<void> => {
    try {
      const backendLogs = await apiService.auditLogs.getAll();
      if (Array.isArray(backendLogs) && backendLogs.length > 0) {
        const mapped: AuditEvent[] = backendLogs.map((l: any) => ({
          id: l.id,
          timestamp: l.timestamp,
          actorId: l.actorId || l.actor_id,
          actorRole: l.actorRole || l.actor_role,
          actorName: l.actorName || l.actor_name,
          workerName: l.actorName || l.actor_name,
          action: l.action,
          category: normalizeCategory(l.category),
          participantId: l.participantId || l.participant_id,
          targetId: l.targetId || l.target_id,
          description: l.description,
          details: l.description,
          severity: (l.severity as AuditEventSeverity) || "INFO",
          metadata: l.metadata_json
        }));

        const existing = loadStoredEvents();
        const existingIds = new Set(existing.map((e) => e.id));
        const newItems = mapped.filter((m) => !existingIds.has(m.id));
        if (newItems.length > 0) {
          const merged = [...newItems, ...existing].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          saveEvents(merged);
          listeners.forEach((l) => l(newItems[0]));
        }
      }
    } catch (err) {
      console.warn("[AuditService] syncFromBackend skipped or offline:", err);
    }
  },

  /**
   * Subscribe to real-time audit updates.
   * Returns an unsubscribe cleanup function.
   */
  subscribeToAuditEvents: (listener: AuditListener): (() => void) => {
    initCrossTabSync();
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Clear all audit events (for test/reset purposes)
   */
  clearAuditEvents: () => {
    saveEvents([]);
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("[AuditService] Clear listener error:", err);
      }
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aura_audit_updated"));
    }
  },

  /**
   * Development diagnostic test runner (Requirement #29)
   */
  testAuditRealtime: (): { pass: boolean; details: string; error?: string } => {
    try {
      const testId = `test-audit-${Date.now()}`;
      let subscriberNotified = false;

      const unsub = auditService.subscribeToAuditEvents((evt) => {
        if (evt?.id === testId) {
          subscriberNotified = true;
        }
      });

      const created = auditService.recordAuditEvent({
        id: testId,
        actorId: "SW-001",
        actorRole: "SUPPORT_WORKER",
        actorName: "Diagnostic Test Runner",
        action: "TEST_DIAGNOSTIC_ACTION",
        category: "SYSTEM",
        participantId: "P-1042",
        description: "Diagnostic real-time audit verification event",
        severity: "INFO"
      });

      unsub();

      const events = auditService.getAuditEvents();
      const foundInStorage = events.find((e) => e.id === testId);

      if (!foundInStorage) {
        return {
          pass: false,
          details: "Event was not persisted to storage correctly.",
          error: "Storage persistence failure"
        };
      }

      if (!subscriberNotified) {
        return {
          pass: false,
          details: "Subscriber listener was not invoked synchronously upon recordAuditEvent().",
          error: "Real-time subscriber notification failure"
        };
      }

      if (!created.timestamp || isNaN(Date.parse(created.timestamp))) {
        return {
          pass: false,
          details: "Timestamp is missing or invalid ISO string.",
          error: "Invalid timestamp"
        };
      }

      // Cleanup test event
      const cleaned = events.filter((e) => e.id !== testId);
      saveEvents(cleaned);

      return {
        pass: true,
        details: `Real-time audit test PASSED. Event ID ${testId} persisted, listener notified, timestamp verified.`
      };
    } catch (err: any) {
      return {
        pass: false,
        details: "Diagnostic test exception occurred.",
        error: err?.message || String(err)
      };
    }
  }
};

// Direct export helpers
export const recordAuditEvent = auditService.recordAuditEvent;
export const getAuditEvents = auditService.getAuditEvents;
export const subscribeToAuditEvents = auditService.subscribeToAuditEvents;
export const testAuditRealtime = auditService.testAuditRealtime;

// Expose diagnostic tool on window in development/testing
if (typeof window !== "undefined") {
  (window as any).testAuditRealtime = auditService.testAuditRealtime;
  (window as any).auditService = auditService;
}
