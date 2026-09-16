import type { LiteracyModuleId } from "./literacyModules";

/**
 * The gentle check-in on the signed-in "What to expect" page.
 *
 * WHAT THIS IS FOR
 *
 * "What to expect" explains. The Recovery Hub organises. This is the hinge
 * between them: a person says roughly where they are, the reading reorders
 * itself around that, and the door to the Hub is offered rather than pushed.
 *
 * WHY IT ASKS WHAT IT ASKS
 *
 * Every option is written as a description of a state, not of an event. There
 * is no "what happened to you", no "what crime", no "are you a victim". A
 * person should be able to get help without first producing an account of the
 * worst thing that has happened to them, and the option list is where that
 * promise is either kept or broken.
 *
 * "I'd rather not say" is always present and always leads somewhere real. An
 * opt-out that dead-ends is not an opt-out.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not classify anybody. The selection is held in component state for
 * the length of a visit, is never written anywhere, and never reaches a
 * counsellor, a score, or the Recovery Hub. It reorders reading. That is all,
 * and the privacy copy on the page says exactly that.
 *
 * WHY THE READING IS REORDERED RATHER THAN REPLACED
 *
 * There are four pieces and they are the four that exist. Rather than invent
 * new articles per need, each need names which of the four to lead with and
 * which part of the Hub is worth knowing about. Made-up reading would have to
 * clear the same copy rules as the real thing and would be thinner for it.
 */

export type NeedId =
  | "feeling"
  | "something_happened"
  | "options"
  | "already_reported"
  | "money"
  | "unsure"
  | "rather_not_say";

export interface NeedOption {
  id: NeedId;
  /** Shown on the row. A state, never an event. */
  label: string;
  /** One line under it, where the choice needs softening. */
  detail?: string;
  /** Said back to the person once they have chosen. */
  acknowledgement: string;
  /** Which of the four pieces to lead with, in order. Empty means all four. */
  modules: LiteracyModuleId[];
  /** What is in the Recovery Hub for somebody in this position. */
  hubHighlights: string[];
  /** One action, phrased as an offer. Never an instruction, never an outcome. */
  nextStep: string;
}

/**
 * Sub-choices for "I'm not sure what I need".
 *
 * Resolving to the same NeedIds rather than to a parallel vocabulary, so the
 * guided path lands somewhere already built rather than in a branch of its own
 * that would drift.
 */
export interface GuidedChoice {
  label: string;
  resolvesTo: NeedId;
}

export const GUIDED_CHOICES: GuidedChoice[] = [
  { label: "Someone to talk to", resolvesTo: "feeling" },
  { label: "Practical help", resolvesTo: "something_happened" },
  { label: "Legal information", resolvesTo: "options" },
  { label: "Financial support", resolvesTo: "money" },
  { label: "Case guidance", resolvesTo: "already_reported" },
  { label: "Just reading for now", resolvesTo: "rather_not_say" },
];

export const NEED_OPTIONS: NeedOption[] = [
  {
    id: "feeling",
    label: "I'm trying to make sense of what I'm feeling",
    acknowledgement:
      "Start here. These are about what you might be feeling and what talking to someone actually involves.",
    modules: ["distress", "counsellor", "aura"],
    hubHighlights: [],
    nextStep:
      "There is a counsellor you can message, and numbers that answer at any hour, at the bottom of this page.",
  },
  {
    id: "something_happened",
    label: "Something happened, and I don't know what to do next",
    detail: "You don't have to tell us what.",
    acknowledgement:
      "You don't have to figure everything out today. These cover what the people here can do, and how the process usually goes.",
    modules: ["counsellor", "court", "distress", "aura"],
    hubHighlights: [
      "A private file to keep what you know so far, however little",
      "What reporting to the police usually involves, and the official route to it",
      "Somewhere to put documents as you get them",
    ],
    nextStep:
      "If you want somewhere to keep track of this, the Recovery Hub is that. Nothing has to be filled in today.",
  },
  {
    id: "options",
    label: "I want to understand my options",
    acknowledgement:
      "These explain what a counsellor here can and cannot do, and how the court process usually goes.",
    modules: ["counsellor", "court", "aura", "distress"],
    hubHighlights: [
      "Free legal aid through the legal services authorities, and how to apply",
      "Victim compensation routes that may be relevant",
      "The official sites for each, with the publisher named",
    ],
    nextStep:
      "The Recovery Hub has the official legal aid and compensation routes, with links to the bodies that run them.",
  },
  {
    id: "already_reported",
    label: "I've already reported something",
    acknowledgement:
      "These cover how the court process usually goes, and what happens to what you tell us.",
    modules: ["court", "counsellor", "aura", "distress"],
    hubHighlights: [
      "Your FIR number, police station and district, kept where you can find them",
      "A timeline of what has happened, in order",
      "A document checklist built around your situation",
      "Legal aid and compensation applications, and where they have got to",
    ],
    nextStep:
      "If you have an FIR, the Recovery Hub is where it lives alongside your documents and your timeline.",
  },
  {
    id: "money",
    label: "I'm worried about money or practical support",
    acknowledgement:
      "There is no reading here about money, so this is the honest answer: the practical routes are in the Recovery Hub, and these pieces cover the rest.",
    modules: ["counsellor", "court", "aura"],
    hubHighlights: [
      "Victim compensation, and what may be relevant to your situation",
      "Maharashtra's assistance for SC/ST victims of atrocities, where it applies",
      "The documents an application usually asks for",
      "Free legal aid, which costs nothing to apply for",
    ],
    nextStep:
      "The Recovery Hub lists the financial routes that may be relevant. Whether you qualify is decided by the authority, not by us.",
  },
  {
    id: "unsure",
    label: "I'm not sure what I need",
    detail: "That's okay. You don't need to have the right words.",
    acknowledgement:
      "That's okay. You don't need to have the right words. We'll take this one step at a time.",
    modules: [],
    hubHighlights: [],
    nextStep: "",
  },
  {
    id: "rather_not_say",
    label: "I'd rather not say",
    acknowledgement:
      "That's completely okay. You don't need to share anything you're not ready to share. Everything below is here either way.",
    modules: [],
    hubHighlights: [
      "A private file, if you ever want one",
      "The official emergency, police, legal aid and compensation routes",
      "What you are owed in principle, as set out internationally",
    ],
    nextStep:
      "Nothing here needs an answer from you. Read whatever is useful, and the counsellor and emergency numbers are at the bottom.",
  },
];

const BY_ID = new Map(NEED_OPTIONS.map((n) => [n.id, n]));

export const needOption = (id: NeedId): NeedOption | undefined => BY_ID.get(id);

/**
 * Which pieces to show, in which order.
 *
 * An empty `modules` list means all four in their usual order: for somebody who
 * has not said where they are, or has said they would rather not, hiding
 * anything would be the wrong way round.
 */
export function readingFor(id: NeedId | null): LiteracyModuleId[] | undefined {
  if (!id) return undefined;
  const modules = BY_ID.get(id)?.modules ?? [];
  return modules.length > 0 ? modules : undefined;
}
