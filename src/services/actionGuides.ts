import { Recommendation } from "../types";

/**
 * What a person can actually do after a check-in.
 *
 * The recommendation cards named an action ("Contact Caseworker", "Discuss
 * Safety Plan") and then did nothing when tapped, which is worse than not
 * offering it — someone who has just been told their distress is elevated
 * reaches for the one thing on screen that looks like help and finds a dead
 * label. Each action now opens the steps below.
 *
 * Written to a few rules:
 *
 *   - Practical and small. Steps someone can do tonight in a shared room with
 *     no money and no privacy, not a programme requiring a quiet house.
 *   - Never promises a lower score. The score follows how someone is, not the
 *     other way round; telling a distressed person that breathing exercises
 *     will bring their number down sets them up to feel they failed at it.
 *   - Not treatment, and says so. These are self-care and coping supports
 *     alongside human help, never instead of it.
 *   - Anything touching safety routes to a person, not to a worksheet.
 */

export interface ActionGuide {
  title: string;
  /** One line on what this is for. */
  intent: string;
  /** Concrete things to do, in the order worth trying them. */
  steps: string[];
  /** Where this leads in the app, if anywhere. */
  navigateTo?: string;
  navigateLabel?: string;
  /** Routes to the crisis flow instead of showing steps to work through. */
  isEmergency?: boolean;
  /** Shown in smaller text under the steps. */
  footnote?: string;
}

const GUIDES: Record<string, ActionGuide> = {
  emergency: {
    title: "Getting help right now",
    intent:
      "You told us you may be in danger. That is not something to work through on your own, and nothing on this page is a substitute for a person.",
    steps: [
      "If you are in immediate physical danger, contact local emergency services first.",
      "Open the emergency panel below for crisis lines available in your region.",
      "If you can, tell one person you trust where you are — a neighbour, a friend, anyone.",
      "Your assigned counsellor is being notified. You do not have to explain everything again when they reach you.",
    ],
    isEmergency: true,
    footnote: "This is the one recommendation that should not wait.",
  },

  support_contact: {
    title: "Reaching your caseworker",
    intent:
      "You asked to speak with someone. Here is what happens next and how to make that conversation easier.",
    steps: [
      "Your request is already on your counsellor's queue — you do not need to chase it.",
      "Send a message now if there is something you would rather they read before you speak.",
      "Write down one or two things you want to raise. Under pressure it is easy to say 'I'm fine' and leave.",
      "You can ask for a different counsellor, an interpreter, or a woman or man specifically. That request is normal and will not be held against you.",
      "Nothing you say obliges you to accept any particular support. You can decline anything offered.",
    ],
    navigateTo: "messages",
    navigateLabel: "Open messages",
  },

  support_options: {
    title: "What support is available",
    intent:
      "Support is not one thing. Knowing the options makes it easier to ask for the one you actually want.",
    steps: [
      "One-to-one conversation with a trained counsellor, in your own language where possible.",
      "Peer groups with others who have been through similar events — often easier than talking to a professional.",
      "Practical help: documentation, legal referral, housing, medical care. Distress is frequently about circumstances, not only feelings.",
      "Someone to sit with you while you make a difficult call or attend an appointment.",
      "You can take any of these and leave the rest.",
    ],
    navigateTo: "support_resources",
    navigateLabel: "Browse support resources",
  },

  calm: {
    title: "Settling a stressed body",
    intent:
      "When stress is high the body reacts before thinking does. These are ways to bring the physical response down — they do not fix what caused it.",
    steps: [
      "Breathe out for longer than you breathe in. Four counts in, six or eight out, for about a minute. The long out-breath is what slows the heart.",
      "Name five things you can see, four you can hear, three you can touch. This pulls attention back to the room you are in.",
      "Push your feet into the floor, or press your palms together hard for ten seconds and release. Muscle effort discharges some of the tension.",
      "Cold water on your wrists or face.",
      "If a memory has taken over, say the date and where you are out loud. It is a way of telling your body the danger is not happening now.",
    ],
    footnote:
      "If these make you feel worse rather than better, stop — for some people, turning attention inward is not the right tool. Tell your counsellor.",
  },

  creative: {
    title: "Using creative outlets",
    intent:
      "Writing, drawing, music and craft give difficult experience somewhere to go when talking about it directly is too much — or not possible yet.",
    steps: [
      "Nobody has to see it. Work made only for yourself counts, and can be destroyed afterwards.",
      "It does not have to be about what happened. Making something ordinary is still the point.",
      "Ten minutes is enough. This works better little and often than in long sittings.",
      "If it starts to pull you somewhere distressing, stop and do something physical — walk, wash up, step outside.",
      "Group art, music and craft sessions exist through support services, and are often easier than talking groups.",
    ],
    navigateTo: "support_resources",
    navigateLabel: "Find group activities",
    footnote:
      "If making something reliably brings the worst of it back rather than easing it, that is worth telling your counsellor — it is common and there are ways around it.",
  },

  sleep: {
    title: "When sleep is broken",
    intent:
      "Disturbed sleep after violence or displacement is expected, and it is one of the things that makes everything else harder to carry.",
    steps: [
      "Get up at roughly the same time each day, even after a bad night. The waking time steadies sleep more reliably than the bedtime does.",
      "If you are awake more than about twenty minutes, get up and do something quiet in dim light rather than lying there. Bed should not become the place you lie awake.",
      "Keep the last hour before sleep off screens and away from news.",
      "If nightmares are waking you, that is worth telling your counsellor — there are specific approaches for them, and they are not something to simply endure.",
      "Daylight in the morning, even fifteen minutes, helps set the next night.",
    ],
    footnote:
      "Sleep is often the first thing to improve with support, and the first to slip when things get harder — it is worth mentioning either way.",
  },

  social: {
    title: "When you feel cut off",
    intent:
      "Isolation makes distress heavier, and withdrawing is one of the most common responses to it. The way back is smaller than people expect.",
    steps: [
      "Aim for one contact, not a social life. A message, a short call, sitting near someone without talking.",
      "Shared activity is easier than conversation — cooking, walking, queueing together. There is no requirement to discuss what happened.",
      "You do not owe anyone your story. You can spend time with people and say nothing about it.",
      "Peer groups exist for exactly this, and many people find them easier than one-to-one support.",
      "If everyone you were close to is gone or far away, say so — rebuilding that is something your counsellor can help with practically.",
    ],
    navigateTo: "support_resources",
    navigateLabel: "See community options",
  },

  routine: {
    title: "Rebuilding a routine",
    intent:
      "After upheaval, ordinary structure disappears. Restoring a little of it gives the day edges again.",
    steps: [
      "Pick one fixed point — the same waking time, one meal at the same hour. One is enough to start.",
      "Eat something at regular times even when appetite is gone. Not eating makes mood and concentration worse quickly.",
      "Get outside once a day if it is safe to do so, however briefly.",
      "Choose one small task you can finish. Completing something is worth more here than how useful it was.",
      "Expect it to be uneven. A day that does not work is not the routine failing.",
    ],
  },

  reminder: {
    title: "Keeping track of how you are",
    intent:
      "One check-in is a snapshot. What actually helps you and your counsellor is the direction over time.",
    steps: [
      "Check in regularly rather than only on bad days — otherwise the record only ever shows the worst of it.",
      "Answer honestly even when the honest answer is 'worse'. Nothing here is a test, and a worse answer is not a failure.",
      "Use the written or spoken reflection when you have something that does not fit the questions.",
      "Look at your own trend before an appointment. It is often easier to point at a pattern than to describe one.",
    ],
    navigateTo: "participant_home",
    navigateLabel: "See your wellbeing over time",
  },

  safety: {
    title: "Thinking through a safety plan",
    intent:
      "A safety plan is a few decisions made in advance, so they do not have to be made in the moment.",
    steps: [
      "Where would you go if you had to leave quickly, and how would you get there?",
      "Who is the one person you would contact, and do you have their number somewhere other than your phone?",
      "What would you need to take — documents, medication, money — and can any of it be kept ready?",
      "Are there times or places where you feel less safe, and can any of them be avoided or changed?",
      "Work through this with your counsellor rather than alone. A plan someone else knows about is a stronger plan.",
    ],
    navigateTo: "messages",
    navigateLabel: "Message your counsellor",
    footnote:
      "If you are in danger now rather than planning for later, use the emergency help button instead.",
  },
};

/** Category fallback, for recommendations that arrive without a known action type. */
const CATEGORY_FALLBACK: Record<string, string> = {
  SAFETY: "safety",
  PROFESSIONAL_SUPPORT: "support_contact",
  EMOTIONAL_SUPPORT: "support_options",
  STRESS: "calm",
  SLEEP: "sleep",
  SOCIAL: "social",
  ROUTINE: "routine",
  FOLLOW_UP: "reminder",
};

/**
 * Keyword routing for recommendations produced by the language model. Its
 * schema declares `category` and `actionType` as free-form strings with no
 * enumeration, so it emits things like "SUPPORT & CASEWORK", "SAFETY
 * PLANNING" and "COPING STRATEGIES" that no exact-match table will ever
 * contain. Matching on the words means those cards open the guide they
 * actually describe instead of a generic one.
 *
 * Order is deliberate. Crisis wording is tested first and kept narrow, so
 * that "review your safety plan" — which is planning, done calmly, in advance
 * — does not open the emergency flow, while "in immediate danger" does.
 */
const KEYWORD_ROUTES: [RegExp, string][] = [
  [/emergency|crisis|immediate danger|right now|hurt(ing)? (your|them)self|suicid/i, "emergency"],
  [/safety plan|safe ?plan|plan for (your )?safety|secure (a )?place/i, "safety"],
  [/caseworker|case worker|counsell?or|therapist|professional|clinician|appointment/i, "support_contact"],
  [/peer|isolat|lonely|alone|connect|social|community|friend|family/i, "social"],
  [/sleep|rest|insomnia|nightmare|night/i, "sleep"],
  [/creative|art|music|draw|paint|writ|journal|craft|express/i, "creative"],
  [/breath|calm|ground|relax|mindful|cope|coping|stress|overwhelm|anxious/i, "calm"],
  [/routine|structure|daily|habit|schedule|meal|exercise|walk/i, "routine"],
  [/follow.?up|track|monitor|check.?in|reminder|next check/i, "reminder"],
  [/support|resource|help|service|referral/i, "support_options"],
];

/**
 * The guide behind a recommendation's action. Resolves from the most specific
 * signal to the least: a known action type, then a known category, then the
 * words of the recommendation itself. A button that opens nothing is the bug
 * being fixed here, so this never returns undefined.
 */
export function getActionGuide(rec: Recommendation): ActionGuide {
  const haystack = [rec.category, rec.actionType, rec.title, rec.actionLabel, rec.description]
    .filter(Boolean)
    .join(" ");

  // Crisis wording is checked before anything else, including the category
  // table. Category "SAFETY" defaults to the planning guide — right for
  // "review your safety plan", badly wrong for a card about immediate danger,
  // which would otherwise have been handed a worksheet. Whichever route would
  // have won, danger outranks it.
  if (KEYWORD_ROUTES[0][0].test(haystack)) return GUIDES.emergency;

  const byType = rec.actionType ? GUIDES[rec.actionType] : undefined;
  if (byType) return byType;

  const fallbackKey = CATEGORY_FALLBACK[rec.category];
  if (fallbackKey && GUIDES[fallbackKey]) return GUIDES[fallbackKey];

  for (const [pattern, key] of KEYWORD_ROUTES) {
    if (pattern.test(haystack) && GUIDES[key]) return GUIDES[key];
  }

  // Last resort: the recommendation's own text, plus the routes that always
  // apply. Never returns undefined.
  return {
    title: rec.title,
    intent: rec.description,
    steps: [
      "Talk this through with your counsellor — they can turn it into something specific to your situation.",
      "Take one small piece of it rather than all of it.",
    ],
    navigateTo: "support_resources",
    navigateLabel: "Browse support resources",
  };
}
