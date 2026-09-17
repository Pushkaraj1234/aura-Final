import React, { useState, useEffect } from "react";
import { User, Participant, Alert, CheckIn, SupportNote, CheckInAnalysis } from "./types";
import { authService } from "./services/authService";
import { participantStore } from "./services/participantStore";
import { auditService } from "./services/auditService";
import { apiService } from "./services/apiService";
import { loadAlertThresholdOverrides } from "./services/alertConfig";

// Components & Pages
import { Navbar } from "./components/Navigation/Navbar";
import { EmergencyModal } from "./components/EmergencyModal";
import { SupportResources } from "./components/SupportResources";
import { LandingPage } from "./pages/LandingPage";
import { LandingAuth } from "./pages/Auth/LandingAuth";
import { ParticipantSignUp } from "./pages/Auth/ParticipantSignUp";
import { ParticipantLogin } from "./pages/Auth/ParticipantLogin";
import { SupportLogin } from "./pages/Auth/SupportLogin";
import { SupportWorkerSignUp } from "./pages/Auth/SupportWorkerSignUp";
import { ParticipantCheckin } from "./pages/ParticipantCheckin";
import { CheckInResults } from "./pages/CheckInResults";
import { ParticipantProfile } from "./pages/ParticipantProfile";
import { ChooseCounsellor } from "./pages/ChooseCounsellor";
import { VoiceCompanion } from "./pages/VoiceCompanion";
import { WellbeingIndex } from "./pages/WellbeingIndex";
import { WhatToExpect } from "./pages/WhatToExpect";
import { CounsellorProfileEditor } from "./pages/CounsellorProfileEditor";
import { SupportDashboard } from "./pages/SupportDashboard";
import { ParticipantDetail } from "./pages/ParticipantDetail";
import { AlertsPage } from "./pages/AlertsPage";
import { FollowUps } from "./pages/FollowUps";
import { CommunityInsights } from "./pages/CommunityInsights";
import { AuditLog } from "./pages/AuditLog";
import { ConsentManagement } from "./pages/ConsentManagement";
import { PrivacyArchitecture } from "./pages/PrivacyArchitecture";
import { NotificationsPage } from "./pages/NotificationsPage";
import { Messages } from "./pages/Messages";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GeminiChatbot } from "./components/GeminiChatbot";
import { SafetyExitButton } from "./components/SafetyExitButton";
import { RecoveryHub } from "./pages/RecoveryHub";

export const App: React.FC = () => {
  // Ensure store initialization
  participantStore.init();

  // Pull any admin-configured AI alert-threshold overrides once at startup so
  // the client-side alert engine scores against the tuned values.
  useEffect(() => {
    loadAlertThresholdOverrides();
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [participants, setParticipants] = useState<Participant[]>(() => participantStore.getAllParticipants());
  const [alerts, setAlerts] = useState<Alert[]>(() => participantStore.getAlerts());

  // View state
  const [currentView, setCurrentView] = useState<string>(() => {
    const user = authService.getCurrentUser();
    if (!user) return "landing";
    return user.role === "support_worker" ? "dashboard" : "participant_home";
  });

  const [lastCheckInAnalysis, setLastCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [lastSubmittedCheckIn, setLastSubmittedCheckIn] = useState<CheckIn | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("P-1042");
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  // Synchronize state on internal store changes
  useEffect(() => {
    const syncData = () => {
      setParticipants(participantStore.getAllParticipants());
      setAlerts(participantStore.getAlerts());
    };

    const authCheck = () => {
      const user = authService.getCurrentUser();
      if (!user && currentUser) {
        // Automatically log out if auth is cleared elsewhere (like on 401 error)
        setCurrentUser(null);
        setCurrentView("landing");
        return;
      }
      // Profile edits — the first-aid kit, emergency contact, support
      // preference — write to storage and fire this event, but nothing here
      // used to read them back, so React kept rendering the session as it was
      // at sign-in. Someone saved their kit and the page looked like nothing
      // had happened until they reloaded. Compared serialized rather than by
      // reference, since getCurrentUser parses a fresh object every call and
      // an unconditional setState would re-render on every event.
      if (user && currentUser && JSON.stringify(user) !== JSON.stringify(currentUser)) {
        setCurrentUser(user);
      }
    };

    window.addEventListener("aura_data_updated", syncData);
    window.addEventListener("aura_auth_updated", authCheck);
    return () => {
      window.removeEventListener("aura_data_updated", syncData);
      window.removeEventListener("aura_auth_updated", authCheck);
    }
  }, [currentUser]);

  // Sync auth state
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView("landing");
  };

  const handleLoginSuccess = () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setParticipants(participantStore.getAllParticipants());
    setAlerts(participantStore.getAlerts());

    if (user?.role === "support_worker") {
      setCurrentView("dashboard");
    } else {
      setCurrentView("participant_home");
    }
  };

  const handleUpdateConsent = (status: boolean) => {
    const updated = authService.updateConsent(status);
    if (updated) {
      setCurrentUser({ ...updated });
      setParticipants(participantStore.getAllParticipants());
    }
  };

  // Check-in submission: isolated to the specific participant ID
  const handleSaveCheckIn = (newCheckIn: CheckIn) => {
    const result = participantStore.saveCheckIn(newCheckIn);
    setParticipants(participantStore.getAllParticipants());
    setAlerts(participantStore.getAlerts());
    setLastCheckInAnalysis(result.analysis);
    setLastSubmittedCheckIn(newCheckIn);
    setCurrentView("checkin_results");
  };

  // Participant status update
  const handleUpdateStatus = (participantId: string, newStatus: any) => {
    participantStore.updateParticipantStatus(participantId, newStatus);
    setParticipants(participantStore.getAllParticipants());
  };

  // Add support note
  const handleAddNote = (participantId: string, note: SupportNote) => {
    participantStore.addParticipantNote(participantId, note);
    setParticipants(participantStore.getAllParticipants());
  };

  // Delete support note
  const handleDeleteNote = (participantId: string, noteId: string) => {
    participantStore.deleteParticipantNote(participantId, noteId);
    setParticipants(participantStore.getAllParticipants());
  };

  // Assign worker
  const handleAssignWorker = (participantId: string, workerName: string) => {
    participantStore.assignWorker(participantId, workerName);
    setParticipants(participantStore.getAllParticipants());
  };

  // Update alert status
  const handleUpdateAlert = (alertId: string, decision: string, notes: string) => {
    participantStore.updateAlertDecision(alertId, decision as any, notes);
    setAlerts(participantStore.getAlerts());
  };


  // Participant review action with immediate real-time audit logging
  const handleReviewParticipant = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setCurrentView("detail");

    const actor = currentUser || { id: "SW-001", role: "support_worker", name: "Dr. Sarah Jenkins, MSW" };
    auditService.recordAuditEvent({
      actorId: actor.id,
      actorRole: actor.role === "support_worker" ? "SUPPORT_WORKER" : "PARTICIPANT",
      actorName: actor.name,
      participantId: participantId,
      action: "PARTICIPANT_REVIEWED",
      category: "SUPPORT",
      description: `Counselor reviewed participant ${participantId}`,
      severity: "INFO"
    });
  };

  const selectedParticipant = (selectedParticipantId
    ? (participants.find(p => p.id === selectedParticipantId) || participantStore.getParticipantById(selectedParticipantId))
    : null) || participants[0];
  
  // Isolated participant record lookup for the authenticated user (creates fresh if not exists)
  const participantRecordForUser = currentUser && currentUser.role === "participant"
    ? participantStore.getParticipantForUser(currentUser)
    : null;

  const pendingAlertsCount = alerts.filter(a => a.status === "pending_review" || a.status === "escalated").length;

  // Unread direct-message count for the Navbar badge. Messages live only in
  // Supabase (unlike notifications, which are cached per-browser in
  // localStorage) since a real two-way conversation needs the actual
  // sender/recipient's own sessions to see the same rows — so this polls
  // rather than reading from a local store.
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const loadUnreadMessages = async () => {
      if (!currentUser) {
        if (!cancelled) setUnreadMessagesCount(0);
        return;
      }
      try {
        if (currentUser.role === "support_worker") {
          const assignedIds = participants.filter(p => p.assignedWorker === currentUser.id).map(p => p.id);
          if (assignedIds.length === 0) {
            if (!cancelled) setUnreadMessagesCount(0);
            return;
          }
          const msgs = await apiService.messages.getForParticipants(assignedIds);
          if (!cancelled) setUnreadMessagesCount(msgs.filter(m => m.senderRole === "participant" && !m.read).length);
        } else if (participantRecordForUser) {
          const msgs = await apiService.messages.getForParticipant(participantRecordForUser.id);
          if (!cancelled) setUnreadMessagesCount(msgs.filter(m => m.senderRole === "support_worker" && !m.read).length);
        } else if (!cancelled) {
          setUnreadMessagesCount(0);
        }
      } catch {
        // best-effort — leave the last known count on transient errors
      }
    };
    loadUnreadMessages();
    const interval = setInterval(loadUnreadMessages, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.role, participants, participantRecordForUser?.id]);

  return (
    <div className="min-h-screen text-[#3C3530] flex flex-col font-sans">
      {/* Top Navbar */}
      <ErrorBoundary>
        <Navbar
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={setCurrentView}
        currentView={currentView}
        onOpenEmergency={() => setEmergencyModalOpen(true)}
        pendingAlertsCount={pendingAlertsCount}
        unreadMessagesCount={unreadMessagesCount}
        participants={participants}
      />
      </ErrorBoundary>


      {/* Main App Content View Switcher */}
      <main className="flex-1">
        <ErrorBoundary>
        {currentView === "landing" && (
          <LandingPage
            onStart={(role) => {
              if (role === "participant") setCurrentView("signup");
              else if (role === "worker") setCurrentView("support_login");
              else setCurrentView("role_select");
            }}
            onOpenPrivacy={() => setCurrentView("privacy")}
          />
        )}

        {currentView === "role_select" && (
          <LandingAuth
            onChoice={(role, mode) => {
              if (role === "participant") {
                setCurrentView(mode === "signup" ? "signup" : "participant_login");
              } else {
                setCurrentView("support_login");
              }
            }}
            onBack={() => setCurrentView("landing")}
          />
        )}

        {currentView === "signup" && (
          <ParticipantSignUp
            onComplete={handleLoginSuccess}
            onBack={() => setCurrentView("role_select")}
            onGoToLogin={() => setCurrentView("participant_login")}
            onOpenPrivacy={() => setCurrentView("privacy")}
          />
        )}

        {currentView === "participant_login" && (
          <ParticipantLogin
            onSuccess={handleLoginSuccess}
            onBack={() => setCurrentView("role_select")}
            onGoToSignUp={() => setCurrentView("signup")}
          />
        )}

        {currentView === "support_login" && (
          <SupportLogin
            onSuccess={handleLoginSuccess}
            onBack={() => setCurrentView("role_select")}
            onGoToApply={() => setCurrentView("support_signup")}
          />
        )}

        {currentView === "support_signup" && (
          <SupportWorkerSignUp onBack={() => setCurrentView("support_login")} />
        )}

        {currentView === "counsellor_profile" && currentUser && currentUser.role === "support_worker" && (
          <CounsellorProfileEditor
            user={currentUser}
            participants={participants}
            onBack={() => setCurrentView("dashboard")}
          />
        )}

        {currentView === "choose_counsellor" && currentUser && participantRecordForUser && (
          <ChooseCounsellor
            user={currentUser}
            participantId={participantRecordForUser.id}
            currentWorkerId={participantRecordForUser.assignedWorker}
            onAssignmentChanged={(workerId) => {
              // select_counsellor() has already written this. All that is left
              // is to stop the rest of the app reading a cached record that
              // still names the counsellor this person just left.
              participantStore.applyAssignedWorker(participantRecordForUser.id, workerId);
              setParticipants(participantStore.getAllParticipants());
            }}
            onBack={() => setCurrentView("participant_home")}
          />
        )}

        {currentView === "voice_companion" && currentUser && currentUser.role === "participant" && (
          <VoiceCompanion
            onBack={() => setCurrentView("participant_home")}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
          />
        )}

        {currentView === "wellbeing_index" && currentUser && participantRecordForUser && (
          <WellbeingIndex
            participantId={participantRecordForUser.id}
            onDone={() => setCurrentView("participant_home")}
            onCancel={() => setCurrentView("participant_home")}
          />
        )}

        {/* The Victim Recovery Hub. One route: the sub-screens live inside the
            feature so the case bundle stays in one place and so a case id never
            reaches the address bar. */}
        {currentView === "recovery_hub" && currentUser && (
          <RecoveryHub
            userName={currentUser.name}
            userEmail={currentUser.email}
            language={currentUser.language || "en"}
            onBack={() => setCurrentView("participant_home")}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
          />
        )}

        {currentView === "what_to_expect" && currentUser && (
          <WhatToExpect
            onBack={() => setCurrentView("participant_home")}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            onOpenMessages={() => setCurrentView("messages")}
            onOpenRecoveryHub={() => setCurrentView("recovery_hub")}
          />
        )}

        {currentView === "participant_home" && currentUser && (
          <ParticipantProfile
            user={currentUser}
            participantRecord={participantRecordForUser}
            onStartCheckin={() => setCurrentView("checkin")}
            onOpenMessages={() => setCurrentView("messages")}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            onOpenPrivacy={() => setCurrentView("privacy")}
            onOpenChooseCounsellor={() => setCurrentView("choose_counsellor")}
            onOpenVoiceCompanion={() => setCurrentView("voice_companion")}
            onOpenWellbeingIndex={() => setCurrentView("wellbeing_index")}
            onOpenWhatToExpect={() => setCurrentView("what_to_expect")}
            onOpenConsent={() => setCurrentView("consent_mgmt")}
            onLogout={handleLogout}
            onUpdateConsent={handleUpdateConsent}
            onDataReset={() => {
              setParticipants(participantStore.getAllParticipants());
              setAlerts(participantStore.getAlerts());
            }}
            onViewResults={() => {
              // Resolve the check-in and its analysis together, through the
              // same record lookup the rest of this screen uses. Reading the
              // analysis by user id and the check-in by user record meant the
              // two could disagree about which participant they belonged to —
              // and for anyone whose record is not keyed by their auth id
              // (the demo participant, anything rehydrated from Supabase) the
              // analysis came back null and this button did nothing at all.
              const latest = participantStore.getLatestResultForUser(currentUser);
              if (!latest) return;
              setLastCheckInAnalysis(latest.analysis);
              setLastSubmittedCheckIn(latest.checkIn);
              setCurrentView("checkin_results");
            }}
          />
        )}

        {currentView === "checkin" && currentUser && (
          <ParticipantCheckin
            participantId={currentUser.id}
            previousCheckIn={
              participantRecordForUser && (participantRecordForUser.checkIns || []).length > 0
                ? participantRecordForUser.checkIns[participantRecordForUser.checkIns.length - 1]
                : null
            }
            onSaveCheckIn={handleSaveCheckIn}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            onGoToProfile={() => setCurrentView("participant_home")}
          />
        )}

        {currentView === "checkin_results" && lastCheckInAnalysis && currentUser && lastSubmittedCheckIn && (
          <CheckInResults
            analysis={lastCheckInAnalysis}
            user={currentUser}
            checkIn={lastSubmittedCheckIn}
            participantRecord={participantRecordForUser}
            onNavigate={setCurrentView}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
          />
        )}

        {currentView === "dashboard" && (
          <SupportDashboard
            participants={participants}
            alerts={alerts}
            onSelectParticipant={handleReviewParticipant}
            onNavigateAlerts={() => setCurrentView("alerts")}
          />
        )}

        {currentView === "detail" && (
          selectedParticipant ? (
            <ParticipantDetail
              participant={selectedParticipant}
              onBack={() => setCurrentView("dashboard")}
              onUpdateStatus={handleUpdateStatus}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onOpenEmergency={() => setEmergencyModalOpen(true)}
              onAssignWorker={handleAssignWorker}
              currentUser={currentUser}
            />
          ) : (
            <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
              <h2 className="text-xl font-bold text-[#3C3530]">Participant profile could not be found</h2>
              <p className="text-xs text-[#7F8C8D]">The selected participant record may have been removed or does not exist.</p>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="px-4 py-2 bg-[#3C3530] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )
        )}

        {currentView === "alerts" && (
          <AlertsPage
            alerts={alerts}
            participants={participants}
            onSelectParticipant={handleReviewParticipant}
            onUpdateAlert={handleUpdateAlert}
            currentUser={currentUser}
          />
        )}

        {currentView === "follow_ups" && (
          <FollowUps
            participants={participants}
            onSelectParticipant={handleReviewParticipant}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            currentUser={currentUser}
          />
        )}

        {currentView === "community" && (
          <CommunityInsights
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            participants={participants}
            alerts={alerts}
          />
        )}
        {currentView === "support_resources" && (
          <SupportResources
            userRole={currentUser?.role || ""}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
          />
        )}

        {currentView === "audit_log" && (
          <AuditLog currentUser={currentUser} participants={participants} />
        )}

        {currentView === "consent_mgmt" && (
          <ConsentManagement
            user={currentUser}
            onBack={() => setCurrentView(currentUser?.role === "support_worker" ? "dashboard" : "participant_home")}
            onUpdateConsentStatus={handleUpdateConsent}
          />
        )}

        {currentView === "privacy" && (
          <PrivacyArchitecture
            onOpenEmergency={() => setEmergencyModalOpen(true)}
          />
        )}

        {currentView === "messages" && currentUser && (
          <Messages
            currentUser={currentUser}
            participants={participants}
            participantRecord={participantRecordForUser}
            onOpenEmergency={() => setEmergencyModalOpen(true)}
            onChooseCounsellor={
              participantRecordForUser ? () => setCurrentView("choose_counsellor") : undefined
            }
          />
        )}

        {currentView === "notifications" && (
          <NotificationsPage
            user={currentUser}
            participants={participants}
            onNavigate={(view, participantId) => {
              if (view === "emergency") {
                setEmergencyModalOpen(true);
              } else {
                if (participantId) {
                  setSelectedParticipantId(participantId);
                }
                setCurrentView(view);
              }
            }}
          />
        )}
      </ErrorBoundary>
      </main>

      {/* Emergency Crisis Modal */}
      <EmergencyModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
      />

      {/*
        The participant id is what lets the server raise a counsellor alert
        when someone types something that needs a person rather than a model.
        Without it the assistant still shows crisis lines, but it says plainly
        that nobody here was told.
      */}
      <GeminiChatbot
        participantId={participantRecordForUser?.id}
        onOpenEmergencyResources={() => setEmergencyModalOpen(true)}
      />

      {/* The way out, for the person whose phone may not be their own. Shown
          to participants only: a counsellor at a desk is not the threat model,
          and an extra control on every staff screen would be noise. */}
      <SafetyExitButton visible={currentUser?.role === "participant"} />
    </div>
  );
};

export default App;
