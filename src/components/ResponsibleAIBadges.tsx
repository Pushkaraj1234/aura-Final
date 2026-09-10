import React, { useState } from "react";
import {
  ShieldAlert,
  Scale,
  Cpu,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Globe2,
  Users,
  EyeOff,
  Compass,
  ArrowRight
} from "lucide-react";

/**
 * Signal Strength vs Human Review Card
 */
export const SignalStrengthVsHumanCard: React.FC<{ signalText?: string; score?: number }> = ({
  signalText = "Strong change detected across consecutive check-ins",
  score = 72
}) => {
  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D] flex items-center">
          <Scale size={15} className="mr-1.5 text-[#5A5049]" />
          AI Signal Strength vs. Human Review
        </h4>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
          Responsible AI
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* AI Signal Strength */}
        <div className="p-4 rounded-2xl bg-[#A55D25]/10 border border-[#A55D25]/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#A55D25] uppercase tracking-wider">
              AI Signal Strength
            </span>
            <span className="font-mono text-xs font-bold text-[#A55D25]">
              Score: {score}/100
            </span>
          </div>
          <p className="text-sm font-black text-[#3C3530]">
            {signalText}
          </p>
          <p className="text-[11px] text-[#7A726C] leading-relaxed">
            Mathematical delta in self-reported indicators. Does <strong>not</strong> quantify mental health disorder or emotional certainty.
          </p>
        </div>

        {/* Human Oversight Requirement */}
        <div className="p-4 rounded-2xl bg-[#5A5049]/10 border border-[#5A5049]/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5A5049] uppercase tracking-wider">
              Human Review Status
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5A5049] text-white">
              Mandatory
            </span>
          </div>
          <p className="text-sm font-black text-[#3C3530]">
            Humanitarian Review Required
          </p>
          <p className="text-[11px] text-[#7A726C] leading-relaxed">
            All non-routine actions must be evaluated by a trained human worker who speaks directly with the participant.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-center justify-between text-xs text-[#7A726C]">
        <span className="font-semibold text-[#3C3530]">
          Key Ethical Tenet:
        </span>
        <span className="font-mono text-[11px] text-[#5A5049] font-bold">
          Signal strength ≠ diagnosis | Signal strength ≠ certainty
        </span>
      </div>
    </div>
  );
};

/**
 * Model Transparency Card (About the AI)
 */
export const ModelTransparencyCard: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3C3530] text-[#DBC3B2] flex items-center justify-center">
            <Cpu size={16} />
          </div>
          <div>
            <h4 className="text-sm font-black text-[#3C3530]">
              About the AI Architecture & Model Transparency
            </h4>
            <p className="text-[11px] text-[#7F8C8D]">
              Full open-box algorithmic documentation for judges & auditors
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-[#7F8C8D] hover:bg-[#FDF9F5]"
        >
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {open && (
        <div className="space-y-4 text-xs text-[#3C3530]">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
              <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-1">
                Model Archetype
              </span>
              <p className="font-bold text-[#3C3530]">
                Rule-Based Weighted Heuristics + Multi-Step Trajectory Filter
              </p>
              <p className="text-[11px] text-[#7A726C] mt-1">
                Deterministic and auditable — avoids black-box hallucinations.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
              <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-1">
                Inputs Analyzed
              </span>
              <p className="font-bold text-[#3C3530]">
                Voluntary Self-Assessments
              </p>
              <p className="text-[11px] text-[#7A726C] mt-1">
                Stress (1-5), Sleep (1-5), Safety perception, Connection (1-5), Support ask.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
              <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-1">
                Outputs Produced
              </span>
              <p className="font-bold text-[#3C3530]">
                Distress Indicator + Trajectory + Priority Recommendation
              </p>
              <p className="text-[11px] text-[#7A726C] mt-1">
                Transparent factor attribution and confidence intervals.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#A55D25]/10 border border-[#A55D25]/30 space-y-2">
            <span className="text-[10px] font-black uppercase text-[#A55D25] tracking-wider block">
              Explicit Model Boundaries & Limitations
            </span>
            <ul className="grid sm:grid-cols-2 gap-2 text-[11px] text-[#3C3530]">
              <li className="flex items-start space-x-1.5">
                <span className="text-[#A55D25] font-bold">•</span>
                <span><strong>Not clinically validated:</strong> Designed as a demonstration prototype for hackathon evaluation.</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <span className="text-[#A55D25] font-bold">•</span>
                <span><strong>Synthetic training data:</strong> Evaluated entirely on anonymized synthetic vectors.</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <span className="text-[#A55D25] font-bold">•</span>
                <span><strong>No autonomous escalation:</strong> Cannot dispatch emergency teams or contact police.</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <span className="text-[#A55D25] font-bold">•</span>
                <span><strong>Consent-bound:</strong> Participants may withdraw consent or delete check-in histories anytime.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Responsible AI & Bias Monitoring Card
 */
export const BiasMonitoringCard: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D] flex items-center">
          <Globe2 size={15} className="mr-1.5 text-[#5A5049]" />
          Responsible AI & Demographic Bias Monitoring
        </h4>
        <span className="text-[10px] font-mono font-bold text-[#7A726C]">
          Prototype Audit
        </span>
      </div>

      <p className="text-xs text-[#7A726C] leading-relaxed">
        Humanitarian AI models must not exhibit performance disparities across language, age, gender, or cultural contexts. AURA tracks algorithmic parity across synthetic cohorts:
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-0.5">
            Language Equity
          </span>
          <span className="text-xs font-black text-[#3C3530]">
            EN / HI / MR
          </span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">
            Equal Heuristic Weighting
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-0.5">
            Age Cohorts
          </span>
          <span className="text-xs font-black text-[#3C3530]">
            18–25 to 65+
          </span>
          <span className="text-[10px] text-[#5A5049] font-bold block mt-1">
            Fair Sensitivity Curve
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-0.5">
            Cultural Context
          </span>
          <span className="text-xs font-black text-[#3C3530]">
            Localized Phrasing
          </span>
          <span className="text-[10px] text-[#5A5049] font-bold block mt-1">
            Non-Stigmatizing Tone
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2]">
          <span className="text-[10px] font-black uppercase text-[#7F8C8D] block mb-0.5">
            Human Oversight
          </span>
          <span className="text-xs font-black text-[#3C3530]">
            100% Cases
          </span>
          <span className="text-[10px] text-[#A55D25] font-bold block mt-1">
            Human Verification Gate
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Judge-Facing "Why AURA?" Comparison Panel
 */
export const WhyAuraPanel: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-[#3C3530] to-[#5A5049] rounded-3xl p-6 sm:p-8 text-white shadow-md space-y-6">
      <div className="border-b border-white/15 pb-4">
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#DBC3B2]/20 text-[#DBC3B2] border border-[#DBC3B2]/30">
          SIH Judge Presentation
        </span>
        <h3 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
          Why AURA?
        </h3>
        <p className="text-sm font-bold text-[#DBC3B2] mt-1">
          "From static screening to continuous, human-centered support."
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Traditional Approach */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-3">
          <div className="flex items-center space-x-2 text-[#A55D25]">
            <AlertTriangle size={18} />
            <h4 className="font-black text-base text-white">Traditional Screening Approach</h4>
          </div>
          <div className="p-3 rounded-xl bg-black/20 font-mono text-xs text-[#EFE8E2]/80 flex items-center justify-between">
            <span>Single questionnaire</span>
            <span>→</span>
            <span>Static score</span>
            <span>→</span>
            <span>Manual review</span>
          </div>
          <ul className="text-xs text-[#EFE8E2]/75 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-[#A55D25] font-bold">✕</span>
              <span><strong>Static Snapshot:</strong> Fails to detect worsening trends until a crisis occurs.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#A55D25] font-bold">✕</span>
              <span><strong>Black Box:</strong> Gives a cold number without explaining underlying drivers.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#A55D25] font-bold">✕</span>
              <span><strong>No Outcome Loop:</strong> Cannot verify if support actually helped the participant recover.</span>
            </li>
          </ul>
        </div>

        {/* AURA Paradigm */}
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-[#DBC3B2]/40 space-y-3">
          <div className="flex items-center space-x-2 text-[#DBC3B2]">
            <h4 className="font-black text-base text-white">AURA Dynamic Paradigm</h4>
          </div>
          <div className="p-3 rounded-xl bg-[#3C3530]/60 font-mono text-[11px] text-[#DBC3B2] flex flex-wrap items-center gap-1.5 leading-snug">
            <span>Voluntary Check-ins</span>
            <span>→</span>
            <span>Dynamic Trajectory</span>
            <span>→</span>
            <span>Explainable AI</span>
            <span>→</span>
            <span>Early Warning</span>
            <span>→</span>
            <span>Human Review</span>
            <span>→</span>
            <span>Support</span>
            <span>→</span>
            <span>Outcome</span>
          </div>
          <ul className="text-xs text-[#EFE8E2]/90 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-[#DBC3B2] font-bold">✓</span>
              <span><strong>Continuous Trajectory:</strong> Analyzes velocity and volatility across reflections.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#DBC3B2] font-bold">✓</span>
              <span><strong>Explainable Signals:</strong> Identifies why scores changed in plain, transparent language.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#DBC3B2] font-bold">✓</span>
              <span><strong>Outcome Measurement:</strong> Quantifies recovery post-intervention to optimize care.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Humanitarian Impact Dashboard Section
 */
export const HumanitarianImpactSection: React.FC = () => {
  const impacts = [
    { title: "Earlier Signals", desc: "Detect meaningful changes between check-ins before crises escalate.", icon: Zap },
    { title: "Better Prioritization", desc: "Help support teams focus limited human counselor resources where needed most.", icon: Award },
    { title: "Continuous Monitoring", desc: "Track longitudinal velocity and volatility over time rather than single points.", icon: Compass },
    { title: "Explainable Decisions", desc: "Show exactly which factors contributed to an alert with clear factor weighting.", icon: Info },
    { title: "Participant Control", desc: "Voluntary participation, consent preferences, and full data deletion rights.", icon: EyeOff },
    { title: "Human-Centered Response", desc: "AI assists and prioritizes — trained humans review and care.", icon: Users }
  ];

  return (
    <div className="bg-white rounded-3xl border border-[#EFE8E2] p-6 sm:p-7 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-[#EFE8E2] pb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DBC3B2]/20 text-[#5A5049]">
            Humanitarian Value
          </span>
          <h3 className="text-xl font-black text-[#3C3530] mt-1">
            Demonstrated Humanitarian Impact
          </h3>
        </div>
        <span className="text-xs text-[#7F8C8D]">
          6 Key Advantages
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {impacts.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2 hover:border-[#DBC3B2] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#5A5049] text-[#DBC3B2] flex items-center justify-center">
                <Icon size={16} />
              </div>
              <h4 className="text-sm font-black text-[#3C3530]">
                {item.title}
              </h4>
              <p className="text-xs text-[#7A726C] leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Composite Component for Governance & Architecture Pages
 */
export const ResponsibleAIBadges: React.FC = () => {
  return (
    <div className="space-y-6">
      <WhyAuraPanel />
      <ModelTransparencyCard />
      <BiasMonitoringCard />
      <HumanitarianImpactSection />
    </div>
  );
};
