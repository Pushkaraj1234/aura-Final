import React, { useState, useEffect } from "react";
import { AlertTriangle, Phone, ShieldCheck, HeartHandshake, Globe, X, ExternalLink } from "lucide-react";
import { auditService } from "../services/auditService";
import { authService } from "../services/authService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const REGIONAL_RESOURCES = [
  // --- India (deployment region) -----------------------------------------
  {
    region: "India (National)",
    name: "Tele MANAS, the national mental health helpline (Govt. of India)",
    contact: "14416  ·  1-800-891-4416",
    detail: "24/7, free, confidential. Support in Hindi, English, Marathi and other regional languages.",
    type: "phone"
  },
  {
    region: "India (National)",
    name: "KIRAN Mental Health Rehabilitation Helpline",
    contact: "1800-599-0019",
    detail: "Free, 24/7, in 13 languages. Run by the Ministry of Social Justice and Empowerment.",
    type: "phone"
  },
  {
    region: "India (National)",
    name: "Vandrevala Foundation Helpline",
    contact: "1860-2662-345  ·  +91 99996 66555",
    detail: "24/7 free counselling by phone and WhatsApp for anyone in emotional distress.",
    type: "phone"
  },
  {
    region: "India (National)",
    name: "Emergency Services (Police / Fire / Medical)",
    contact: "Dial 112  ·  Ambulance 108",
    detail: "National single emergency number. 108 reaches emergency ambulance services across India.",
    type: "phone"
  },
  {
    region: "Maharashtra, India",
    name: "iCALL Psychosocial Helpline (TISS, Mumbai)",
    contact: "+91 91529 87821",
    detail: "Free counselling by trained professionals. Mon–Sat, 10 a.m.–8 p.m. Email & chat also available.",
    type: "phone"
  },
  {
    region: "Maharashtra, India",
    name: "AASRA, suicide prevention (Mumbai)",
    contact: "+91 98204 66726",
    detail: "24/7 confidential support for anyone feeling suicidal or in emotional crisis.",
    type: "phone"
  },
  {
    region: "Maharashtra, India",
    name: "Connecting Trust, distress helpline (Pune)",
    contact: "+91 99220 01122  ·  +91 99220 04305",
    detail: "Emotional support and suicide prevention. Every day, 12 p.m.–8 p.m.",
    type: "phone"
  },
  {
    region: "International / Global",
    name: "Befrienders Worldwide",
    contact: "befrienders.org",
    detail: "Global directory of free, confidential emotional support & suicide prevention centers in 32+ countries.",
    type: "web"
  },
  {
    region: "International / Global",
    name: "Find A Helpline (Free Worldwide Directory)",
    contact: "findahelpline.com",
    detail: "Free, confidential support from local crisis lines in 130+ countries via phone, text, or webchat.",
    type: "web"
  },
  {
    region: "North America (US & Canada)",
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    detail: "Available 24/7 in English and Spanish. Free and confidential support.",
    type: "phone"
  },
  {
    region: "North America (US & Canada)",
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    detail: "24/7 free text line connecting with a crisis counselor.",
    type: "phone"
  },
  {
    region: "Europe & UK",
    name: "European Emergency Services",
    contact: "Dial 112",
    detail: "Universal emergency number across all EU member states and UK.",
    type: "phone"
  },
  {
    region: "Europe & UK",
    name: "Samaritans (UK & ROI)",
    contact: "Dial 116 123",
    detail: "Free 24/7 listening service for anyone in emotional distress.",
    type: "phone"
  },
  {
    region: "Middle East & North Africa",
    name: "Embrace Lifeline (Lebanon / Regional)",
    contact: "Dial 1564",
    detail: "National emotional support and suicide prevention helpline.",
    type: "phone"
  },
  {
    region: "Humanitarian & Displacement",
    name: "UNHCR Protection & Mental Health Directory",
    contact: "help.unhcr.org",
    detail: "Country-specific support services for refugees, asylum-seekers, and displaced populations.",
    type: "web"
  }
];

export const EmergencyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  // Deployment region: India. Default the filter to India-national lines so the
  // most relevant numbers are shown first; "All" still lists everything.
  const [selectedRegion, setSelectedRegion] = useState("India (National)");

  useEffect(() => {
    if (isOpen) {
      const user = authService.getCurrentUser();
      auditService.recordAuditEvent({
        actorId: user?.id || "ANONYMOUS",
        actorRole: user?.role === "support_worker" ? "SUPPORT_WORKER" : "PARTICIPANT",
        actorName: user?.name || "Participant",
        action: "EMERGENCY_RESOURCES_ACCESSED",
        category: "SAFETY",
        participantId: user?.role === "participant" ? user.id : undefined,
        description: `Emergency crisis safety resources accessed (${user?.name || "User"})`,
        severity: "HIGH"
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const regions = ["All", "India (National)", "Maharashtra, India", "International / Global", "North America (US & Canada)", "Europe & UK", "Middle East & North Africa", "Humanitarian & Displacement"];

  const filtered = selectedRegion === "All"
    ? REGIONAL_RESOURCES
    : REGIONAL_RESOURCES.filter(r => r.region === selectedRegion);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3C3530]/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-[#A55D25]/30 overflow-hidden my-8">
        {/* Top Emergency Header */}
        <div className="bg-[#A55D25] text-white p-6 sm:p-8 flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
              <AlertTriangle className="text-white" size={26} />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-white/90 block mb-1">
                Emergency Crisis Protocol
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Immediate Support & Safety
              </h2>
              <p className="text-white/90 text-sm mt-1 leading-relaxed">
                If you or someone you know is in immediate danger or experiencing severe crisis, please reach out to trusted human emergency resources right now.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors ml-2 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Ethical Banner */}
          <div className="bg-[#D49B6A]/15 border border-[#D49B6A]/30 rounded-2xl p-4 flex items-start space-x-3 text-[#3C3530] text-xs sm:text-sm">
            <ShieldCheck className="text-[#D49B6A] shrink-0 mt-0.5" size={18} />
            <div>
              <span className="font-bold block mb-0.5 text-[#3C3530]">Important Safety Principle</span>
              AURA is an assistive AI prototype and <strong className="font-semibold">does NOT automatically dispatch police or medical services</strong>. You retain full control over your outreach.
            </div>
          </div>

          {/* Region filter */}
          <div>
            <label className="text-xs font-bold text-[#7F8C8D] uppercase tracking-wider block mb-2 flex items-center">
              <Globe size={14} className="mr-1.5 text-[#7F8C8D]" /> Filter Resources by Region
            </label>
            <div className="flex flex-wrap gap-1.5">
              {regions.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedRegion === r
                      ? "bg-[#3C3530] text-white shadow-xs"
                      : "bg-[#FDF9F5] border border-[#EFE8E2] text-[#7A726C] hover:bg-[#EFE8E2]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Resources List */}
          <div className="space-y-3">
            {filtered.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-[#EFE8E2] hover:border-[#A55D25]/50 hover:bg-[#A55D25]/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FDF9F5] border border-[#EFE8E2] text-[#7A726C]">
                      {item.region}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#3C3530] text-base">{item.name}</h4>
                  <p className="text-xs text-[#7F8C8D]">{item.detail}</p>
                </div>
                <div className="sm:text-right shrink-0">
                  <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#A55D25] text-white font-bold text-sm shadow-xs hover:bg-[#c26d4e] transition-colors">
                    {item.type === "phone" ? <Phone size={15} /> : <ExternalLink size={15} />}
                    <span>{item.contact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Grounding & trusted person */}
          <div className="bg-[#FDF9F5] border border-[#EFE8E2] rounded-2xl p-5 space-y-2">
            <h4 className="font-bold text-[#3C3530] text-sm flex items-center">
              <HeartHandshake className="text-[#5A5049] mr-2" size={18} /> Immediate Grounding Steps
            </h4>
            <ul className="text-xs text-[#7A726C] space-y-1.5 pl-2 list-disc list-inside leading-relaxed">
              <li>Move to a safe, quiet space if physically possible.</li>
              <li>Connect with a trusted friend, family member, or community leader.</li>
              <li>Practice slow 4-count diaphragmatic breathing (inhale 4s, hold 4s, exhale 4s).</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-[#FDF9F5] border-t border-[#EFE8E2] flex items-center justify-between">
          <span className="text-xs text-[#7F8C8D] font-medium">
            Demo Prototype • Emergency Directory
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-colors cursor-pointer"
          >
            I am Safe / Close
          </button>
        </div>
      </div>
    </div>
  );
};
