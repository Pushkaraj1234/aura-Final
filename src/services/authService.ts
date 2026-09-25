import { User, UserRole, FirstAidKit } from "../types";
import { normalizeKit } from "./firstAidKit";
import { participantStore } from "./participantStore";
import { auditService } from "./auditService";
import { supabase } from "./supabaseClient";
import { wipeLocalTraces } from "./safetyExit";

const AUTH_KEY = "aura_auth_session";
const TOKEN_KEY = "aura_auth_token";

export interface SignUpPayload {
  email: string;
  password?: string;
  name: string;
  language: string;
  ageRange: string;
  supportPreference: string;
  consentGiven: boolean;
  emergencyContact?: string;
  caseReference?: string;
  state?: string;
  district?: string;
}

export const DEMO_CREDENTIALS = {
  participant: {
    // Supabase's email validator rejects the ".test" reserved TLD outright
    // (auth.signUp fails with "Email address is invalid"), which silently
    // broke demo provisioning — every demo login fell through to the fully
    // local, never-persisted fallback. ".dev" is a real, valid TLD.
    email: "maria.demo@auraapp.dev",
    password: "Demo@123",
    role: "participant" as UserRole,
    name: "Maria Santos",
    language: "Spanish",
    ageRange: "25-34",
    supportPreference: "Human counselor",
    consentGiven: true,
  },
  supportWorker: {
    email: "worker.demo@auraapp.dev",
    password: "Demo@123",
    role: "support_worker" as UserRole,
    name: "Sarah Jenkins, MSW",
    language: "English",
    ageRange: "35-44",
    supportPreference: "Human counselor",
    consentGiven: true,
  },
};

// Initialize Supabase Auth state change listener to keep session reactive
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && event === "SIGNED_IN") {
      const meta = session.user.user_metadata || {};
      const user: User = {
        id: session.user.id,
        email: session.user.email || "",
        name: meta.name || session.user.email?.split("@")[0] || "User",
        // Optimistic only. An address is not a credential, so the old
        // `email.includes("worker")` fallback is gone — anyone whose address
        // happened to contain the word was handed a counsellor's view of the
        // app. signInToPortal() replaces this with the role the database
        // holds, which is the one RLS actually enforces.
        role: (meta.role as UserRole) || "participant",
        language: meta.language || "English",
        ageRange: meta.ageRange || "25-34",
        supportPreference: meta.supportPreference || "Human counselor",
        consentGiven: meta.consentGiven ?? true,
        createdAt: session.user.created_at || new Date().toISOString(),
        emergencyContact: meta.emergencyContact || undefined,
        caseReference: meta.caseReference || undefined,
        state: meta.state || undefined,
        district: meta.district || undefined,
        firstAidKit: normalizeKit(meta.firstAidKit),
        languages: meta.languages || undefined,
        availability: meta.availability || undefined,
        maxCaseload: typeof meta.maxCaseload === "number" ? meta.maxCaseload : undefined,
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      if (session.access_token) {
        localStorage.setItem(TOKEN_KEY, session.access_token);
      }
      // A real Supabase session exists now (this fires on every genuine
      // sign-in, including the first login after confirming an email — the
      // moment sign-up's own participant-creation call may have silently
      // failed against RLS because no session existed yet). Re-assert the
      // participant record server-side; safe to call every time (upsert).
      if (user.role === "participant") {
        participantStore.getParticipantForUser(user);
      }
    } else if (event === "SIGNED_OUT") {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  });
}

export const authService = {
  /**
   * One-click demo login
   */
  loginAsDemo: async (role: UserRole): Promise<User> => {
    const creds = role === "participant" ? DEMO_CREDENTIALS.participant : DEMO_CREDENTIALS.supportWorker;
    return authService.login(creds.email, creds.password);
  },

  /**
   * Live Supabase Authentication (Sign In)
   */
  login: async (email: string, password?: string): Promise<User> => {
    const cleanEmail = email.trim().toLowerCase();
    const pwd = password || "Demo@123";

    // 1. Attempt Supabase live sign in
    const { data: supaAuth, error: supaError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pwd,
    });

    if (!supaError && supaAuth.user) {
      const meta = supaAuth.user.user_metadata || {};
      const user: User = {
        id: supaAuth.user.id,
        email: supaAuth.user.email || cleanEmail,
        name: meta.name || cleanEmail.split("@")[0] || "User",
        // Optimistic, and corrected by signInToPortal() against profiles.role.
        // user_metadata is written by the client at sign-up, so it says what
        // the browser claimed rather than what the database granted.
        role: (meta.role as UserRole) || "participant",
        language: meta.language || "English",
        ageRange: meta.ageRange || "25-34",
        supportPreference: meta.supportPreference || "Human counselor",
        consentGiven: meta.consentGiven ?? true,
        createdAt: supaAuth.user.created_at || new Date().toISOString(),
        emergencyContact: meta.emergencyContact || undefined,
        caseReference: meta.caseReference || undefined,
        state: meta.state || undefined,
        district: meta.district || undefined,
        firstAidKit: normalizeKit(meta.firstAidKit),
        languages: meta.languages || undefined,
        availability: meta.availability || undefined,
        maxCaseload: typeof meta.maxCaseload === "number" ? meta.maxCaseload : undefined,
      };

      if (supaAuth.session?.access_token) {
        localStorage.setItem(TOKEN_KEY, supaAuth.session.access_token);
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));

      auditService.recordAuditEvent({
        actorId: user.id,
        actorRole: user.role.toUpperCase() as any,
        actorName: user.name,
        action: "USER_LOGGED_IN",
        category: "AUTH",
        participantId: user.role === "participant" ? user.id : undefined,
        description: `User logged in via Supabase Auth (${user.name})`,
        severity: "INFO",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aura_auth_updated"));
      }

      // Sync data from Supabase 'items' table
      await participantStore.syncWithBackend();
      return user;
    }

    // 2. If it's a demo account and not yet provisioned in Supabase, provision it live
    const isDemoParticipant = cleanEmail === DEMO_CREDENTIALS.participant.email.toLowerCase();
    const isDemoWorker = cleanEmail === DEMO_CREDENTIALS.supportWorker.email.toLowerCase();

    if (isDemoParticipant || isDemoWorker) {
      const demoRole: UserRole = isDemoWorker ? "support_worker" : "participant";
      const demoData = isDemoWorker ? DEMO_CREDENTIALS.supportWorker : DEMO_CREDENTIALS.participant;

      try {
        const { data: autoSignData } = await supabase.auth.signUp({
          email: demoData.email,
          password: demoData.password,
          options: {
            data: {
              name: demoData.name,
              role: demoRole,
              language: demoData.language,
              ageRange: demoData.ageRange,
              supportPreference: demoData.supportPreference,
              consentGiven: true,
            },
          },
        });

        if (autoSignData?.user) {
          const u: User = {
            id: autoSignData.user.id,
            email: demoData.email,
            name: demoData.name,
            role: demoRole,
            language: demoData.language,
            ageRange: demoData.ageRange,
            supportPreference: demoData.supportPreference,
            consentGiven: true,
            createdAt: autoSignData.user.created_at || new Date().toISOString(),
          };
          if (autoSignData.session?.access_token) {
            localStorage.setItem(TOKEN_KEY, autoSignData.session.access_token);
          }
          localStorage.setItem(AUTH_KEY, JSON.stringify(u));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("aura_auth_updated"));
          }
          await participantStore.syncWithBackend();
          return u;
        }
      } catch (autoErr) {
        console.warn("[AuthService] Demo provisioning in Supabase:", autoErr);
      }

      // Fallback demo session if network offline
      const fallbackUser: User = {
        id: isDemoWorker ? "worker-1" : "user-1001",
        email: demoData.email,
        name: demoData.name,
        role: demoRole,
        language: demoData.language,
        ageRange: demoData.ageRange,
        supportPreference: demoData.supportPreference,
        consentGiven: true,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(fallbackUser));
      localStorage.setItem(TOKEN_KEY, `demo-token-${fallbackUser.id}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aura_auth_updated"));
      }
      await participantStore.syncWithBackend();
      return fallbackUser;
    }

    // 3. Normal user error response from Supabase
    throw new Error(supaError?.message || "Invalid email or password. Please try again.");
  },

  /**
   * Signs in through one particular door, and refuses the wrong one.
   *
   * Both login screens used to call login() and navigate on success, without
   * ever asking what kind of account had just signed in. A participant's own
   * email and password therefore worked on the counsellor portal — the page
   * headed "Authorized Humanitarian Personnel Only" — and then dropped them on
   * the participant home screen, because that is where App routes a
   * participant. Nothing was exposed (row-level security answers to the
   * database, not to which form was used) but the door announced a check it
   * was not performing, which is its own kind of broken.
   *
   * The role is read from profiles, never from user_metadata: metadata is
   * written by the browser at sign-up, so it reports what the client claimed,
   * while profiles.role is what the database granted and what is_staff()
   * enforces. That makes this check agree with what the person will actually
   * be able to see once they are inside.
   *
   * Fails closed. If the role cannot be read, the staff door stays shut rather
   * than guessing — a door marked "authorized personnel only" should refuse
   * when it cannot tell, and the message says to try again rather than
   * implying the credentials were wrong.
   */
  signInToPortal: async (
    email: string,
    password: string,
    portal: "staff" | "participant"
  ): Promise<User> => {
    const user = await authService.login(email, password);

    // The offline demo fallback mints a local session with no database behind
    // it (ids like "user-1001", a "demo-token-" token). There is no profile to
    // read and no real data to protect, so the locally chosen role stands.
    const token = authService.getToken() || "";
    if (token.startsWith("demo-token-")) return user;

    let role: string | null = null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data?.role) role = data.role as string;
    } catch {
      role = null;
    }

    if (!role) {
      await authService.logout();
      throw new Error(
        "We couldn't confirm what this account has access to. Please try signing in again."
      );
    }

    const isStaff = role === "support_worker" || role === "admin";
    const belongsHere = portal === "staff" ? isStaff : role === "participant";

    if (!belongsHere) {
      await authService.logout();
      throw new Error(
        portal === "staff"
          ? "This is the counsellor portal, and that's a participant account. Sign in from the participant page instead."
          : "That's a counsellor account. Sign in through the counsellor portal instead."
      );
    }

    // The database disagreeing with the sign-in metadata is the normal case for
    // accounts seeded server-side, which carry no metadata at all. Persist what
    // the database says, so App routes on the same role RLS will enforce.
    if (user.role !== role) {
      user.role = role as UserRole;
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("aura_auth_updated"));
        }
      } catch {
        /* storage unavailable; the returned user still carries the right role */
      }
    }

    return user;
  },

  /**
   * Live Supabase Authentication (Sign Up)
   */
  signUp: async (data: SignUpPayload): Promise<User> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const password = data.password || "Demo@123";

    // Call Supabase Auth API
    const { data: supaAuth, error: supaError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          name: data.name,
          language: data.language,
          ageRange: data.ageRange,
          supportPreference: data.supportPreference,
          consentGiven: data.consentGiven,
          emergencyContact: data.emergencyContact || null,
          caseReference: data.caseReference || null,
          state: data.state || null,
          district: data.district || null,
          role: "participant",
        },
      },
    });

    if (supaError) {
      console.warn("[AuthService] Supabase signUp error:", supaError.message);
      if (
        supaError.message.toLowerCase().includes("already registered") ||
        supaError.message.toLowerCase().includes("exists")
      ) {
        throw new Error("This email is already registered. Please sign in instead.");
      }
      throw new Error(supaError.message);
    }

    const supaUser = supaAuth.user;
    const userId = supaUser?.id || `user-${Date.now()}`;
    const token = supaAuth.session?.access_token || `supa-token-${userId}`;

    const userProfile: User = {
      id: userId,
      email: cleanEmail,
      name: data.name,
      role: "participant",
      language: data.language,
      ageRange: data.ageRange,
      supportPreference: data.supportPreference,
      consentGiven: data.consentGiven,
      createdAt: supaUser?.created_at || new Date().toISOString(),
      emergencyContact: data.emergencyContact || undefined,
      caseReference: data.caseReference || undefined,
      state: data.state || undefined,
      district: data.district || undefined,
      firstAidKit: normalizeKit((data as any).firstAidKit),
    };

    localStorage.setItem(AUTH_KEY, JSON.stringify(userProfile));
    localStorage.setItem(TOKEN_KEY, token);

    // Register into participant store (this also persists the participant
    // row into Supabase Postgres — see participantStore.registerNewParticipant)
    participantStore.registerNewParticipant(userProfile);

    auditService.recordAuditEvent({
      actorId: userProfile.id,
      actorRole: "PARTICIPANT",
      actorName: userProfile.name,
      action: "USER_SIGNED_UP",
      category: "AUTH",
      participantId: userProfile.id,
      description: `Participant registered via Supabase Auth (${userProfile.name})`,
      severity: "INFO",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("aura_auth_updated"));
    }
    return userProfile;
  },

  getCurrentUser: (): User | null => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  updateConsent: (status: boolean): User | null => {
    const user = authService.getCurrentUser();
    if (user) {
      user.consentGiven = status;
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      participantStore.saveUser(user);
      return user;
    }
    return null;
  },

  updatePreferences: (updates: Partial<User>): User | null => {
    const user = authService.getCurrentUser();
    if (user) {
      const updated = { ...user, ...updates };
      localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
      participantStore.saveUser(updated);
      return updated;
    }
    return null;
  },

  // Optional emergency/trusted contact — persisted to Supabase Auth
  // user_metadata (so it survives across devices) as well as the local
  // session. Passing an empty string clears it.
  updateEmergencyContact: async (contact: string): Promise<User | null> => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    const value = contact.trim();
    try {
      await supabase.auth.updateUser({ data: { emergencyContact: value || null } });
    } catch (err) {
      console.warn("[AuthService] updateEmergencyContact (Supabase):", err);
    }
    const updated = { ...user, emergencyContact: value || undefined };
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    participantStore.saveUser(updated);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aura_auth_updated"));
    return updated;
  },

  // The participant's own first-aid kit. Held in their auth metadata rather
  // than the participants table, so it travels with them across devices and
  // stays out of the staff-facing record unless they turn sharing on. A
  // Supabase failure is not allowed to lose the edit: the local session is
  // updated either way, and the offline queue carries it later.
  updateFirstAidKit: async (kit: FirstAidKit): Promise<User | null> => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    const next: FirstAidKit = { ...kit, updatedAt: new Date().toISOString() };
    try {
      await supabase.auth.updateUser({ data: { firstAidKit: next } });
    } catch (err) {
      console.warn("[AuthService] updateFirstAidKit (Supabase):", err);
    }
    const updated = { ...user, firstAidKit: next };
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    participantStore.saveUser(updated);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aura_auth_updated"));
    return updated;
  },

  // Persist the participant's support preference to Supabase Auth metadata
  // (survives across devices) as well as the local session. The caller is
  // responsible for also updating participants.preferred_support.
  updateSupportPreference: async (pref: string): Promise<User | null> => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    try {
      await supabase.auth.updateUser({ data: { supportPreference: pref } });
    } catch (err) {
      console.warn("[AuthService] updateSupportPreference (Supabase):", err);
    }
    const updated = { ...user, supportPreference: pref };
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    participantStore.saveUser(updated);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aura_auth_updated"));
    return updated;
  },

  // Counsellor self-service profile (languages / availability / max caseload).
  // Stored in Supabase Auth metadata + the local session; display-only for now.
  updateWorkerProfile: async (fields: {
    languages?: string;
    availability?: string;
    maxCaseload?: number;
  }): Promise<User | null> => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    const clean = {
      languages: (fields.languages ?? "").trim() || undefined,
      availability: (fields.availability ?? "").trim() || undefined,
      maxCaseload:
        typeof fields.maxCaseload === "number" && Number.isFinite(fields.maxCaseload)
          ? Math.max(0, Math.round(fields.maxCaseload))
          : undefined,
    };
    try {
      await supabase.auth.updateUser({ data: { ...clean } });
    } catch (err) {
      console.warn("[AuthService] updateWorkerProfile (Supabase):", err);
    }
    const updated = { ...user, ...clean };
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    participantStore.saveUser(updated);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aura_auth_updated"));
    return updated;
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[AuthService] Supabase signOut notice:", e);
    }
    // Everything AURA cached, not just the session.
    //
    // This used to remove AUTH_KEY and TOKEN_KEY alone, which left
    // aura_participants_v2 holding every check-in, note and alert in plain
    // localStorage after sign-out. On a shared or borrowed phone that is the
    // whole threat model of this product realised: the next person to open
    // the browser could read a survivor's full history without signing in as
    // anybody. Signing out now means what a person signing out believes it
    // means.
    wipeLocalTraces();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("aura_auth_updated"));
    }
  },

  isAuthenticated: (): boolean => {
    return authService.getCurrentUser() !== null;
  },

  getUserRole: (): UserRole | null => {
    const user = authService.getCurrentUser();
    return user ? user.role : null;
  },
};
