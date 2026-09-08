/**
 * Isolated API client for the Admin module. Deliberately separate from
 * apiService.ts: admin sessions are a standalone passcode-issued JWT (see
 * server/adminAuth.ts), never a Supabase Auth session, so they're stored
 * under their own localStorage key and never mixed with the
 * participant/counselor auth token or headers.
 */

const ADMIN_API_BASE = "/api/admin";
const ADMIN_TOKEN_KEY = "aura_admin_token";

export class AdminSessionExpiredError extends Error {}

/**
 * Fired when the admin JWT is rejected mid-session (it has a 2h TTL, so this
 * happens on any long-lived tab). AdminApp listens for it and drops straight
 * back to the passcode screen — without this the dashboard just painted a red
 * error banner on every tab and left no way back in except the Log Out button.
 */
export const ADMIN_SESSION_EXPIRED_EVENT = "aura_admin_session_expired";

/** Shape of the deployment self-check served by api/index.ts. */
export interface AdminConfigStatus {
  status?: string;
  receivedPath?: string;
  routingOk?: boolean;
  adminLoginReady?: boolean;
  configured?: Record<string, boolean>;
}

class AdminApiService {
  getToken(): string | null {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string) {
    try {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  clearToken() {
    try {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, { ...options, headers });

    // A 401 from /login means the passcode was wrong, not that a session
    // lapsed — fall through so the server's own "Incorrect passcode." message
    // reaches the login form. Treating it as an expiry (the old behaviour)
    // told first-time visitors their session had expired before they had one.
    if (res.status === 401 && endpoint !== "/login") {
      this.clearToken();
      try {
        window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
      } catch {
        // non-browser context; nothing to notify
      }
      throw new AdminSessionExpiredError("Admin session expired or invalid. Please log in again.");
    }

    let body: any = null;
    let rawBody: string | null = null;
    try {
      rawBody = await res.text();
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // Not JSON. On a hosted deployment that almost always means the request
      // never reached the API at all and something else answered — the host's
      // own 404 page, or index.html served by the SPA fallback. Keep the raw
      // text so the branch below can say that plainly instead of surfacing
      // "Unexpected token '<'" to whoever is trying to log in.
      body = null;
    }

    const gotHtmlInsteadOfApi =
      body === null && !!rawBody && /^\s*<(!doctype|html)/i.test(rawBody);

    if (gotHtmlInsteadOfApi) {
      throw new Error(
        `The admin API did not respond at ${ADMIN_API_BASE}${endpoint} — the server returned a web page instead of data (HTTP ${res.status}). The deployment may not have rebuilt since the API was added. Open /api/config-status to check.`
      );
    }

    if (!res.ok) {
      if (res.status === 409 && body?.warning) {
        // Caseload-warning responses carry structured data the caller needs
        // (currentCaseload/maxCaseload) — surface the whole body, not just a
        // message, so the UI can offer "assign anyway".
        const err: any = new Error(body?.detail || "This action needs confirmation.");
        err.warning = true;
        err.body = body;
        throw err;
      }
      if (res.status === 404) {
        throw new Error(
          `The admin API route ${ADMIN_API_BASE}${endpoint} was not found (HTTP 404). Open /api/config-status to check whether the API is reachable at all.`
        );
      }
      if (body?.detail || body?.message) {
        throw new Error(body.detail || body.message);
      }
      // No message came back at all. On Vercel this is what a crashed
      // serverless invocation looks like, and res.statusText is always empty
      // over HTTP/2, so the old fallback rendered the useless "HTTP 500:".
      throw new Error(
        `The server returned HTTP ${res.status} with no error message — the API most likely crashed while starting up. Open /api/config-status to see whether the API is running.`
      );
    }

    return body as T;
  }

  /**
   * Reads the deployment self-check at /api/config-status. Returns null if the
   * endpoint cannot be reached or does not answer with JSON — which is itself
   * the diagnosis: the API is not deployed or not routed.
   */
  async getConfigStatus(): Promise<AdminConfigStatus | null> {
    try {
      const res = await fetch("/api/config-status", { headers: { Accept: "application/json" } });
      const text = await res.text();
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? (parsed as AdminConfigStatus) : null;
    } catch {
      return null;
    }
  }

  async login(passcode: string): Promise<void> {
    const { token } = await this.request<{ token: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    });
    this.setToken(token);
  }

  logout() {
    this.clearToken();
  }

  // Public: counselor application intake (no admin session required).
  async submitApplication(data: { name: string; email: string; phone?: string; credentialFile: File }): Promise<{ success: boolean; applicationId: string }> {
    const form = new FormData();
    form.append("name", data.name);
    form.append("email", data.email);
    if (data.phone) form.append("phone", data.phone);
    form.append("credentialFile", data.credentialFile);
    const res = await fetch(`${ADMIN_API_BASE}/applications`, { method: "POST", body: form });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    if (!res.ok) throw new Error(body?.detail || "Failed to submit application.");
    return body;
  }

  getPendingWorkers() {
    return this.request<any[]>("/pending-workers");
  }

  approveWorker(id: string) {
    return this.request<{ success: boolean; userId: string; emailSent: boolean; temporaryPassword: string }>(
      `/workers/${id}/approve`,
      { method: "POST" }
    );
  }

  rejectWorker(id: string, reason?: string) {
    return this.request<{ success: boolean }>(`/workers/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  getWorkers() {
    return this.request<any[]>("/workers");
  }

  suspendWorker(id: string) {
    return this.request<{ success: boolean; reassigned?: number; unassigned?: number }>(
      `/workers/${id}/suspend`,
      { method: "POST" }
    );
  }

  reactivateWorker(id: string) {
    return this.request<{ success: boolean }>(`/workers/${id}/reactivate`, { method: "POST" });
  }

  resetWorkerPassword(id: string) {
    return this.request<{ success: boolean; emailSent: boolean; temporaryPassword: string }>(
      `/workers/${id}/reset-password`,
      { method: "POST" }
    );
  }

  getUsers() {
    return this.request<any[]>("/users");
  }

  getWorkerCaseloadTrends(workerId: string) {
    return this.request<{
      workerId: string;
      workerName: string;
      caseloadCount: number;
      aggregateTrend: { date: string; averageScore: number; checkInCount: number }[];
      individualSeries: { participantId: string; status: string; points: { date: string; score: number }[] }[];
    }>(`/workers/${workerId}/caseload-trends`);
  }

  assignWorker(participantId: string, workerId: string, opts?: { reason?: string; override?: boolean }) {
    return this.request<{ success: boolean }>("/assignments", {
      method: "POST",
      body: JSON.stringify({ participantId, workerId, reason: opts?.reason, override: opts?.override }),
    });
  }

  unassignWorker(participantId: string, reason?: string) {
    return this.request<{ success: boolean; unassigned: boolean }>("/assignments", {
      method: "POST",
      body: JSON.stringify({ participantId, workerId: null, reason }),
    });
  }

  bulkAutoAssign() {
    return this.request<{ success: boolean; assignedCount: number; unassignedRemaining: number; skippedByPreference: number }>(
      "/assignments/bulk-auto",
      { method: "POST" }
    );
  }

  getDashboard() {
    return this.request<{
      totalUsers: number;
      totalWorkers: number;
      pendingVerifications: number;
      unassignedUsers: number;
      averageCaseload: number;
      flaggedUnassignedUsers: any[];
    }>("/dashboard");
  }

  getAuditLog(category?: string) {
    return this.request<any[]>(`/audit-log${category ? `?category=${encodeURIComponent(category)}` : ""}`);
  }

  getFlagReviews() {
    return this.request<{
      items: {
        alertId: string;
        participantId: string;
        participantName: string;
        severity: string;
        category: string | null;
        title: string | null;
        reason: string | null;
        status: string;
        score: number | null;
        createdAt: string;
        verdict: "true_positive" | "false_positive" | "false_negative" | "unclear" | null;
        reviewNote: string | null;
        reviewedAt: string | null;
      }[];
      missed: { id: string; participantId: string; participantName: string; note: string | null; reviewedAt: string }[];
      stats: {
        true_positive: number;
        false_positive: number;
        false_negative: number;
        unclear: number;
        reviewed: number;
        precision: number | null;
        recall: number | null;
      };
      verdicts: string[];
    }>("/flag-reviews");
  }

  reviewFlag(input: {
    alertId?: string | null;
    participantId: string;
    verdict: "true_positive" | "false_positive" | "false_negative" | "unclear";
    note?: string;
    flaggedScore?: number | null;
    flaggedSeverity?: string | null;
    originalReason?: string | null;
  }) {
    return this.request<{ success: boolean }>("/flag-reviews", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getEscalations() {
    return this.request<
      {
        id: string;
        participantId: string;
        participantName: string;
        severity: string;
        category: string | null;
        title: string | null;
        reason: string | null;
        status: string;
        score: number | null;
        assignedWorkerName: string | null;
        createdAt: string;
      }[]
    >("/escalations");
  }

  getMaxCaseload() {
    return this.request<{ maxCaseload: number }>("/settings/max-caseload");
  }

  setMaxCaseload(maxCaseload: number) {
    return this.request<{ success: boolean; maxCaseload: number }>("/settings/max-caseload", {
      method: "PUT",
      body: JSON.stringify({ maxCaseload }),
    });
  }

  getAlertThresholds() {
    return this.request<{ thresholds: Record<string, number>; keys: string[] }>("/settings/alert-thresholds");
  }

  setAlertThresholds(thresholds: Record<string, number>) {
    return this.request<{ success: boolean; thresholds: Record<string, number> }>("/settings/alert-thresholds", {
      method: "PUT",
      body: JSON.stringify({ thresholds }),
    });
  }
}

export const adminApiService = new AdminApiService();
