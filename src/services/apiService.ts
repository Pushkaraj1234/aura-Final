import { supabaseService } from "./supabaseService";

const API_BASE = "/api";

/**
 * apiService is now a thin facade:
 *  - `.ai` and `.ml` still call the Express server, which is the only piece
 *    that needs to run outside the browser (it hides the GEMINI_API_KEY and
 *    runs the deterministic trend model).
 *  - Every other namespace (participants, checkIns, alerts, notifications,
 *    interventions, followUps, consents, supportResources, auditLogs, risk)
 *    now reads/writes Supabase Postgres directly via supabaseService, which
 *    is enforced by row-level security using the caller's real session.
 *
 * Kept as the same shape/call-sites the rest of the app already uses, so
 * this rewiring didn't require touching every screen individually.
 */
class ApiService {
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("aura_auth_token");
        // Only ever forward something that's actually JWT-shaped (3
        // dot-separated segments). authService falls back to fabricated
        // placeholder strings (e.g. "supa-token-<id>", "demo-token-<id>")
        // when there's no real Supabase session yet (most commonly: a fresh
        // sign-up still pending email confirmation) — sending one of those
        // as a Bearer token isn't just useless, Supabase's own JWT parser
        // throws on it ("Expected 3 parts in JWT; got 1"), which is worse
        // than just making the request unauthenticated.
        if (token && token.split(".").length === 3) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      ...this.getHeaders(),
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.detail || errorJson.message || errorMsg;
      } catch {
        // default errorMsg
      }
      throw new Error(errorMsg);
    }
    return res.json();
  }

  // Participants
  participants = {
    getAll: async () => supabaseService.participants.getAll(),
    getById: async (id: string) => supabaseService.participants.getById(id),
    create: async (data: any) => supabaseService.participants.upsert(data),
    update: async (id: string, data: any) => supabaseService.participants.update(id, data),
    addNote: async (id: string, note: any) => supabaseService.supportNotes.create(id, note),
    getNotes: async (id: string) => supabaseService.supportNotes.getAll(id),
    markReviewed: async (id: string) => supabaseService.participants.markReviewed(id),
    setArea: async (id: string, state: string | null, district: string | null) =>
      supabaseService.participants.setArea(id, state, district),
  };

  // Check-ins
  checkIns = {
    getAll: async (participantId?: string) => supabaseService.checkIns.getAll(participantId),
    create: async (data: any) => supabaseService.checkIns.create(data),
  };

  // Reflections
  reflections = {
    getAll: async (participantId?: string) => supabaseService.reflections.getAll(participantId),
    create: async (data: any) => supabaseService.reflections.create(data),
  };

  // Risk & Predictions
  risk = {
    createPrediction: async (data: any) => supabaseService.risk.createPrediction(data).catch(() => data),
    getPredictions: async (participantId?: string) => supabaseService.risk.getPredictions(participantId).catch(() => []),
    getHistory: async (participantId: string) => supabaseService.risk.getHistory(participantId).catch(() => []),
  };

  // Alerts
  alerts = {
    getAll: async (participantId?: string, status?: string) => supabaseService.alerts.getAll(participantId, status),
    create: async (data: any) => supabaseService.alerts.create(data),
    update: async (id: string, data: any) => supabaseService.alerts.update(id, data),
  };

  // Notifications
  notifications = {
    getAll: async (unreadOnly = false) => supabaseService.notifications.getAll(unreadOnly),
    create: async (data: any) => supabaseService.notifications.create(data),
    markRead: async (id: string) => supabaseService.notifications.markRead(id),
    markAllRead: async () => supabaseService.notifications.markAllRead().catch(() => ({ markedRead: 0 })),
  };

  // Interventions & Follow-ups
  interventions = {
    getAll: async (participantId?: string) => supabaseService.interventions.getAll(participantId),
    create: async (data: any) => supabaseService.interventions.create(data),
  };

  followUps = {
    getAll: async (participantId?: string) => supabaseService.followUps.getAll(participantId),
    create: async (data: any) => supabaseService.followUps.create(data),
    update: async (id: string, data: any) => supabaseService.followUps.update(id, data),
  };

  // Consents
  consents = {
    get: async (participantId: string) => supabaseService.consents.get(participantId),
    update: async (participantId: string, data: any) => supabaseService.consents.upsert(participantId, data, data.status),
    revoke: async (participantId: string, reason?: string) => supabaseService.consents.revoke(participantId, reason),
  };

  // Support Resources
  supportResources = {
    getAll: async (_filters: Record<string, string> = {}) => supabaseService.supportResources.getAll(),
    create: async (data: any) => supabaseService.supportResources.create(data),
    update: async (id: string, data: any) => supabaseService.supportResources.update(id, data),
    delete: async (id: string) => supabaseService.supportResources.remove(id),
  };

  // Messages (participant <-> assigned counselor)
  messages = {
    getForParticipant: async (participantId: string) => supabaseService.messages.getForParticipant(participantId),
    getForParticipants: async (participantIds: string[]) => supabaseService.messages.getForParticipants(participantIds),
    send: async (data: { participantId: string; senderId: string; senderRole: "participant" | "support_worker"; body: string }) =>
      supabaseService.messages.send(data),
    markThreadRead: async (participantId: string, readerRole: "participant" | "support_worker") =>
      supabaseService.messages.markThreadRead(participantId, readerRole),
  };

  profiles = {
    getName: async (id?: string | null) => supabaseService.profiles.getName(id),
    getNames: async (ids: Array<string | null | undefined>) => supabaseService.profiles.getNames(ids),
  };

  // Audit Logs
  auditLogs = {
    getAll: async (category?: string, participantId?: string) => supabaseService.auditLogs.getAll(category, participantId),
    create: async (data: any) => supabaseService.auditLogs.create(data),
  };

  // AI & ML Endpoints — proxied through the Express server (keeps GEMINI_API_KEY server-side)
  ai = {
    analyzeReflection: async (text: string, participantId?: string) =>
      this.request<any>("/ai/analyze-reflection", {
        method: "POST",
        body: JSON.stringify({ text, participantId }),
      }),
    analyzeVoiceTone: async (transcript: string, acousticFeatures: any, participantId?: string) =>
      this.request<any>("/ai/analyze-voice-tone", {
        method: "POST",
        body: JSON.stringify({ transcript, acousticFeatures, participantId }),
      }),
    summarizeCase: async (participant_id: string) =>
      this.request<{ summary: string }>("/ai/summarize-case", {
        method: "POST",
        body: JSON.stringify({ participant_id }),
      }),
    analyzeComprehensiveCheckIn: async (checkInData: any, transcript?: string) =>
      this.request<any>("/ai/comprehensive-analysis", {
        method: "POST",
        body: JSON.stringify({ checkInData, transcript }),
      }),
    /**
     * `crisis` comes back when the server refused to let the model answer and
     * returned crisis resources instead. `counsellorNotified` reports whether
     * an alert was really written, so the UI never promises a follow-up that
     * row-level security rejected.
     */
    chat: async (
      messages: { role: string; content: string }[],
      context?: { participantId?: string; language?: string }
    ) =>
      this.request<{
        reply: string;
        crisis?: { tier: "self_harm" | "imminent_danger"; counsellorNotified: boolean };
      }>("/chat", {
        method: "POST",
        body: JSON.stringify({
          messages,
          participantId: context?.participantId,
          language: context?.language,
        }),
      }),
  };

  // The proctored trauma assessment's two model-backed steps. Sent with the
  // person's token so the crisis gate can raise an alert about them and the
  // audit record names who asked.
  assessment = {
    contextualChat: async (payload: {
      messages: { sender: "aura" | "user"; text: string }[];
      userMessage: string;
      indexTrauma: string;
      completedItemsCount: number;
      participantId?: string;
      language?: string;
    }) =>
      this.request<{
        response: string;
        crisis?: { tier: "self_harm" | "imminent_danger"; counsellorNotified: boolean };
      }>("/assessment/contextual-chat", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    generateReport: async (payload: Record<string, unknown>) =>
      this.request<{ userReport: string; sessionReport: string }>("/assessment/generate-report", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };

  ml = {
    getPrediction: async (participantId: string) =>
      this.request<{ prediction: any; metadata: any }>(`/ml/predict/${participantId}`),
  };
}

export const apiService = new ApiService();
