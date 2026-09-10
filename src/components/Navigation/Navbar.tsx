import React, { useState, useEffect } from "react";
import {
  Activity,
  Shield,
  LifeBuoy,
  User as UserIcon,
  LogOut,
  Bell,
  Sparkles,
  Menu,
  X,
  LayoutDashboard,
  Users,
  AlertTriangle,
  History,
  Info,
  HeartHandshake,
  BarChart2,
  FileText,
  Sliders,
  Play,
  ShieldCheck,
  MessageCircle,
  BookOpen
} from "lucide-react";
import { User, Alert, Participant } from "../../types";
import { notificationService } from "../../services/notificationService";
import { LanguageSelector } from "../LanguageSelector";

interface Props {
  user: User | null;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  currentView: string;
  onOpenEmergency: () => void;
  pendingAlertsCount: number;
  unreadMessagesCount?: number;
  // Lets the bell badge stay scoped to a counsellor's current caseload.
  participants?: Participant[];
}

export const Navbar: React.FC<Props> = ({
  user,
  onLogout,
  onNavigate,
  currentView,
  onOpenEmergency,
  pendingAlertsCount,
  unreadMessagesCount = 0,
  participants = [],
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const isWorker = user?.role === "support_worker";

  useEffect(() => {
    const updateUnread = () => {
      if (!user?.id) {
        setUnreadNotifCount(0);
        return;
      }
      if (isWorker) {
        // Match the Notifications page: only count signals about participants
        // currently in this counsellor's caseload.
        const map = new Map<string, string | null | undefined>();
        participants.forEach((p) => map.set(p.id, p.assignedWorker));
        const scoped = notificationService.scopeForWorker(
          notificationService.getNotifications(user.id),
          user.id,
          map
        );
        setUnreadNotifCount(scoped.filter((n) => !n.read).length);
      } else {
        setUnreadNotifCount(notificationService.getUnreadCount(user.id));
      }
    };

    updateUnread();
    window.addEventListener("aura_notifications_updated", updateUnread);
    return () => window.removeEventListener("aura_notifications_updated", updateUnread);
  }, [user?.id, isWorker, participants]);

  return (
    <header className="relative z-40 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate(user ? (isWorker ? "dashboard" : "participant_home") : "landing")}
              className="flex items-center space-x-3 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#A85D2E] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <HeartHandshake size={18} className="text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xl sm:text-2xl font-serif font-semibold text-[#3C3530] tracking-tight">
                    Aura
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[#8F867E] uppercase tracking-widest hidden sm:block mt-0.5">
                  {isWorker ? 'Care Operations' : 'Participant Portal'}
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Center Navigation (Role-aware) */}
          {user && (
            <nav className="hidden lg:flex items-center space-x-1 bg-white/55 p-1.5 rounded-full border border-[#E8E4DE] backdrop-blur-sm mx-auto">
              {isWorker ? (
                <>
                  <button
                    onClick={() => onNavigate("dashboard")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "dashboard" || currentView === "detail"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <LayoutDashboard size={14} />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => onNavigate("messages")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 relative cursor-pointer ${
                      currentView === "messages"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <MessageCircle size={14} />
                    <span>Messages</span>
                    {unreadMessagesCount > 0 && (
                      <span className="ml-1 w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigate("alerts")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 relative cursor-pointer ${
                      currentView === "alerts"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <Bell size={14} />
                    <span>Alerts</span>
                    {pendingAlertsCount > 0 && (
                      <span className="ml-1 w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                        {pendingAlertsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigate("follow_ups")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "follow_ups"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <HeartHandshake size={14} />
                    <span>Outcomes</span>
                  </button>
                  <button
                    onClick={() => onNavigate("community")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "community"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <BarChart2 size={14} />
                    <span>Community</span>
                  </button>
                  <button
                    onClick={() => onNavigate("support_resources")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "support_resources"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>Resources</span>
                  </button>
                  <button
                    onClick={() => onNavigate("audit_log")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "audit_log"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <FileText size={14} />
                    <span>Audit Log</span>
                  </button>
                  <button
                    onClick={() => onNavigate("privacy")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "privacy"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7F8C8D] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <Shield size={14} />
                    <span>Architecture</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onNavigate("participant_home")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "participant_home"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <Activity size={14} />
                    <span>My Wellbeing</span>
                  </button>
                  <button
                    onClick={() => onNavigate("messages")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 relative cursor-pointer ${
                      currentView === "messages"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <MessageCircle size={14} />
                    <span>Messages</span>
                    {unreadMessagesCount > 0 && (
                      <span className="ml-1 w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigate("checkin")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "checkin"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <History size={14} />
                    <span>Daily Check-in</span>
                  </button>
                  <button
                    onClick={() => onNavigate("support_resources")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "support_resources"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>Resources</span>
                  </button>
                  <button
                    onClick={() => onNavigate("consent_mgmt")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "consent_mgmt"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <Sliders size={14} />
                    <span>Consent Settings</span>
                  </button>
                  <button
                    onClick={() => onNavigate("privacy")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentView === "privacy"
                        ? "bg-[#F3E7D8] text-[#9A5B33] ring-1 ring-[#C88A5A]/35"
                        : "text-[#7A726C] hover:text-[#3C3530] hover:bg-white/60"
                    }`}
                  >
                    <Shield size={14} />
                    <span>Privacy & Ethics</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Action Cluster */}
          <div className="flex items-center space-x-2 sm:space-x-4">

            {/* Mockup specific element for counselors */}
            {user && isWorker && (
              <div className="hidden lg:flex items-center space-x-2 px-3.5 py-1.5 bg-white rounded-full border border-[#ECE1D3]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6E8A5E]"></div>
                <span className="text-xs text-[#6E7A57] font-medium">North Region · 142 monitored</span>
              </div>
            )}

            {/* Notification Bell Button */}
            {user && (
              <button
                onClick={() => onNavigate("notifications")}
                className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm border border-[#EFE8E2] shadow-sm flex items-center justify-center text-[#3C3530] hover:bg-white transition-colors cursor-pointer relative"
                title={`Notifications (${unreadNotifCount} unread)`}
              >
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            {/* Language. Sitting in the nav rather than on one screen is the
                point: a participant who cannot read English needs it reachable
                from wherever they are, not only inside the check-in. */}
            {!isWorker && (
              <div className="hidden sm:flex items-center pr-1 border-r border-[#EFE8E2] mr-1">
                <LanguageSelector />
              </div>
            )}

            {/* Emergency Hotline Button */}
            <button
              onClick={onOpenEmergency}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-full bg-[#F3E7D8] border border-[#A85D2E]/30 text-[#9A5B33] text-xs font-semibold hover:bg-[#EBDAC6] transition-all active:scale-95 cursor-pointer"
              title="Immediate Crisis & Emergency Resources"
            >
              <LifeBuoy size={14} className="text-[#9A5B33]" />
              <span className="hidden lg:inline">Emergency Help</span>
            </button>

            {/* User Profile / Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-3 pr-4 pl-1.5 py-1.5 bg-white/60 backdrop-blur-sm rounded-full border border-[#EFE8E2] shadow-sm hover:bg-white transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#A85D2E] text-white flex items-center justify-center text-xs font-bold">
                    {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="text-left hidden lg:flex flex-col justify-center">
                    <p className="text-[12px] font-bold text-[#3C3530] leading-tight truncate max-w-[120px]">
                      <span data-no-translate>{user.name}</span>
                    </p>
                    <p className="text-[10px] text-[#7A726C] font-semibold">
                      {isWorker ? 'Counselor' : 'Participant'}
                    </p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#EFE8E2] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-[#EFE8E2]">
                      <p data-no-translate className="text-xs font-bold text-[#3C3530] truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-[#7F8C8D] truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFE8E2] text-[#5A5049] uppercase">
                        {user.role.replace("_", " ")}
                      </span>
                    </div>

                    <div className="py-1">
                      {isWorker ? (
                        <>
                          <button
                            onClick={() => {
                              onNavigate("dashboard");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <LayoutDashboard size={14} className="text-[#7F8C8D]" />
                            <span>Support Dashboard</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("messages");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <MessageCircle size={14} className="text-[#7F8C8D]" />
                              <span>Messages</span>
                            </div>
                            {unreadMessagesCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadMessagesCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("alerts");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <Bell size={14} className="text-[#7F8C8D]" />
                            <span>Escalations & Alerts</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("follow_ups");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <HeartHandshake size={14} className="text-[#7F8C8D]" />
                            <span>Outcome Tracking</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("community");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <BarChart2 size={14} className="text-[#7F8C8D]" />
                            <span>Community Insights</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("support_resources");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <BookOpen size={14} className="text-[#7F8C8D]" />
                            <span>Resource Library</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("audit_log");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <FileText size={14} className="text-[#7F8C8D]" />
                            <span>Audit Log</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onNavigate("participant_home");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <UserIcon size={14} className="text-[#7F8C8D]" />
                            <span>My Profile & Stats</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("messages");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <MessageCircle size={14} className="text-[#7F8C8D]" />
                              <span>Messages</span>
                            </div>
                            {unreadMessagesCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadMessagesCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("checkin");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <History size={14} className="text-[#7F8C8D]" />
                            <span>Start Wellbeing Check-in</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("support_resources");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <BookOpen size={14} className="text-[#7F8C8D]" />
                            <span>Resource Library</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate("consent_mgmt");
                              setUserDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                          >
                            <Sliders size={14} className="text-[#7F8C8D]" />
                            <span>Consent Settings</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          onNavigate("notifications");
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <Bell size={14} className="text-[#7F8C8D]" />
                          <span>Notifications</span>
                        </div>
                        {unreadNotifCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-[#A85D2E] text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadNotifCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          onNavigate("privacy");
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-[#302C29] hover:bg-[#F3F1EA] flex items-center space-x-2 cursor-pointer"
                      >
                        <Shield size={14} className="text-[#7F8C8D]" />
                        <span>Privacy & Architecture</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-[#EFE8E2]">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#9A5B33] hover:bg-[#C48A55]/10 flex items-center space-x-2 cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                {/* Discreet admin entry point — a real navigation (not
                    onNavigate) since /admin is its own isolated app,
                    outside this currentView state machine. Kept low-key
                    (icon-only) since this manages sensitive population
                    data and isn't a role a normal visitor should pick. */}
                <a
                  href="/admin"
                  title="Administrator Access"
                  className="w-9 h-9 rounded-full bg-white/60 backdrop-blur-sm border border-[#EFE8E2] shadow-sm flex items-center justify-center text-[#8F867E] hover:text-[#3C3530] hover:bg-white transition-colors cursor-pointer"
                >
                  <ShieldCheck size={16} />
                </a>
                <button
                  onClick={() => onNavigate("role_select")}
                  className="px-4 py-2 rounded-xl bg-[#302C29] text-white text-xs font-semibold hover:bg-[#443E38] transition-colors shadow-xs cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl text-[#3C3530] hover:bg-[#EFE8E2] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-t border-[#EFE8E2] px-4 py-4 space-y-2">
          {!isWorker && (
            <div className="pb-3 mb-1 border-b border-[#EFE8E2]">
              <LanguageSelector />
            </div>
          )}
          {user ? (
            <>
              <button
                onClick={() => {
                  onNavigate("notifications");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center justify-between border-b border-[#EFE8E2] pb-3"
              >
                <div className="flex items-center space-x-2">
                  <Bell size={16} className="text-[#5A5049]" />
                  <span>Notifications</span>
                </div>
                {unreadNotifCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#A85D2E] text-white text-xs font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {isWorker ? (
                <>
                  <button
                    onClick={() => {
                      onNavigate("dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <LayoutDashboard size={16} />
                    <span>Support Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("messages");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <MessageCircle size={16} />
                      <span>Messages</span>
                    </div>
                    {unreadMessagesCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#A85D2E] text-white text-xs font-bold flex items-center justify-center">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("alerts");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <Bell size={16} />
                      <span>Alerts & Escalations</span>
                    </div>
                    {pendingAlertsCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#A85D2E] text-white text-xs font-bold flex items-center justify-center">
                        {pendingAlertsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("follow_ups");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <HeartHandshake size={16} />
                    <span>Intervention & Outcomes</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("community");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <BarChart2 size={16} />
                    <span>Community Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("support_resources");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <BookOpen size={16} />
                    <span>Resources</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("audit_log");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <FileText size={16} />
                    <span>Audit Log</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onNavigate("participant_home");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <UserIcon size={16} />
                    <span>My Profile & Insights</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("messages");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <MessageCircle size={16} />
                      <span>Messages</span>
                    </div>
                    {unreadMessagesCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#A85D2E] text-white text-xs font-bold flex items-center justify-center">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("checkin");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <Activity size={16} />
                    <span>Start Wellbeing Check-in</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("support_resources");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <BookOpen size={16} />
                    <span>Resources</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate("consent_mgmt");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
                  >
                    <Sliders size={16} />
                    <span>Consent Management</span>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  onNavigate("privacy");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left p-2.5 rounded-xl text-sm font-medium hover:bg-[#F3F1EA] text-[#302C29] flex items-center space-x-2"
              >
                <Shield size={16} />
                <span>Privacy & Ethics</span>
              </button>
              <div className="pt-2 border-t border-[#EFE8E2]">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left p-2.5 rounded-xl text-sm font-semibold text-[#9A5B33] hover:bg-[#C48A55]/10 flex items-center space-x-2"
                >
                  <LogOut size={16} />
                  <span>
                    Log Out (<span data-no-translate>{user.name}</span>)
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onNavigate("role_select");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-3 bg-[#302C29] text-white rounded-xl font-semibold text-sm"
              >
                Sign In / Register
              </button>
              <a
                href="/admin"
                className="w-full text-center py-2.5 flex items-center justify-center space-x-1.5 text-xs font-bold text-[#8F867E] hover:text-[#3C3530]"
              >
                <ShieldCheck size={14} />
                <span>Administrator Access</span>
              </a>
            </>
          )}
        </div>
      )}
    </header>
  );
};
