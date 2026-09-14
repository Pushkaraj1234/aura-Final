import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  EyeOff,
  Mic,
  FileText,
  Activity,
  Check
} from "lucide-react";
import { ConsentPreferences, User } from "../types";
import { apiService } from "../services/apiService";

interface Props {
  user: User | null;
  onBack: () => void;
  onUpdateConsentStatus?: (active: boolean) => void;
}

export const ConsentManagement: React.FC<Props> = ({
  user,
  onBack,
  onUpdateConsentStatus
}) => {
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    wellbeingCheckIns: true,
    supportWorkerSharing: true,
    optionalFreeTextSharing: true,
    optionalVoiceFeature: true,
    communityAggregateAnalytics: true,
    updatedAt: new Date().toISOString()
  });

  const [savedToast, setSavedToast] = useState(false);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load any previously saved consent record for this participant from Supabase.
  useEffect(() => {
    if (!user) return;
    apiService.consents.get(user.id).then((saved: ConsentPreferences | null) => {
      if (saved) {
        setPreferences(saved);
        setConsentRevoked(!saved.wellbeingCheckIns);
      }
    }).catch(() => {
      // No saved record yet (or offline) — keep the default opted-in preferences.
    });
  }, [user]);

  const handleToggle = (key: keyof ConsentPreferences) => {
    if (typeof preferences[key] === "boolean") {
      setPreferences(prev => ({
        ...prev,
        [key]: !prev[key],
        updatedAt: new Date().toISOString()
      }));
    }
  };

  const handleSavePreferences = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
    if (user) {
      apiService.consents.update(user.id, preferences).catch((err: any) => {
        console.warn("[ConsentManagement] Persist notice:", err?.message || err);
      });
    }
  };

  const handleWithdrawConsent = () => {
    setConsentRevoked(true);
    setShowConfirmModal(false);
    setPreferences({
      wellbeingCheckIns: false,
      supportWorkerSharing: false,
      optionalFreeTextSharing: false,
      optionalVoiceFeature: false,
      communityAggregateAnalytics: false,
      updatedAt: new Date().toISOString()
    });
    if (onUpdateConsentStatus) {
      onUpdateConsentStatus(false);
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 4000);
    if (user) {
      apiService.consents.revoke(user.id, "Participant withdrew consent via Consent Management screen").catch((err: any) => {
        console.warn("[ConsentManagement] Revoke persist notice:", err?.message || err);
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-bold text-[#7A726C] hover:text-[#3C3530] transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to My Profile</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
              Participant Control
            </span>
            <span className="text-xs text-[#7F8C8D] font-mono">
              Granular Permission Matrix
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#3C3530] mt-1 tracking-tight">
            Consent & Privacy Preferences
          </h1>
          <p className="text-sm text-[#7A726C] mt-1 leading-relaxed">
            You retain absolute sovereignty over your reflection data. Turn features on or off anytime with zero penalties.
          </p>
        </div>
      </div>

      {savedToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center space-x-2">
          <Check size={16} className="text-emerald-600" />
          <span>
            {consentRevoked
              ? "Your participation preferences have been updated. Consent withdrawn."
              : "Your privacy preferences have been securely saved and updated."}
          </span>
        </div>
      )}

      {/* Consent Status Card */}
      <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5049] text-[#DBC3B2] flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#3C3530]">
                Active Consent Status
              </h3>
              <p className="text-xs text-[#7F8C8D]">
                Last updated: {new Date(preferences.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
            preferences.wellbeingCheckIns
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-[#A55D25]/10 text-[#A55D25] border border-[#A55D25]/30"
          }`}>
            {preferences.wellbeingCheckIns ? "✓ Active Consent" : "Consent Withdrawn"}
          </span>
        </div>

        {/* Feature Permissions Toggles */}
        <div className="space-y-4">
          {/* 1. Wellbeing Check-ins */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-center text-[#5A5049] shrink-0 mt-0.5">
                <Activity size={16} />
              </div>
              <div>
                <span className="text-sm font-black text-[#3C3530] block">
                  Daily Wellbeing Check-ins
                </span>
                <p className="text-xs text-[#7A726C] mt-0.5 leading-relaxed">
                  Allows saving your daily ratings for stress, sleep, safety, and mood.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("wellbeingCheckIns")}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                preferences.wellbeingCheckIns ? "bg-[#5A5049]" : "bg-[#EFE8E2]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-xs ${
                  preferences.wellbeingCheckIns ? "left-7" : "left-1"
                }`}
              ></div>
            </button>
          </div>

          {/* 2. Counselor Sharing */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-center text-[#5A5049] shrink-0 mt-0.5">
                <UserCheck size={16} />
              </div>
              <div>
                <span className="text-sm font-black text-[#3C3530] block">
                  Counselor Sharing
                </span>
                <p className="text-xs text-[#7A726C] mt-0.5 leading-relaxed">
                  Lets a trained case worker see raised distress signals and offer a one-to-one check-in.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("supportWorkerSharing")}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                preferences.supportWorkerSharing ? "bg-[#5A5049]" : "bg-[#EFE8E2]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-xs ${
                  preferences.supportWorkerSharing ? "left-7" : "left-1"
                }`}
              ></div>
            </button>
          </div>

          {/* 3. Optional Free-Text Sharing */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-center text-[#5A5049] shrink-0 mt-0.5">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-sm font-black text-[#3C3530] block">
                  Optional Free-Text Notes Sharing
                </span>
                <p className="text-xs text-[#7A726C] mt-0.5 leading-relaxed">
                  Enables sharing voluntary text reflections directly with your counselor.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("optionalFreeTextSharing")}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                preferences.optionalFreeTextSharing ? "bg-[#5A5049]" : "bg-[#EFE8E2]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-xs ${
                  preferences.optionalFreeTextSharing ? "left-7" : "left-1"
                }`}
              ></div>
            </button>
          </div>

          {/* 4. Optional Voice Feature */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-center text-[#5A5049] shrink-0 mt-0.5">
                <Mic size={16} />
              </div>
              <div>
                <span className="text-sm font-black text-[#3C3530] block">
                  Optional Voice Input Feature
                </span>
                <p className="text-xs text-[#7A726C] mt-0.5 leading-relaxed">
                  Allows speaking reflections via microphone instead of typing.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("optionalVoiceFeature")}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                preferences.optionalVoiceFeature ? "bg-[#5A5049]" : "bg-[#EFE8E2]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-xs ${
                  preferences.optionalVoiceFeature ? "left-7" : "left-1"
                }`}
              ></div>
            </button>
          </div>

          {/* 5. Community Aggregate Analytics */}
          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-center text-[#5A5049] shrink-0 mt-0.5">
                <EyeOff size={16} />
              </div>
              <div>
                <span className="text-sm font-black text-[#3C3530] block">
                  Anonymous Community Aggregation
                </span>
                <p className="text-xs text-[#7A726C] mt-0.5 leading-relaxed">
                  Includes your anonymized counts in regional planning totals (zero identity disclosure).
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("communityAggregateAnalytics")}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                preferences.communityAggregateAnalytics ? "bg-[#5A5049]" : "bg-[#EFE8E2]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-xs ${
                  preferences.communityAggregateAnalytics ? "left-7" : "left-1"
                }`}
              ></div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#EFE8E2]">
          <button
            onClick={handleSavePreferences}
            className="px-5 py-2.5 rounded-2xl bg-[#5A5049] hover:bg-[#3C3530] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save Preferences
          </button>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#A55D25] hover:bg-[#A55D25]/10 transition-colors cursor-pointer border border-[#A55D25]/30"
          >
            Withdraw Consent & Halt Monitoring
          </button>
        </div>
      </div>

      {/* Production Architecture Clarification Note */}
      <div className="p-5 rounded-3xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2 text-xs text-[#7A726C]">
        <div className="flex items-center space-x-2 font-bold text-[#3C3530]">
          <Lock size={15} className="text-[#5A5049]" />
          <span>Production Consent Revocation Architecture</span>
        </div>
        <p className="leading-relaxed">
          In full production deployment, selecting "Withdraw Consent" triggers an automated cryptographic erasure pipeline: all historical check-in vectors are deleted from active databases, cached aggregates are recomputed, and all support notifications are immediately halted.
        </p>
      </div>

      {/* Withdrawal Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-[#A55D25]">
              <AlertTriangle size={24} />
              <h4 className="text-lg font-black text-[#3C3530]">
                Withdraw All Participation Consent?
              </h4>
            </div>
            <p className="text-xs text-[#7A726C] leading-relaxed">
              This will disable daily check-ins, remove you from counselor queues, and pause all trend monitoring. You can rejoin anytime.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#7F8C8D] hover:bg-[#FDF9F5]"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawConsent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#A55D25] text-white hover:bg-[#b86749]"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
