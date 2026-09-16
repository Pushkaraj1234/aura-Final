import React, { useState } from "react";
import { ArrowLeft, BookOpen, FolderOpen, LifeBuoy, Phone, ShieldAlert } from "lucide-react";
import {
  ChoiceList,
  OfficialLink,
  OfficialSiteNotice,
} from "../../components/Recovery/RecoveryPrimitives";
import { officialResource, OFFICIAL_RESOURCES } from "../../services/officialResources";

/**
 * The way in, and the safety gate in front of everything else.
 *
 * WHY SAFETY IS ASKED BEFORE ANYTHING IS COLLECTED
 *
 * The rest of this feature asks a person to write down where they live, which
 * police station holds their FIR and what was done to them. Asking any of that
 * of someone whose attacker is outside the door is worse than useless: it
 * spends the minutes that matter on a form. So the question comes first, and
 * answering "no" stops the workflow rather than routing around it.
 *
 * WHY "I'M NOT SURE" IS NOT TREATED AS "YES"
 *
 * Someone who cannot say they are safe usually has a reason. That answer gets
 * the emergency numbers too, alongside the choice to carry on, rather than
 * being quietly rounded down to the convenient answer.
 */

type Safety = "safe" | "unsure" | "danger";

interface Props {
  hasExistingCase: boolean;
  onStartReport: () => void;
  onOpenExisting: () => void;
  onOpenEmergency: () => void;
  onBack: () => void;
  language: string;
}

export const RecoveryEntry: React.FC<Props> = ({
  hasExistingCase,
  onStartReport,
  onOpenExisting,
  onOpenEmergency,
  onBack,
  language,
}) => {
  const [stage, setStage] = useState<"intro" | "safety" | "danger" | "rights">("intro");
  const [safety, setSafety] = useState<Safety[]>([]);

  const erss = officialResource("erss_112")!;

  // -------------------------------------------------------------------------
  // Emergency
  // -------------------------------------------------------------------------
  if (stage === "danger") {
    return (
      <div className="space-y-7">
        <section className="rounded-2xl border border-[#E4C3B4] bg-[#FBEFE9] p-6 sm:p-8">
          <h2 className="font-serif text-[1.5rem] leading-[1.25] text-[#8A3F20]">
            Your immediate safety comes first.
          </h2>
          <p className="mt-3 max-w-[54ch] text-[1rem] leading-[1.7] text-[#6B4636]">
            Nothing here matters more than that. The rest of this can wait, and
            it will still be here when you come back.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="tel:112" className="btn-primary px-6 py-4 text-[1.0625rem]">
              <Phone size={18} aria-hidden="true" />
              Call 112 now
            </a>
            <button onClick={onOpenEmergency} className="btn-ghost px-6 py-4 text-[1rem]">
              <LifeBuoy size={18} aria-hidden="true" />
              Other numbers that answer now
            </button>
          </div>

          <p className="mt-4 text-[0.875rem] leading-[1.6] text-[#6B4636]">
            112 is India&rsquo;s single emergency number and reaches police, fire
            and medical services.
          </p>
        </section>

        <OfficialLink resource={erss} language={language} />
        <OfficialSiteNotice />

        <button onClick={() => setStage("intro")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to the Recovery Hub
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Rights / resources, no case required
  // -------------------------------------------------------------------------
  if (stage === "rights") {
    const groups: { heading: string; keys: string[] }[] = [
      { heading: "In an emergency", keys: ["erss_112"] },
      {
        heading: "Reporting to the police",
        keys: ["mh_police_citizen_portal", "mh_published_firs"],
      },
      {
        heading: "Getting a lawyer at no cost",
        keys: ["nalsa_legal_aid", "nalsa_legal_aid_apply", "nalsa_track_application"],
      },
      {
        heading: "Compensation and financial assistance",
        keys: [
          "nalsa_victim_compensation",
          "nalsa_victim_compensation_apply",
          "csacv",
          "mh_scst_atrocity_assistance",
          "mh_sjsa_atrocity_assistance",
        ],
      },
      {
        heading: "What you are owed, in principle",
        keys: ["un_reparation_principles", "un_res_60_147"],
      },
    ];

    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            Your rights
          </span>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
            What exists, and who runs it
          </h2>
          <p className="max-w-[58ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
            You don&rsquo;t need an account or a case to read any of this. Every
            link goes to the body that actually runs the service, never to a
            copy of it.
          </p>
        </header>

        <OfficialSiteNotice />

        {groups.map((g) => {
          const items = g.keys
            .map((k) => OFFICIAL_RESOURCES.find((r) => r.key === k))
            .filter((r): r is NonNullable<typeof r> => Boolean(r));
          if (items.length === 0) return null;
          return (
            <section key={g.heading} className="space-y-3">
              <h3 className="font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
                {g.heading}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((r) => (
                  <OfficialLink key={r.key} resource={r} language={language} />
                ))}
              </div>
            </section>
          );
        })}

        <button onClick={() => setStage("intro")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to the Recovery Hub
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Safety check
  // -------------------------------------------------------------------------
  if (stage === "safety") {
    const answer = safety[0];
    return (
      <div className="space-y-7">
        <header className="space-y-3">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            Before anything else
          </span>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
            Are you currently safe?
          </h2>
          <p className="max-w-[54ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
            We ask before anything else, because nothing on the next screens is
            worth your time if you&rsquo;re in danger right now.
          </p>
        </header>

        <ChoiceList<Safety>
          legend="Are you currently safe?"
          choices={[
            { value: "safe", label: "Yes, I'm safe" },
            {
              value: "unsure",
              label: "I'm not sure",
              detail: "We'll show you the emergency numbers as well, just in case.",
            },
            { value: "danger", label: "No, I'm in danger" },
          ]}
          selected={safety}
          onChange={(v) => {
            setSafety(v);
            if (v[0] === "danger") setStage("danger");
          }}
        />

        {answer === "unsure" && (
          <div className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] p-5">
            <p className="text-[0.9375rem] leading-[1.7] text-[#6B5B4C]">
              If that changes, or if you want someone now, 112 reaches police,
              fire and medical services anywhere in India.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a href="tel:112" className="btn-soft px-5 py-3 text-[0.9375rem]">
                <Phone size={16} aria-hidden="true" />
                Call 112
              </a>
              <button onClick={onOpenEmergency} className="btn-ghost px-5 py-3 text-[0.9375rem]">
                Other numbers
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={() => setStage("intro")} className="btn-ghost px-5 py-3 text-[0.9375rem]">
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
          <button
            onClick={onStartReport}
            disabled={answer !== "safe" && answer !== "unsure"}
            className="btn-primary px-6 py-3.5 text-[0.9375rem] disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Entry
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-9">
      <header className="space-y-4">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Recovery Hub
        </span>
        <h1 className="text-[2rem] sm:text-[2.5rem] leading-[1.12] text-[#3A2A1E]">
          Victim Recovery Hub
        </h1>
        <p className="max-w-[60ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
          You don&rsquo;t have to figure everything out alone. Get guidance for
          reporting an incident, understanding your FIR, finding legal
          assistance, organizing documents, and exploring financial support.
        </p>
        <p className="max-w-[60ch] font-serif italic text-[1.0625rem] leading-[1.7] text-[#7A6A5A]">
          Let&rsquo;s take this one step at a time.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Emergency sits first and is visually distinct, because the person who
            needs it should not have to read past two other options to find it. */}
        <button
          onClick={() => setStage("danger")}
          className="rounded-2xl border border-[#E4C3B4] bg-[#FBEFE9] p-5 text-left transition-colors hover:bg-[#F8E5DC]"
        >
          <ShieldAlert size={22} aria-hidden="true" className="text-[#8A3F20]" />
          <span className="mt-3 block font-serif text-[1.1875rem] leading-[1.3] text-[#8A3F20]">
            I need immediate help
          </span>
          <span className="mt-2 block text-[0.9375rem] leading-[1.6] text-[#6B4636]">
            If you&rsquo;re in danger right now.
          </span>
        </button>

        <button
          onClick={() => setStage("safety")}
          className="card-elev rounded-2xl p-5 text-left transition-colors hover:bg-[#FBF5EC]"
        >
          <BookOpen size={22} aria-hidden="true" className="text-[#A85D2E]" />
          <span className="mt-3 block font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
            Report an incident
          </span>
          <span className="mt-2 block text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
            Guidance after something has happened, at your own pace.
          </span>
        </button>

        <button
          onClick={hasExistingCase ? onOpenExisting : () => setStage("safety")}
          className="card-elev rounded-2xl p-5 text-left transition-colors hover:bg-[#FBF5EC]"
        >
          <FolderOpen size={22} aria-hidden="true" className="text-[#A85D2E]" />
          <span className="mt-3 block font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
            Track my existing case
          </span>
          <span className="mt-2 block text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
            If you already have an FIR, a complaint, or an application in
            progress.
          </span>
        </button>
      </div>

      <div className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-[54ch]">
            <h2 className="font-serif text-[1.1875rem] leading-[1.3] text-[#3A2A1E]">
              I just want to understand my rights
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
              Read what exists and who runs it. No account, no case, nothing
              recorded.
            </p>
          </div>
          <button
            onClick={() => setStage("rights")}
            className="btn-ghost shrink-0 self-start px-5 py-3 text-[0.9375rem] sm:self-auto"
          >
            Read about your rights
          </button>
        </div>
      </div>

      {/* What this is, and what it is not. Said on the way in rather than
          buried in a footer, because someone deciding whether to type an FIR
          number into a website deserves to know first. */}
      <div className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] p-5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
        <p className="font-semibold text-[#3A2A1E]">What this is</p>
        <p className="mt-2 max-w-[66ch]">
          A place to keep your own record of what happened, what you have, and
          what you have applied for, with links to the official services that
          handle each step. AURA is not the police, a court, a lawyer, or a
          compensation authority, and it cannot register an FIR or decide an
          application. Those decisions stay with the authorities, and we link
          you to them.
        </p>
      </div>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>
    </div>
  );
};
