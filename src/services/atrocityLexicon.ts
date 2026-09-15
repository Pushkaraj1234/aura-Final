/**
 * Recognising the exposure that defines this population.
 *
 * WHY THIS EXISTS
 *
 * The systematic review of AI mental-health monitoring for atrocity victims
 * (September 2026) records gap G2 as follows: low-resource Indian-language
 * mental-health NLP exists for Hindi, Bengali, Tamil, Telugu, Kannada,
 * Malayalam and Marathi, but only at the level of generic depression and
 * coping classification. "There is no caste-discrimination lexicon, no
 * atrocity-event detection schema (e.g., public humiliation, forced labour,
 * denial of temple entry, social boycott, violence over inter-caste marriage),
 * and no suicide-ideation corpus from Dalit communities." Its stated
 * consequence is the sharpest sentence in the review: "the system cannot
 * detect the exposure that defines the target population."
 *
 * That was exactly true of AURA. The crisis detector recognises self-harm and
 * physical danger, and a survivor writing "they stopped us drawing water from
 * the well" or "the whole village stopped speaking to us" registered as
 * nothing at all. Those are not ambiguous statements. They name offences
 * enumerated under the Scheduled Castes and Scheduled Tribes (Prevention of
 * Atrocities) Act, and they are the reason the person is here.
 *
 * THE RULE THAT MAKES THIS SAFE
 *
 * Nothing here may move the distress score. The review's own taxonomy (section
 * 4.2) separates exposure from symptom state precisely because they are
 * different quantities: exposure is what was done to someone, symptom state is
 * how they are. Folding exposure into a distress number would mean a survivor
 * who describes a boycott calmly scores as more distressed than one who does
 * not mention it, which is not a measurement of anything.
 *
 * So this produces context for a human. It tells a counsellor what a person
 * has described, in the person's own categories, so the counsellor reads the
 * check-in knowing what it is about. It is inspectable, deterministic, and
 * carries the phrase that matched so it can be argued with.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not infer caste. It never records or guesses what community someone
 * belongs to, only what they say happened. Caste is the single most sensitive
 * attribute this database could hold, inferring it from free text would be
 * both unreliable and dangerous, and a survivor describing an atrocity is
 * telling us about an event, not filling in a category about themselves.
 */

export type AtrocityCategory =
  | "social_boycott"
  | "denial_of_access"
  | "public_humiliation"
  | "caste_slur"
  | "forced_labour"
  | "inter_caste_relationship"
  | "land_or_property"
  | "displacement"
  | "witch_hunting"
  | "sexual_violence"
  | "obstruction_of_justice";

export interface AtrocitySignal {
  category: AtrocityCategory;
  /** What a counsellor reads. Plain, and phrased as a description not a finding. */
  label: string;
  /** The exact text that matched, so the reading can be checked and disputed. */
  matched: string;
}

export interface AtrocityExposure {
  signals: AtrocitySignal[];
  /**
   * Always false. Present so that any caller wiring this into scoring has to
   * notice it is refusing, rather than discovering the rule in a comment.
   */
  readonly affectsScore: false;
}

interface CategoryDefinition {
  category: AtrocityCategory;
  label: string;
  /** Latin-script patterns. \b works here. */
  patterns: RegExp[];
  /**
   * Devanagari substrings. \b is defined against [A-Za-z0-9_], so every
   * Devanagari character reads as a non-word character and a word boundary
   * lands in the wrong place. Substring matching instead.
   */
  devanagari: string[];
}

const DEFINITIONS: CategoryDefinition[] = [
  {
    category: "social_boycott",
    label: "Describes a social boycott or being cut off by the community",
    patterns: [
      /\b(social\s+)?boycott(ed|ing)?\b/i,
      /\b(no\s?one|nobody|the\s+whole\s+village|everyone)\s+(will\s+)?(talks?|speaks?|spoke|speaking)\s+(to|with)\s+(me|us|my\s+family)\b/i,
      /\bstopped\s+(talking|speaking)\s+to\s+(me|us)\b/i,
      /\b(cut|shut)\s+(us|me)\s+off\b/i,
      /\bnot\s+allowed\s+in\s+the\s+village\b/i,
      /\bostracis|ostraciz/i,
    ],
    devanagari: ["बहिष्कार", "वाळीत", "गावाने बहिष्कार", "बोलणं बंद", "बात करना बंद"],
  },
  {
    category: "denial_of_access",
    label: "Describes being denied access to water, a temple, a shop or a public place",
    patterns: [
      /\b(not\s+allowed|denied|stopped|prevented|refused)\s+(us\s+|me\s+|from\s+)?(to\s+)?(enter|entering|entry|go\s+(in|inside))\b/i,
      /\b(denied|refused|not\s+allowed)\s+.{0,20}\b(water|well|handpump|tap|temple|shop|school|road|burial|cremation)\b/i,
      /\b(stopped|barred|blocked)\s+(us|me)\s+from\s+(drawing|taking|fetching|collecting)\s+water\b/i,
      /\bseparate\s+(glass|cup|utensils|tumbler|plate)\b/i,
      /\bmade\s+(us|me)\s+(sit|stand|eat)\s+(outside|separately|apart|on\s+the\s+floor)\b/i,
      /\buntouchab/i,
      /\btwo[-\s]tumbler\b/i,
    ],
    devanagari: [
      "मंदिरात जाऊ दिलं नाही", "मंदिर में नहीं", "पाणी भरू दिलं नाही",
      "पानी नहीं भरने", "अस्पृश्यता", "छुआछूत", "वेगळं भांडं", "अलग बर्तन",
    ],
  },
  {
    category: "public_humiliation",
    label: "Describes being publicly humiliated or paraded",
    patterns: [
      /\b(paraded|stripped|garlanded\s+with\s+(shoes|slippers))\b/i,
      /\b(humiliat(e|ed|ing|ion))\b.{0,30}\b(public|village|everyone|front\s+of)\b/i,
      /\bin\s+front\s+of\s+(the\s+)?(whole\s+)?(village|everyone|panchayat|crowd)\b/i,
      /\b(made|forced)\s+(me|us|him|her)\s+to\s+(apologis|apologiz|beg|bow|touch\s+(his|their)\s+feet)/i,
      /\b(spat|urinat(ed|ing))\s+on\b/i,
      /\bblacken(ed)?\s+(my|his|her|our)\s+face\b/i,
    ],
    devanagari: ["धिंड", "गावासमोर अपमान", "सबके सामने अपमान", "जूते की माला", "तोंडाला काळं"],
  },
  {
    category: "caste_slur",
    label: "Reports caste-based abuse or being named by caste",
    patterns: [
      /\bcaste\b.{0,25}\b(abuse|slur|name|insult|taunt|remark|comment)/i,
      /\b(abused|insulted|taunted|called)\s+.{0,25}\bcaste\b/i,
      /\bby\s+(my|our|his|her)\s+caste\s+name\b/i,
      /\bcasteist\b/i,
      /\b(called|calls)\s+(me|us)\s+(a\s+)?(chamar|bhangi|mahar|mang|dhed|chuhra)\b/i,
    ],
    devanagari: ["जातिवाचक", "जात काढून", "जातीवरून", "जाति सूचक", "जात दाखवून"],
  },
  {
    category: "forced_labour",
    label: "Describes forced, bonded or unpaid labour",
    patterns: [
      /\b(forced|made)\s+(me|us|him|her)\s+to\s+(work|carry|clean|dig|remove)\b/i,
      /\bbonded\s+labour|bonded\s+labor\b/i,
      /\b(without|no)\s+(any\s+)?(wages|payment|pay)\b/i,
      /\bmanual\s+scaveng/i,
      /\b(made|forced)\s+.{0,20}\b(carry|dispose\s+of)\s+(the\s+)?(carcass|dead\s+animal|night\s?soil)\b/i,
    ],
    devanagari: ["वेठबिगारी", "बंधुआ मजदूर", "बिना मजदूरी", "जबरदस्ती काम"],
  },
  {
    category: "inter_caste_relationship",
    label: "Describes violence or threats over an inter-caste relationship or marriage",
    patterns: [
      /\binter[-\s]?caste\b/i,
      /\b(married|marry|marrying|love|relationship|eloped)\b.{0,40}\b(different|another|upper|higher|lower)\s+caste\b/i,
      /\bhonou?r\s+killing\b/i,
      /\bkhap\b/i,
      /\b(family|village|panchayat)\s+(opposed|against)\s+(the\s+)?(marriage|match)\b/i,
    ],
    devanagari: ["आंतरजातीय", "अंतरजातीय", "दुसऱ्या जातीत लग्न", "दूसरी जाति में शादी", "ऑनर किलिंग"],
  },
  {
    category: "land_or_property",
    label: "Describes land, house or property being taken, damaged or occupied",
    patterns: [
      /\b(grabbed|encroach(ed|ing)?|occupied|seized|took\s+over)\s+.{0,25}\b(land|field|plot|house|property)\b/i,
      /\b(house|hut|home|crop|field)\s+.{0,15}\b(burn(ed|t)|demolish(ed)?|destroyed|damaged)\b/i,
      /\b(burn(ed|t)|demolish(ed)?|destroyed)\s+(our|my|their)\s+(house|hut|home|crop)\b/i,
      /\bevict(ed|ion)?\b/i,
    ],
    devanagari: ["जमीन बळकाव", "जमीन हड़प", "घर जाळल", "घर जला", "बेदखल"],
  },
  {
    category: "displacement",
    label: "Describes having to leave home or being driven out",
    patterns: [
      /\b(had|have|forced)\s+to\s+(leave|flee|abandon)\s+(the\s+)?(village|home|house|our\s+place)\b/i,
      /\b(drove|driven|chased|thrown)\s+(us|me|them)\s+out\b/i,
      /\bcan'?t\s+(go\s+)?(back|return)\s+to\s+(the\s+)?(village|home)\b/i,
      /\b(living|staying)\s+in\s+(a\s+)?(camp|relief\s+camp|shelter)\b/i,
    ],
    devanagari: ["गाव सोडाव", "गांव छोड़ना", "घर सोडून", "गावातून हाकलल"],
  },
  {
    category: "witch_hunting",
    label: "Describes being accused of witchcraft",
    patterns: [
      /\bwitch\s?(hunt|hunting|craft)?\b/i,
      /\b(accused|branded|called)\s+(me|her|us|them)\s+(of\s+being\s+)?(a\s+)?witch\b/i,
      /\bdayan|dakan|chudail\b/i,
    ],
    devanagari: ["डायन", "चेटकीण", "जादूटोणा"],
  },
  {
    category: "sexual_violence",
    label: "Describes sexual violence",
    patterns: [
      /\b(rap(e|ed|ing))\b/i,
      /\bsexual(ly)?\s+(assault(ed)?|abus(e|ed)|harass(ed|ment))\b/i,
      /\bmolest(ed|ation)?\b/i,
      /\b(touched|grabbed)\s+(me|her)\s+.{0,15}\b(inappropriately|without\s+consent)\b/i,
    ],
    devanagari: ["बलात्कार", "लैंगिक अत्याचार", "विनयभंग", "छेड़छाड़"],
  },
  {
    category: "obstruction_of_justice",
    label: "Describes pressure to withdraw the case, or the complaint not being registered",
    patterns: [
      /\b(pressur(e|ed|ing)|forcing|forced|threaten(ed|ing)?)\s+.{0,30}\b(withdraw|drop|take\s+back|compromise|settle)\b/i,
      /\b(withdraw|drop)\s+(the\s+)?(case|complaint|fir)\b/i,
      /\b(police|they)\s+.{0,25}\b(refused|would\s?n'?t|did\s?n'?t)\s+.{0,15}\b(register|file|write|take)\b.{0,20}\b(fir|complaint|case)\b/i,
      /\bno\s+fir\s+(was\s+)?(registered|filed)\b/i,
      /\b(offer(ed|ing)?|gave)\s+(me|us)\s+money\s+to\s+.{0,20}\b(settle|withdraw|keep\s+quiet)\b/i,
    ],
    devanagari: [
      "तक्रार मागे", "केस मागे", "शिकायत वापस", "केस वापस",
      "एफआयआर नोंदवली नाही", "एफआईआर दर्ज नहीं", "तडजोड करण्यासाठी दबाव",
    ],
  },
];

const firstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) return found[0];
  }
  return null;
};

const firstSubstring = (text: string, needles: string[]): string | null => {
  for (const needle of needles) {
    if (text.includes(needle)) return needle;
  }
  return null;
};

/**
 * Reads a piece of the person's own writing for described atrocity exposure.
 *
 * Returns every category it finds, not a single best guess: a survivor
 * describing a boycott and a denied complaint has described two different
 * things, and collapsing them would lose the one a counsellor can act on.
 *
 * Tense is not discriminated here, unlike the crisis detector. That is
 * deliberate and the difference matters: the crisis detector decides whether
 * something is happening now, which is a question about urgency. This decides
 * what a person has lived through, which does not stop being true because it
 * happened in 2019.
 */
export function detectAtrocityExposure(text: string): AtrocityExposure {
  const empty: AtrocityExposure = { signals: [], affectsScore: false };
  if (!text || typeof text !== "string") return empty;
  const trimmed = text.trim();
  if (!trimmed) return empty;

  const signals: AtrocitySignal[] = [];
  for (const definition of DEFINITIONS) {
    const matched =
      firstMatch(trimmed, definition.patterns) ?? firstSubstring(trimmed, definition.devanagari);
    if (matched) {
      signals.push({ category: definition.category, label: definition.label, matched });
    }
  }

  return { signals, affectsScore: false };
}

/** Every category this can report, for the counsellor-facing legend. */
export const ATROCITY_CATEGORIES: { category: AtrocityCategory; label: string }[] =
  DEFINITIONS.map(({ category, label }) => ({ category, label }));
