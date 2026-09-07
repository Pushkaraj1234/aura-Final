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

    if (res.status === 401) {
      this.clearToken();
      throw new AdminSessionExpiredError("Admin session expired or invalid. Please log in again.");
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
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
      throw new Error(body?.detail || body?.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return body as T;
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
