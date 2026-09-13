import { AppNotification, AlertCategory } from "../types";
import { apiService } from "./apiService";

const NOTIFICATIONS_STORAGE_KEY = "aura_notifications_v2";

const notifyChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aura_notifications_updated"));
  }
};

const getStoredMap = (): Record<string, AppNotification[]> => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveStoredMap = (map: Record<string, AppNotification[]>) => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(map));
    notifyChange();
  } catch (e) {
    console.error("Failed to save notifications to localStorage", e);
  }
};

export const notificationService = {
  /**
   * Get all notifications for a specific user ID
   */
  getNotifications: (userId: string): AppNotification[] => {
    if (!userId) return [];
    const map = getStoredMap();
    return map[userId] || [];
  },

  /**
   * Get unread notification count for a specific user
   */
  getUnreadCount: (userId: string): number => {
    if (!userId) return 0;
    const notifications = notificationService.getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  },

  /**
   * Restrict a counsellor's notification list to participants currently in
   * their caseload. Worker notifications are stored under whichever worker was
   * assigned when the signal fired, so a later reassignment would otherwise
   * leave stale notifications visible to the previous counsellor. System /
   * non-participant notifications, and any participant not present in the
   * provided roster, are always kept.
   */
  scopeForWorker: (
    list: AppNotification[],
    currentWorkerId: string,
    assignedWorkerByParticipantId: Map<string, string | null | undefined>
  ): AppNotification[] => {
    return list.filter((n) => {
      if (!n.participantId) return true;
      if (!assignedWorkerByParticipantId.has(n.participantId)) return true;
      const pw = assignedWorkerByParticipantId.get(n.participantId);
      return !pw || pw === currentWorkerId;
    });
  },

  /**
   * Create a new notification for a specific user
   */
  createNotification: (
    data: {
      userId: string;
      participantId?: string;
      category: AlertCategory | "SYSTEM" | "REMINDER";
      severity: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "INFO";
      title: string;
      message: string;
      actionLabel?: string;
      actionView?: string;
      actionParticipantId?: string;
      filterCategory?: "priority" | "support_request" | "follow_up" | "improvement" | "general";
      metadata?: {
        score?: number;
        change?: number;
        factors?: string[];
        trajectory?: string;
      };
    }
  ): AppNotification => {
    const map = getStoredMap();
    const userNotifications = map[data.userId] || [];

    // Map filter category if not explicitly provided
    let filterCat = data.filterCategory;
    if (!filterCat) {
      if (data.severity === "RED" || data.severity === "ORANGE" || data.category === "PRIORITY" || data.category === "SAFETY_CONCERN") {
        filterCat = "priority";
      } else if (data.category === "SUPPORT_REQUEST") {
        filterCat = "support_request";
      } else if (data.category === "FOLLOW_UP_DUE") {
        filterCat = "follow_up";
      } else if (data.category === "IMPROVEMENT" || data.category === "RECOVERY") {
        filterCat = "improvement";
      } else {
        filterCat = "general";
      }
    }

    const newNotification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId,
      participantId: data.participantId,
      category: data.category,
      filterCategory: filterCat,
      severity: data.severity,
      title: data.title,
      message: data.message,
      createdAt: new Date().toISOString(),
      read: false,
      actionLabel: data.actionLabel,
      actionView: data.actionView,
      actionParticipantId: data.actionParticipantId,
      metadata: data.metadata
    };

    map[data.userId] = [newNotification, ...userNotifications];
    saveStoredMap(map);

    // Best-effort persistence to Supabase (skipped for synthetic demo user ids
    // that aren't real Supabase auth uuids — see apiService/supabaseService).
    apiService.notifications.create(newNotification).catch((err: any) => {
      console.warn("[NotificationService] Persist notice:", err?.message || err);
    });

    return newNotification;
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: (notificationId: string, userId: string): void => {
    const map = getStoredMap();
    const userNotifications = map[userId] || [];
    const idx = userNotifications.findIndex(n => n.id === notificationId);
    if (idx >= 0) {
      userNotifications[idx] = {
        ...userNotifications[idx],
        read: true
      };
      map[userId] = userNotifications;
      saveStoredMap(map);
      apiService.notifications.markRead(notificationId).catch(() => {});
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: (userId: string): void => {
    const map = getStoredMap();
    const userNotifications = map[userId] || [];
    map[userId] = userNotifications.map(n => ({ ...n, read: true }));
    saveStoredMap(map);
    apiService.notifications.markAllRead().catch(() => {});
  },

  /**
   * Clear all notifications for a specific user
   */
  clearNotifications: (userId: string): void => {
    const map = getStoredMap();
    map[userId] = [];
    saveStoredMap(map);
  },

  /**
   * Reset demo notifications for worker & demo participant
   */
  seedDemoNotifications: (workerUserId = "worker_1", demoParticipantId = "P-1042") => {
    const map = getStoredMap();

    // Seed worker notifications with rich multi-category events
    map[workerUserId] = [
      {
        id: "notif-demo-1",
        userId: workerUserId,
        participantId: "P-1042",
        category: "PRIORITY",
        filterCategory: "priority",
        severity: "RED",
        title: "Priority Wellbeing Signal: P-1042",
        message: "Participant P-1042 reported distress indicator reached 89/100 (Increasing, +15 pts). High reported stress and sleep disturbances flagged for human review.",
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: false,
        actionLabel: "Review Case",
        actionView: "detail",
        actionParticipantId: "P-1042",
        metadata: { score: 89, change: 15, factors: ["High Stress (5/5)", "Sleep Disturbance (1/5)"], trajectory: "Rapid Increase" }
      },
      {
        id: "notif-demo-2",
        userId: workerUserId,
        participantId: "P-1087",
        category: "SUPPORT_REQUEST",
        filterCategory: "support_request",
        severity: "YELLOW",
        title: "Support Request Received: P-1087",
        message: "Participant P-1087 requested voluntary counselor follow-up. Current indicator: 41/100 (Stable).",
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        read: false,
        actionLabel: "View Request",
        actionView: "detail",
        actionParticipantId: "P-1087",
        metadata: { score: 41, change: 0, factors: ["Voluntary Request"], trajectory: "Stable" }
      },
      {
        id: "notif-demo-3",
        userId: workerUserId,
        participantId: "P-1019",
        category: "RECOVERY",
        filterCategory: "improvement",
        severity: "GREEN",
        title: "Improvement Detected After Support: P-1019",
        message: "Participant P-1019 reported distress indicator dropped from 78/100 to 42/100 (-36 pts) following scheduled follow-up session.",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        read: true,
        actionLabel: "View Outcome",
        actionView: "follow_ups",
        actionParticipantId: "P-1019",
        metadata: { score: 42, change: -36, trajectory: "Decreasing" }
      }
    ];

    saveStoredMap(map);
  }
};
