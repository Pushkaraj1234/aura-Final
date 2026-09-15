/**
 * Short reading, written for the person rather than about them.
 *
 * The umbrella review this work was audited against (Yeasmin et al., Health
 * Science Reports 2025) reports that AI-delivered literacy modules raised both
 * mental health literacy and, more usefully, willingness to seek professional
 * help. AURA already had coping exercises and a first aid kit. Those are
 * things to do. Neither of them tells a person what distress is, what a
 * counsellor is actually for, or what the next two years of a court case are
 * likely to feel like, and not knowing those things is its own burden.
 *
 * THE RULES THIS CONTENT IS WRITTEN TO
 *
 * Distress is treated as a reasonable response to what happened, never as a
 * defect. For the people AURA is for, feeling badly is frequently the correct
 * reading of their situation, and copy that implies otherwise is both insulting
 * and wrong.
 *
 * Nothing here diagnoses, and nothing here is legal advice. The legal module
 * describes the shape of the process and the feelings that come with it. It
 * names no sections, no amounts and no deadlines, because those vary by state
 * and change, and a wellbeing app that gets a compensation figure wrong has
 * done real harm to someone who planned around it.
 *
 * Nothing promises an outcome. Reading is not treatment and does not move
 * anybody's score.
 *
 * The text is plain interface copy, so domTranslator carries it into Hindi and
 * Marathi with everything else. It is deliberately not marked
 * `data-no-translate`: that marking is for a person's own words, and this is
 * ours.
 */

export type LiteracyModuleId = "distress" | "counsellor" | "court" | "aura";

export interface LiteracySection {
  heading: string;
  body: string;
}

export interface LiteracyModule {
  id: LiteracyModuleId;
  title: string;
  /** One line, shown before it is opened. */
  summary: string;
  /** Roughly how long it takes to read. */
  minutes: number;
  sections: LiteracySection[];
  /** The one sentence worth remembering if nothing else is. */
  takeaway: string;
}

export const LITERACY_MODULES: LiteracyModule[] = [
  {
    id: "distress",
    title: "What distress is, and what it isn't",
    summary: "Why you feel like this, and why it isn't a fault in you.",
    minutes: 3,
    sections: [
      {
        heading: "It is a response, not a defect",
        body:
          "Sleeping badly, flinching at sounds, going over the same few minutes again and again, not wanting to see anyone: these are the ordinary ways a person responds to something that should not have happened to them. They are not signs of weakness and they are not signs that something is wrong with you. They are signs that something was done to you.",
      },
      {
        heading: "It doesn't move in a straight line",
        body:
          "Most people expect to get steadily better and are alarmed when they don't. Feeling fine for a fortnight and then badly again for a week is the usual shape of this, not a relapse. A bad week after a good month has not undone anything.",
      },
      {
        heading: "Some of it is the situation, not the memory",
        body:
          "If the people who harmed you still live nearby, if the case is going slowly, if money is short because of what happened, then feeling unsafe is accurate. That part doesn't get better by thinking differently about it. It gets better when the situation does, and until then, feeling the weight of it is not a symptom to be corrected.",
      },
      {
        heading: "When it is worth telling someone quickly",
        body:
          "If you are thinking about ending your life, if you can't keep yourself safe, or if someone is threatening you now, that is the point to reach a person rather than wait for your next check-in. The emergency button on every screen has numbers that answer at any hour, and they are free.",
      },
    ],
    takeaway: "Feeling badly after this is not a fault in you. It is a response to what was done.",
  },
  {
    id: "counsellor",
    title: "What a counsellor here can and can't do",
    summary: "What actually happens if you ask to talk to someone.",
    minutes: 3,
    sections: [
      {
        heading: "What they do",
        body:
          "They listen, without needing you to prove anything or tell it in order. They can help you work out what to do next, help you prepare for a hearing, and point you towards services you may not know exist. Much of the useful part is simply having one person who already knows your situation, so you don't start from the beginning every time.",
      },
      {
        heading: "What they can't do",
        body:
          "They aren't your lawyer and can't act on your case. They can't make the police move faster, get compensation released, or tell you how the trial will go. They don't prescribe anything. And they can't promise that talking will make you feel better, because sometimes it doesn't, or not for a while.",
      },
      {
        heading: "You are not being assessed",
        body:
          "Asking for a counsellor doesn't put anything on a record that follows you, and it isn't a judgement about how badly you are coping. People ask for all sorts of reasons, including just wanting one steady conversation a month. You can stop at any point, and you can ask for a different counsellor without explaining why.",
      },
      {
        heading: "What they see about you",
        body:
          "They see your check-in answers and the distress score those produce. They see a written reflection only if you chose to share it. They never see what you say to the voice companion or the assistant. You can change what is shared, at any time, on the privacy screen.",
      },
    ],
    takeaway: "Asking to talk to someone is not a judgement about how badly you're coping.",
  },
  {
    id: "court",
    title: "What the court process usually looks like",
    summary: "Why it takes so long, and what the long gaps mean.",
    minutes: 4,
    sections: [
      {
        heading: "This is not legal advice",
        body:
          "What follows is the general shape of how these cases go, so the waiting makes more sense. It is not advice about your case. For that, your lawyer or the public prosecutor handling it is the person to ask, and it is reasonable to ask them to explain anything in plain language.",
      },
      {
        heading: "The usual stages",
        body:
          "A complaint is recorded, the police investigate, and if they find enough they file a charge sheet with the court. The court frames charges, and then the trial proper begins: witnesses give evidence, are cross-examined, and eventually the court gives its judgement. Each stage can take months. Most of the waiting happens between stages, not during them.",
      },
      {
        heading: "Adjournments are normal and mean almost nothing",
        body:
          "Hearings get postponed constantly, often more than once, sometimes for reasons that have nothing to do with your case. This is the single thing survivors most often read as a bad sign. It usually isn't one. A postponed hearing is not the case failing, and it is not anyone deciding against you.",
      },
      {
        heading: "Hearing weeks are hard, and that is predictable",
        body:
          "Many people feel worse in the days before a hearing and for a few days afterwards, whether or not the hearing went well. Being in the same room as the people who harmed you, or describing what happened to a room of strangers, takes something out of a person. If you know a date is coming, that is a good time to tell your counsellor.",
      },
      {
        heading: "You can ask for things",
        body:
          "Depending on where you are, it may be possible to ask for support while giving evidence, for a screen so you don't have to see the accused, or for travel costs. These vary and nobody may have mentioned them. Asking your lawyer what is available in your court costs nothing.",
      },
    ],
    takeaway: "A postponed hearing is not your case failing. It is how these courts run.",
  },
  {
    id: "aura",
    title: "What AURA does with what you tell it",
    summary: "What the score means, who sees what, and what we can't do.",
    minutes: 3,
    sections: [
      {
        heading: "The score is not a diagnosis",
        body:
          "Your check-in answers produce a number out of 100. It isn't a measure of how ill anyone is, because it can't be: it comes from five questions you answered about the last few days. It is there so a counsellor can notice when your answers start drifting, and so you can see the same thing we can. You can open any score and see exactly which answers produced it.",
      },
      {
        heading: "A person decides, every time",
        body:
          "Nothing here contacts anyone automatically, escalates anything on its own, or makes a decision about your care. When the system notices something, it raises it to a human, who reads it and decides. That is deliberate: being contacted at the wrong moment can itself be the harm.",
      },
      {
        heading: "What we are still unsure about",
        body:
          "The scoring formula was chosen by the people who built this, not derived from studying outcomes. That is why we ask you five questions from the World Health Organization now and then: to check our number against one that has been properly tested. If ours turns out not to track anything real, we would rather find out.",
      },
      {
        heading: "What you control",
        body:
          "You choose whether a written reflection is shared with your counsellor, whether you can speak instead of typing, whether how you said it is measured, and whether any recording is kept. Those are four separate choices and you can change them whenever you want. You can also download everything we hold about you, or withdraw entirely.",
      },
    ],
    takeaway: "The score is a prompt for a human to look, not a verdict about you.",
  },
];

export function literacyModule(id: LiteracyModuleId): LiteracyModule | undefined {
  return LITERACY_MODULES.find((m) => m.id === id);
}

/** Total reading time, for the one line on the card that opens this. */
export function totalReadingMinutes(): number {
  return LITERACY_MODULES.reduce((sum, m) => sum + m.minutes, 0);
}
