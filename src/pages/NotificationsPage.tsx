import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  HeartHandshake,
  TrendingDown,
  TrendingUp,
  Clock,
  Trash2,
  Check,
  Shield,
  ArrowRight,
  Sparkles,
  Info,
  Filter
} from "lucide-react";
import { AppNotification, User, NotificationCategory, Participant } from "../types";
import { notificationService } from "../services/notificationService";
import { ALERT_CONFIG } from "../services/alertConfig";

interface Props {
  user: User | null;
  onNavigate: (view: string, participantId?: string) => void;
  // Used to keep a counsellor's notifications scoped to their current caseload.
  participants?: Participant[];
}

export const NotificationsPage: React.FC<Props> = ({ user, onNavigate, participants = [] }) => {
  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<NotificationCategory>("all");

  const userId = user?.id || "demo";
  const isWorker = user?.role === "support_worker";

  // Resolve participant ids -> names so notification titles/messages never show
  // a raw uuid, regardless of how the notification was worded when created.
  const nameById = React.useMemo(() => {
    const m = new Map<string, string>();
    participants.forEach((p) => {
      if (p.name) m.set(p.id, p.name);
    });
    return m;
  }, [participants]);

  const humanize = React.useCallback(
    (text: string, participantId?: string): string => {
      if (!text) return text;
      let out = text;
      // Replace any full uuid (optionally prefixed with "Participant ") with a
      // name when we can resolve it, otherwise a short readable reference.
      out = out.replace(
        /(?:Participant\s+)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
        (_m, id: string) => nameById.get(id) || `Participant ${id.slice(0, 8)}`
      );
      // "Participant 64e00ec0" style truncated refs.
      out = out.replace(/Participant\s+([0-9a-f]{8})\b/gi, (m, short: string) => {
        if (participantId && participantId.startsWith(short) && nameById.get(participantId)) {
          return nameById.get(participantId) as string;
        }
        return m;
      });
      return out;
    },
    [nameById]
  );

  // A counsellor only sees notifications about participants currently assigned
  // to them (plus system / unassigned). Everyone else sees their own list as-is.
  const notifications = React.useMemo(() => {
    const scoped =
      !isWorker || !user?.id
        ? rawNotifications
        : notificationService.scopeForWorker(
            rawNotifications,
            user.id,
            new Map(participants.map((p) => [p.id, p.assignedWorker]))
          );
    return scoped.map((n) => ({
      ...n,
      title: humanize(n.title, n.participantId),
      message: humanize(n.message, n.participantId),
    }));
  }, [rawNotifications, isWorker, user?.id, participants, humanize]);

  const loadNotifications = React.useCallback(() => {
    if (user?.id) {
      setRawNotifications(notificationService.getNotifications(user.id));
    } else {
      setRawNotifications([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener("aura_notifications_updated", handleUpdate);
    return () => window.removeEventListener("aura_notifications_updated", handleUpdate);
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    if (user?.id) {
      notificationService.markAsRead(id, user.id);
      loadNotifications();
    }
  };

  const handleMarkAllAsRead = () => {
    if (user?.id) {
      notificationService.markAllAsRead(user.id);
      loadNotifications();
    }
  };

  const handleClearAll = () => {
    if (user?.id) {
      notificationService.clearNotifications(user.id);
      loadNotifications();
    }
  };

  const handleActionClick = (notification: AppNotification) => {
    handleMarkAsRead(notification.id);
    if (notification.actionView) {
      onNavigate(notification.actionView, notification.actionParticipantId);
    }
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    if (filter === "priority") return n.filterCategory === "priority" || n.severity === "RED" || n.severity === "ORANGE";
    if (filter === "support_request") return n.filterCategory === "support_request" || n.category === "SUPPORT_REQUEST";
    if (filter === "follow_up") return n.filterCategory === "follow_up" || n.category === "FOLLOW_UP_DUE";
    if (filter === "improvement") return n.filterCategory === "improvement" || n.category === "IMPROVEMENT" || n.category === "RECOVERY";
    return true;
  });

  const getNotificationIcon = (n: AppNotification) => {
    if (n.category === "SAFETY_CONCERN" || n.severity === "RED") {
      return <AlertTriangle size={18} className="text-[#A55D25]" />;
    }
    if (n.category === "SUPPORT_REQUEST") {
      return <HeartHandshake size={18} className="text-[#D49B6A]" />;
    }
    if (n.category === "IMPROVEMENT" || n.category === "RECOVERY") {
      return <TrendingDown size={18} className="text-[#5A5049]" />;
    }
    if (n.category === "EARLY_WARNING" || n.severity === "ORANGE") {
      return <TrendingUp size={18} className="text-[#D49B6A]" />;
    }
    if (n.category === "FOLLOW_UP_DUE") {
      return <Clock size={18} className="text-[#5A5049]" />;
    }
    return <Bell size={18} className="text-[#7F8C8D]" />;
  };

  const getSeverityBadge = (n: AppNotification) => {
    if (n.category === "SAFETY_CONCERN" || n.severity === "RED") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#A55D25] text-white">
          Priority Signal
        </span>
      );
    }
    if (n.severity === "ORANGE" || n.category === "HIGH" || n.category === "EARLY_WARNING") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D49B6A] text-white">
          Human Review
        </span>
      );
    }
    if (n.category === "SUPPORT_REQUEST") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D49B6A]/20 text-[#D49B6A] border border-[#D49B6A]/40">
          Support Request
        </span>
      );
    }
    if (n.category === "IMPROVEMENT" || n.category === "RECOVERY") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#DBC3B2]/30 text-[#5A5049] border border-[#DBC3B2]/50">
          Positive Change
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EFE8E2] text-[#7A726C]">
        Monitoring
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#3C3530] text-white rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#3F4E4E]">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2] text-xs font-bold">
            <Bell size={13} />
            <span>{isWorker ? "Counselor Notification Center" : "Participant Wellbeing Updates"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Notifications & Signal Alerts
          </h1>
          <p className="text-[#EFE8E2]/80 text-xs sm:text-sm max-w-xl">
            {isWorker
              ? "Real-time AI-assisted decision-support signals routed for human review and proactive support tracking."
              : "Calm updates regarding your voluntary check-ins, recorded support requests, and scheduled follow-ups."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 px-4 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black text-[#DBC3B2]">{unreadCount}</div>
            <span className="text-[11px] font-bold text-[#EFE8E2]/80">Unread</span>
          </div>
        </div>
      </div>

      {/* Control Bar & Filter Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8E2] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "all"
                ? "bg-[#3C3530] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#7A726C] hover:bg-[#EFE8E2]"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "unread"
                ? "bg-[#3C3530] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#7A726C] hover:bg-[#EFE8E2]"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter("priority")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "priority"
                ? "bg-[#A55D25] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#A55D25] hover:bg-[#A55D25]/10"
            }`}
          >
            Priority
          </button>
          <button
            onClick={() => setFilter("support_request")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "support_request"
                ? "bg-[#D49B6A] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#D49B6A] hover:bg-[#D49B6A]/10"
            }`}
          >
            Support Requests
          </button>
          <button
            onClick={() => setFilter("follow_up")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "follow_up"
                ? "bg-[#5A5049] text-white shadow-xs"
                : "bg-[#FDF9F5] text-[#5A5049] hover:bg-[#5A5049]/10"
            }`}
          >
            Follow-ups
          </button>
          <button
            onClick={() => setFilter("improvement")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filter === "improvement"
                ? "bg-[#DBC3B2] text-[#3C3530] shadow-xs"
                : "bg-[#FDF9F5] text-[#5A5049] hover:bg-[#DBC3B2]/20"
            }`}
          >
            Improvement
          </button>
        </div>

        {/* Global Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#5A5049] hover:bg-[#DBC3B2]/20 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <Check size={13} />
              <span>Mark all read</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2 rounded-xl text-xs font-bold text-[#7F8C8D] hover:text-[#A55D25] hover:bg-[#A55D25]/10 transition-all cursor-pointer"
              title="Clear all notifications"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(notification => {
            const isUnread = !notification.read;

            return (
              <div
                key={notification.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUnread
                    ? "bg-white border-[#DBC3B2] shadow-xs ring-1 ring-[#DBC3B2]/30"
                    : "bg-[#FDF9F5]/80 border-[#EFE8E2] opacity-90"
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      notification.severity === "RED"
                        ? "bg-[#A55D25]/15"
                        : notification.severity === "ORANGE" || notification.category === "SUPPORT_REQUEST"
                        ? "bg-[#D49B6A]/15"
                        : notification.category === "IMPROVEMENT" || notification.category === "RECOVERY"
                        ? "bg-[#DBC3B2]/25"
                        : "bg-[#EFE8E2]"
                    }`}
                  >
                    {getNotificationIcon(notification)}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSeverityBadge(notification)}
                      <h3
                        className={`text-sm font-bold ${
                          isUnread ? "text-[#3C3530]" : "text-[#7A726C]"
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#A55D25]" title="Unread"></span>
                      )}
                    </div>

                    <p className="text-xs text-[#7A726C] leading-relaxed max-w-2xl">
                      {notification.message}
                    </p>

                    {/* Metadata pill details if available */}
                    {notification.metadata && (notification.metadata.score !== undefined || notification.metadata.factors) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#7F8C8D]">
                        {notification.metadata.score !== undefined && (
                          <span className="bg-[#EFE8E2] px-2 py-0.5 rounded-md font-mono font-bold text-[#3C3530]">
                            Indicator: {notification.metadata.score}/100
                          </span>
                        )}
                        {notification.metadata.change !== undefined && notification.metadata.change !== 0 && (
                          <span className={`font-bold ${notification.metadata.change > 0 ? "text-[#A55D25]" : "text-[#5A5049]"}`}>
                            {notification.metadata.change > 0 ? `+${notification.metadata.change} pts` : `${notification.metadata.change} pts`}
                          </span>
                        )}
                        {notification.metadata.factors && notification.metadata.factors.length > 0 && (
                          <span className="hidden md:inline text-[#7F8C8D]">
                            • {notification.metadata.factors.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-[11px] text-[#7F8C8D]">
                      <Clock size={11} />
                      <span>{new Date(notification.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>•</span>
                      <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Button */}
                <div className="flex items-center sm:self-center space-x-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EFE8E2]">
                  {notification.actionLabel && (
                    <button
                      onClick={() => handleActionClick(notification)}
                      className="px-4 py-2 rounded-xl bg-[#3C3530] hover:bg-[#3F4E4E] text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>{notification.actionLabel}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-2 rounded-xl text-[#7F8C8D] hover:text-[#3C3530] hover:bg-[#EFE8E2] transition-all cursor-pointer"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#EFE8E2] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF9F5] text-[#7F8C8D] flex items-center justify-center mx-auto border border-[#EFE8E2]">
              <Bell size={20} />
            </div>
            <h3 className="text-base font-bold text-[#3C3530]">No notifications</h3>
            <p className="text-xs text-[#7F8C8D] max-w-sm mx-auto">
              {filter === "all"
                ? "No notification alerts recorded for your account."
                : `No notifications matching the "${filter.replace("_", " ")}" filter.`}
            </p>
          </div>
        )}
      </div>

      {/* Responsible AI Disclaimer Footer */}
      <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-center space-y-1">
        <p className="text-[11px] text-[#7F8C8D]">
          {ALERT_CONFIG.DISCLAIMER}
        </p>
      </div>
    </div>
  );
};
