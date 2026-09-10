import React, { useState } from "react";
import { FirstAidKitEditor } from "../../components/FirstAidKitEditor";
import { FirstAidKit, LanguageCode } from "../../types";
import { kitItemCount } from "../../services/firstAidKit";
import { useLanguage } from "../../context/LanguageContext";
import { LANGUAGE_BY_CODE, loadSavedLanguage } from "../../services/translation";
import {
  Shield,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HeartHandshake,
  Lock,
  ExternalLink
, HeartPulse } from "lucide-react";
import { authService } from "../../services/authService";

interface Props {
  onComplete: () => void;
  onBack: () => void;
  onGoToLogin: () => void;
  onOpenPrivacy: () => void;
}

export const ParticipantSignUp: React.FC<Props> = ({
  onComplete,
  onBack,
  onGoToLogin,
  onOpenPrivacy
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  // Offered once the account exists rather than inside the sign-up form:
  // authoring a personal coping kit is a different kind of task from filling
  // in a registration field, and it must not be able to fail validation or
  // stand between someone and their account.
  const [buildingKit, setBuildingKit] = useState(false);
  const [kitDraft, setKitDraft] = useState<FirstAidKit | undefined>(undefined);

  const finishKit = () => {
    if (kitDraft && kitItemCount(kitDraft) > 0) {
      void authService.updateFirstAidKit(kitDraft);
    }
    onComplete();
  };
  const [showPassword, setShowPassword] = useState(false);
  const { lang, setLang, languages } = useLanguage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Seeded from the language already chosen, so the stored preference
    // matches what the person is actually reading even if they never touch
    // the field.
    language: LANGUAGE_BY_CODE[loadSavedLanguage()]?.english || "English",
    ageRange: "25-34",
    supportPreference: "In-app support information",
    emergencyContact: "",
    consentVoluntary: false,
    consentNoDiagnosis: false,
    consentUsage: false
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your preferred or first name.";
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match.";
    }

    if (!formData.consentVoluntary || !formData.consentNoDiagnosis || !formData.consentUsage) {
      newErrors.consent = "Please confirm that you understand and agree to all consent items.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      try {
        await authService.signUp({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          language: formData.language,
          ageRange: formData.ageRange,
          supportPreference: formData.supportPreference,
          emergencyContact: formData.emergencyContact.trim() || undefined,
          consentGiven: true
        });
        setIsSuccess(true);
      } catch (err: any) {
        setErrors({ submit: err.message || "Failed to register. Please try again." });
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white p-8 sm:p-12 rounded-3xl shadow-xs border border-[#EFE8E2] text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-[#DBC3B2]/20 text-[#5A5049] rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
              Registration Successful
            </span>
            <h2 className="text-3xl font-black text-[#3C3530]">Welcome to AURA</h2>
            <p className="text-sm text-[#7A726C] leading-relaxed">
              Your demonstration participant account has been created. Before your first wellbeing check-in, we will review how your reflections are processed.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-left text-xs text-[#7A726C] space-y-2">
            <div className="flex items-center space-x-2 font-bold text-[#3C3530]">
              <Shield size={16} className="text-[#5A5049]" />
              <span>Participant Safeguards Active</span>
            </div>
            <p>• Anonymous ID generated for this session.</p>
            <p>• You can skip any question or stop at any time.</p>
          </div>

          {buildingKit ? (
            <div className="text-left space-y-5">
              <FirstAidKitEditor kit={kitDraft} onChange={setKitDraft} showSharing={false} compact />
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={finishKit}
                  className="flex-1 py-3.5 rounded-2xl bg-[#5A5049] text-white font-bold text-sm hover:bg-[#3C3530] transition-all cursor-pointer"
                >
                  {kitItemCount(kitDraft) > 0 ? "Save and continue" : "Continue"}
                </button>
                <button
                  onClick={() => setBuildingKit(false)}
                  className="sm:w-auto py-3.5 px-5 rounded-2xl border border-[#EFE8E2] text-[#5A5049] font-bold text-sm hover:bg-[#FDF9F5] transition-colors cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Offered, never required. Someone who has just registered may
                  have no capacity for this today, and the account works
                  perfectly well without it — the same offer waits on the
                  wellbeing board for as long as they want. */}
              <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-left space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#3C3530] text-sm">
                  <HeartPulse size={16} className="text-[#A55D25]" />
                  <span>Make your own first aid kit</span>
                </div>
                <p className="text-xs text-[#7A726C] leading-relaxed">
                  A short, private list of what helps <em>you</em> — a song, a place you go, someone you could
                  message. Written now, while it is easier to think, so a harder day does not have to.
                </p>
              </div>

              <button
                onClick={() => setBuildingKit(true)}
                className="w-full py-4 rounded-2xl bg-[#5A5049] text-white font-bold text-base hover:bg-[#3C3530] transition-all shadow-xs flex items-center justify-center space-x-2 group cursor-pointer"
              >
                <span>Make my first aid kit</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onComplete}
                className="w-full py-3 rounded-2xl border border-[#EFE8E2] text-[#5A5049] font-bold text-sm hover:bg-[#FDF9F5] transition-colors cursor-pointer"
              >
                Skip for now — I can do this later
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-[#7F8C8D] hover:text-[#3C3530] transition-colors flex items-center space-x-1.5 mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Role Selection</span>
        </button>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Privacy Information Box */}
          <div className="lg:col-span-5 bg-[#3C3530] text-white p-8 rounded-3xl space-y-6 shadow-xs border border-[#3F4E4E]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#DBC3B2] text-[#3C3530] flex items-center justify-center font-bold mb-4">
                <Shield size={20} />
              </div>
              <h3 className="text-2xl font-black text-white">Your privacy matters</h3>
              <p className="text-xs text-[#EFE8E2]/90 mt-2 leading-relaxed">
                This hackathon prototype uses synthetic/demo data. A real deployment would require informed consent, secure storage, encryption, access controls, data minimization, and appropriate ethical/legal review.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#3F4E4E] text-xs text-[#EFE8E2]/90">
              <div className="flex items-start space-x-2">
                <CheckCircle2 size={16} className="text-[#DBC3B2] shrink-0 mt-0.5" />
                <span>Voluntary participation — skip or leave anytime.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 size={16} className="text-[#DBC3B2] shrink-0 mt-0.5" />
                <span>No diagnosis — provides supportive signals only.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 size={16} className="text-[#DBC3B2] shrink-0 mt-0.5" />
                <span>Human-in-the-loop review for all elevated signals.</span>
              </div>
            </div>

            <button
              onClick={onOpenPrivacy}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#DBC3B2] hover:text-white underline pt-2 cursor-pointer"
            >
              <span>Read Full Privacy & Architecture Policy</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {/* Right Form Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-3xl border border-[#EFE8E2] shadow-xs">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530] tracking-tight">
                Create your AURA account
              </h2>
              <p className="text-xs sm:text-sm text-[#7F8C8D] mt-1">
                Your information is private and used only to provide your wellbeing experience.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            {errors.submit && (
              <div className="bg-[#A55D25]/10 border border-[#A55D25] p-3 rounded-lg">
                <p className="text-xs text-[#A55D25] font-medium">{errors.submit}</p>
              </div>
            )}
              {/* Preferred Name */}
              <div>
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                  Preferred Name or Pseudonym *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] focus:border-transparent text-sm"
                />
                {errors.name && <p className="text-xs text-[#A55D25] mt-1 font-medium">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] focus:border-transparent text-sm"
                />
                {errors.email && <p className="text-xs text-[#A55D25] mt-1 font-medium">{errors.email}</p>}
              </div>

              {/* Passwords */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] focus:border-transparent text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7F8C8D] hover:text-[#3C3530] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-[#A55D25] mt-1 font-medium">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] focus:border-transparent text-sm"
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-[#A55D25] mt-1 font-medium">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Language & Age Range */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                    Preferred Language
                  </label>
                  {/* Choosing here switches the app immediately, so the rest
                      of sign-up and every screen after it is already in the
                      person's language rather than waiting for a setting they
                      have to find later. */}
                  <select
                    value={lang}
                    onChange={(e) => {
                      const code = e.target.value as LanguageCode;
                      setLang(code);
                      setFormData({ ...formData, language: LANGUAGE_BY_CODE[code]?.english || "English" });
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm cursor-pointer"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.code === "en" ? l.native : `${l.native} · ${l.english}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                    Age Range (Privacy-first)
                  </label>
                  <select
                    value={formData.ageRange}
                    onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm cursor-pointer"
                  >
                    <option value="18-24">18–24 years</option>
                    <option value="25-34">25–34 years</option>
                    <option value="35-44">35–44 years</option>
                    <option value="45-54">45–54 years</option>
                    <option value="55+">55+ years</option>
                  </select>
                </div>
              </div>

              {/* Preferred Support Method */}
              <div>
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                  Preferred Support Method
                </label>
                <select
                  value={formData.supportPreference}
                  onChange={(e) => setFormData({ ...formData, supportPreference: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] text-sm cursor-pointer"
                >
                  <option value="In-app support information">In-app support information & grounding</option>
                  <option value="Human counselor">Human counselor / therapist</option>
                  <option value="Trusted person">Trusted friend or community contact</option>
                  <option value="Not sure yet">Not sure yet</option>
                </select>
              </div>

              {/* Emergency / Trusted Contact — optional, always skippable */}
              <div>
                <label className="block text-xs font-bold text-[#7F8C8D] uppercase tracking-wider mb-1.5">
                  Emergency / Trusted Contact <span className="normal-case font-medium text-[#B9B0A6]">(optional — you can skip this)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya (sister) — +91 98xxxxxxx"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EFE8E2] bg-[#FDF9F5] text-[#3C3530] focus:outline-none focus:ring-2 focus:ring-[#5A5049] focus:border-transparent text-sm"
                />
                <p className="text-[11px] text-[#7F8C8D] mt-1">
                  Only a name and how to reach someone you trust. Leave blank if naming a contact is not safe for you — it is never required.
                </p>
              </div>

              {/* Consent Checkboxes */}
              <div className="pt-3 border-t border-[#EFE8E2] space-y-2.5">
                <label className="flex items-start space-x-3 text-xs text-[#3C3530] cursor-pointer p-2.5 rounded-xl hover:bg-[#FDF9F5] border border-[#EFE8E2]">
                  <input
                    type="checkbox"
                    checked={formData.consentVoluntary}
                    onChange={(e) => setFormData({ ...formData, consentVoluntary: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5A5049] focus:ring-[#5A5049] mt-0.5 accent-[#5A5049]"
                  />
                  <span>
                    <strong>I am voluntarily participating</strong> in this demonstration.
                  </span>
                </label>

                <label className="flex items-start space-x-3 text-xs text-[#3C3530] cursor-pointer p-2.5 rounded-xl hover:bg-[#FDF9F5] border border-[#EFE8E2]">
                  <input
                    type="checkbox"
                    checked={formData.consentNoDiagnosis}
                    onChange={(e) => setFormData({ ...formData, consentNoDiagnosis: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5A5049] focus:ring-[#5A5049] mt-0.5 accent-[#5A5049]"
                  />
                  <span>
                    <strong>I understand that AURA provides wellbeing signals</strong> and does not provide medical or psychological diagnoses.
                  </span>
                </label>

                <label className="flex items-start space-x-3 text-xs text-[#3C3530] cursor-pointer p-2.5 rounded-xl hover:bg-[#FDF9F5] border border-[#EFE8E2]">
                  <input
                    type="checkbox"
                    checked={formData.consentUsage}
                    onChange={(e) => setFormData({ ...formData, consentUsage: e.target.checked })}
                    className="w-4 h-4 rounded text-[#5A5049] focus:ring-[#5A5049] mt-0.5 accent-[#5A5049]"
                  />
                  <span>
                    <strong>I understand how my information is used</strong> to support human follow-up.
                  </span>
                </label>

                {errors.consent && (
                  <p className="text-xs text-[#A55D25] font-bold">{errors.consent}</p>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-[#5A5049] text-white font-bold text-sm hover:bg-[#3C3530] transition-all shadow-xs active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="text-center pt-2 text-xs text-[#7F8C8D]">
                <span>Already have an account? </span>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="font-bold text-[#5A5049] hover:underline cursor-pointer"
                >
                  Log In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
