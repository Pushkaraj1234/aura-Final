/**
 * Crisis detection for the conversational assistant.
 *
 * WHY THIS IS SEPARATE FROM checkUrgentSafety()
 *
 * aiService.checkUrgentSafety() is a substring scan over a keyword list, and
 * it is right for the job it does: reflections are short, deliberate, and
 * written in answer to a wellbeing question. A chat thread is neither. People
 * describe the atrocity they survived in it, in the past tense, at length.
 *
 * That difference is the whole design problem here. A survivor typing "they
 * attacked my brother in 2019" must get a conversation, not an emergency
 * panel. Answering a person's account of what was done to them with a crisis
 * banner tells them the system cannot hear them, and it is also simply the
 * wrong reading. So this module discriminates on recency where the evidence
 * supports doing so, and refuses to where it does not.
 *
 * THE TWO TIERS
 *
 *   self_harm       fires on any mention, in any tense, with no suppression.
 *   imminent_danger fires unless the surrounding text reads as past narrative.
 *
 * The asymmetry is deliberate. Someone writing about having wanted to die
 * last year is telling us something about now, and the cost of offering
 * support to a person who did not need it at this moment is small. Whereas
 * third-party violence is the ordinary subject matter of this platform, and a
 * detector that fires on all of it would fire constantly and be switched off.
 *
 * WHERE IT IS UNCERTAIN, IT FIRES. A danger phrase with no recency marker
 * either way is treated as present, the same way slaEngine.bandFor() gives an
 * unrecognised severity the tighter clock rather than the looser one.
 *
 * Nothing in here calls a model. A crisis path that depends on an LLM being
 * available, in budget, and behaving is not a safety net.
 */

export type CrisisTier = "self_harm" | "imminent_danger";

export interface CrisisDetection {
  triggered: boolean;
  tier: CrisisTier | null;
  /** The exact text that matched, for the audit record and the counsellor. */
  matched: string | null;
  /**
   * Set when a danger phrase was found but read as past narrative. Kept so
   * the decision is inspectable: a near-miss that turns out to be a real miss
   * needs to be visible to whoever tunes this.
   */
  suppressedBy?: string;
}

const NONE: CrisisDetection = { triggered: false, tier: null, matched: null };

/**
 * Latin-script patterns use \b. Devanagari ones cannot: \b is defined against
 * [A-Za-z0-9_], so every Devanagari character counts as a non-word character
 * and \b lands in the wrong places. Those are plain substring tests instead.
 */
const SELF_HARM_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bend(ing)?\s+(my\s+life|it\s+all|myself)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bwant(ed|ing)?\s+to\s+die\b/i,
  /\bwanna\s+die\b/i,
  /\bwant(ed)?\s+to\s+be\s+dead\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bself[-\s]?harm(ing|ed)?\b/i,
  /\b(hurt|harm|cut|cutting)(ing)?\s+my\s?self\b/i,
  /\b(do\s*n[o']?t|don't|dont|do not)\s+want\s+to\s+(live|be\s+here|go\s+on|wake\s+up)\b/i,
  /\bno\s+(point|reason)\s+(in\s+)?(living|being\s+here|going\s+on)\b/i,
  /\bdon'?t\s+see\s+the\s+point\s+(in\s+)?(living|going\s+on)\b/i,
  /\bnot\s+worth\s+living\b/i,
  /\boverdos(e|ing|ed)\b/i,
];

/** Hindi and Marathi self-harm language. Substring, for the reason above. */
const SELF_HARM_DEVANAGARI: string[] = [
  "आत्महत्या", // suicide (hi/mr)
  "खुदकुशी", // suicide (hi, Urdu-derived)
  "मरना चाहता", // want to die (hi, masc)
  "मरना चाहती", // want to die (hi, fem)
  "मर जाऊं", // let me die (hi)
  "जीना नहीं चाहता", // do not want to live (hi, masc)
  "जीना नहीं चाहती", // do not want to live (hi, fem)
  "जीने का मन नहीं", // no wish to live (hi)
  "खुद को नुकसान", // harm myself (hi)
  "अपने आप को नुकसान", // harm myself (hi)
  "मला मरायचं", // I want to die (mr)
  "जगायचं नाही", // do not want to live (mr)
  "जगावंसं वाटत नाही", // do not feel like living (mr)
  "स्वतःला संपवाय", // end myself (mr)
  "स्वतःला इजा", // harm myself (mr)
  "जीव द्यायचा", // to take one's own life (mr)
  "जीवाचं बरं वाईट", // euphemism for self-harm (mr)
];

const IMMINENT_DANGER_PATTERNS: RegExp[] = [
  /\b(going|about)\s+to\s+kill\s+me\b/i,
  /\b(he|she|they|someone|somebody)\s+(is|are|will|'?ll)\s+(going\s+to\s+)?kill\s+me\b/i,
  /\bthreaten(ed|ing)?\s+to\s+(kill|burn|rape|hurt)\b/i,
  /\bin\s+(immediate\s+|serious\s+|real\s+)?danger\b/i,
  /\bmy\s+life\s+is\s+(in\s+danger|at\s+risk)\b/i,
  /\b(someone|somebody|he|she|they)\s+(is|are)\s+(hurting|attacking|beating|chasing|following)\s+me\b/i,
  /\bthey'?(re|\s+are)\s+coming\s+for\s+me\b/i,
  /\b(i'?m|i\s+am|we'?re|we\s+are)\s+not\s+safe\b/i,
  /\bthey\s+will\s+hurt\s+(me|us|my\s+(family|children|kids))\b/i,
];

/**
 * Violence vocabulary that is NOT on its own a reason to fire.
 *
 * This is the ordinary subject matter of the platform. "They attacked my
 * brother in 2019" is a person describing their case, and answering it with
 * an emergency panel would be both wrong and unkind. But the same vocabulary
 * next to a present marker is a live report: "they attacked us in 2019 and he
 * is outside my house right now" is an emergency that happens to contain a
 * date, and the direct-threat patterns above miss it because the only verb in
 * the present tense is "is".
 *
 * So these fire only in combination, never alone.
 */
const VIOLENCE_CONTEXT_PATTERNS: RegExp[] = [
  /\battack(ed|ing)?\b/i,
  /\bthreaten(ed|ing)?\b/i,
  /\b(beat|beating|assault(ed|ing)?)\b/i,
  /\b(chas(e|ed|ing)|follow(ed|ing))\s+(me|us)\b/i,
  /\b(rap(e|ed|ing)|stab(bed|bing)?|burn(ed|ing|t)?)\b/i,
  /\bmob\b/i,
  /\bhurt\s+(me|us|my\s+(family|children|kids|brother|sister))\b/i,
];

const VIOLENCE_CONTEXT_DEVANAGARI: string[] = [
  "हमला", // attack (hi/mr)
  "मारहाण", // assault (mr)
  "धमकी", // threat (hi/mr)
  "पीटा", // beaten (hi)
];

const IMMINENT_DANGER_DEVANAGARI: string[] = [
  "जान से मारने", // threatening to kill (hi)
  "जान को खतरा", // life is in danger (hi)
  "मुझे मार डालेंगे", // they will kill me (hi)
  "सुरक्षित नहीं हूँ", // I am not safe (hi)
  "मारायला येत", // coming to beat/kill (mr)
  "जीवाला धोका", // danger to life (mr)
  "सुरक्षित नाही", // not safe (mr)
];

/**
 * Markers that place a statement in the past. Only ever consulted for
 * imminent_danger, never for self_harm.
 */
const PAST_NARRATIVE_MARKERS: RegExp[] = [
  /\b(last|past)\s+(year|month|week|night|time)\b/i,
  /\b\d+\s+(years?|months?|weeks?|days?)\s+ago\b/i,
  /\bin\s+(19|20)\d{2}\b/i,
  /\bback\s+(in|then|when)\b/i,
  /\bused\s+to\b/i,
  /\bwhen\s+(i|we|he|she|they)\s+(was|were)\b/i,
  /\bat\s+the\s+time\b/i,
  /\b(that|the)\s+(day|night|incident|attack|case)\b/i,
  /\bhas\s+since\b/i,
  /\bafter\s+(that|it\s+happened)\b/i,
];

/**
 * Markers that place a statement in the present. These override a past
 * marker, because "they attacked us in 2019 and he is outside my house right
 * now" is a present emergency that happens to contain a date.
 */
const PRESENT_MARKERS: RegExp[] = [
  /\bright\s+now\b/i,
  /\b(is|it'?s)\s+happening\s+(now|again)\b/i,
  /\bcurrently\b/i,
  /\bat\s+the\s+moment\b/i,
  /\b(tonight|today)\b/i,
  /\bjust\s+now\b/i,
  /\bas\s+i\s+(write|type|speak|am\s+writing)\b/i,
  /\boutside\s+(my|the)\s+(house|door|home|gate)\b/i,
  /\babout\s+to\b/i,
  /\bplease\s+help\s+(me\s+)?now\b/i,
  // No \b on these: it is defined against [A-Za-z0-9_], so every Devanagari
  // character reads as a non-word character and the boundary lands wrong.
  /आत्ता/, // right now (mr)
  /अभी/, // right now (hi)
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
 * Reads one message. Only the person's own words should ever be passed here;
 * screening the assistant's replies is screenAssistantReply()'s job, and
 * running this over them would fire on the resource text it just offered.
 */
export function detectCrisis(text: string): CrisisDetection {
  if (!text || typeof text !== "string") return NONE;
  const trimmed = text.trim();
  if (!trimmed) return NONE;

  const selfHarm =
    firstMatch(trimmed, SELF_HARM_PATTERNS) ?? firstSubstring(trimmed, SELF_HARM_DEVANAGARI);
  if (selfHarm) {
    return { triggered: true, tier: "self_harm", matched: selfHarm };
  }

  const present = firstMatch(trimmed, PRESENT_MARKERS);

  const danger =
    firstMatch(trimmed, IMMINENT_DANGER_PATTERNS) ??
    firstSubstring(trimmed, IMMINENT_DANGER_DEVANAGARI);

  if (danger) {
    // Present beats past: a dated account can still describe a live threat.
    if (present) return { triggered: true, tier: "imminent_danger", matched: danger };
    const past = firstMatch(trimmed, PAST_NARRATIVE_MARKERS);
    if (past) {
      return { triggered: false, tier: null, matched: danger, suppressedBy: past };
    }
    // No marker either way. Treat it as now.
    return { triggered: true, tier: "imminent_danger", matched: danger };
  }

  // Violence vocabulary is only a signal alongside a present marker. Alone it
  // is someone telling us about their case, which is what this app is for.
  if (present) {
    const violence =
      firstMatch(trimmed, VIOLENCE_CONTEXT_PATTERNS) ??
      firstSubstring(trimmed, VIOLENCE_CONTEXT_DEVANAGARI);
    if (violence) {
      return { triggered: true, tier: "imminent_danger", matched: violence };
    }
  }

  return NONE;
}

/**
 * Defence in depth on the model's own output.
 *
 * The input gate means a flagged message never reaches the model at all, so
 * this only matters when the model volunteers something dangerous in reply to
 * a message that read as ordinary. It looks for means and method, which is
 * the category of output that can actually cause harm, rather than for
 * distress vocabulary, which the assistant is supposed to be able to discuss.
 */
const UNSAFE_REPLY_PATTERNS: RegExp[] = [
  /\bhow\s+(to|you\s+can|one\s+can|i\s+can)\s+(kill\s+yourself|end\s+your\s+life|hang\s+yourself)\b/i,
  /\b(lethal|fatal|deadly)\s+(dose|amount|quantity)\b/i,
  /\btake\s+\d+\s+(or\s+more\s+)?(pills|tablets|capsules)\b/i,
  /\b(easiest|quickest|best|painless|least\s+painful)\s+way\s+to\s+(die|kill\s+yourself|end)\b/i,
  /\byou\s+should\s+(kill\s+yourself|end\s+it|give\s+up)\b/i,
];

export function screenAssistantReply(reply: string): CrisisDetection {
  if (!reply || typeof reply !== "string") return NONE;
  const matched = firstMatch(reply, UNSAFE_REPLY_PATTERNS);
  return matched
    ? { triggered: true, tier: "self_harm", matched }
    : NONE;
}

// ---------------------------------------------------------------------------
// What the person reads
// ---------------------------------------------------------------------------

/**
 * These are written out per language rather than generated, because the one
 * message a person in crisis reads is not the place for a template that has
 * never been read aloud by someone who speaks the language.
 *
 * Two variants each. `notified` is only used when an alert was actually
 * written, so the promise that someone will follow up is never made on a
 * request we could not attach to a person.
 */
type CrisisCopy = { notified: string; anonymous: string };

const HELPLINES_EN = `If you are in immediate danger, call 112.
KIRAN, free and 24 hours, in 13 languages: 1800-599-0019
AASRA, 24 hours: +91 98204 66726`;

const HELPLINES_HI = `अगर आप तुरंत खतरे में हैं, तो 112 पर कॉल करें।
किरण, नि:शुल्क, 24 घंटे, 13 भाषाओं में: 1800-599-0019
आसरा, 24 घंटे: +91 98204 66726`;

const HELPLINES_MR = `तुम्ही तात्काळ धोक्यात असाल, तर 112 वर कॉल करा.
किरण, मोफत, 24 तास, 13 भाषांमध्ये: 1800-599-0019
आसरा, 24 तास: +91 98204 66726`;

const CRISIS_COPY: Record<string, CrisisCopy> = {
  en: {
    notified: `Thank you for telling me. I'd rather stop and point you to a person than keep answering as though this were an ordinary question.

${HELPLINES_EN}

A counsellor here has been told you reached out, so someone will follow up with you. You won't have to explain it from the beginning again.`,
    anonymous: `Thank you for telling me. I'd rather stop and point you to a person than keep answering as though this were an ordinary question.

${HELPLINES_EN}

I'm not able to pass this to a counsellor here, because you aren't signed in. If you sign in and check in, someone on your side will see it.`,
  },
  hi: {
    notified: `आपने बताया, इसके लिए धन्यवाद। मैं इसे एक आम सवाल की तरह लेकर जवाब देता रहूँ, इससे बेहतर है कि मैं रुकूँ और आपको किसी इंसान तक पहुँचाऊँ।

${HELPLINES_HI}

यहाँ के एक काउंसलर को बता दिया गया है कि आपने संपर्क किया, कोई आपसे आगे बात करेगा। आपको सब कुछ शुरू से दोबारा बताने की ज़रूरत नहीं होगी।`,
    anonymous: `आपने बताया, इसके लिए धन्यवाद। मैं इसे एक आम सवाल की तरह लेकर जवाब देता रहूँ, इससे बेहतर है कि मैं रुकूँ और आपको किसी इंसान तक पहुँचाऊँ।

${HELPLINES_HI}

आप साइन इन नहीं हैं, इसलिए मैं यह बात यहाँ के काउंसलर तक नहीं पहुँचा सकता। साइन इन करके चेक-इन करेंगे, तो आपकी तरफ़ का कोई व्यक्ति इसे देख पाएगा।`,
  },
  mr: {
    notified: `तुम्ही सांगितलंत, त्याबद्दल धन्यवाद. हा एक नेहमीचा प्रश्न आहे असं समजून उत्तर देत राहण्यापेक्षा मी थांबतो आणि तुम्हाला एका माणसापर्यंत पोहोचवतो.

${HELPLINES_MR}

इथल्या एका समुपदेशकाला कळवलं आहे की तुम्ही संपर्क साधला, कोणीतरी तुमच्याशी बोलेल. तुम्हाला पुन्हा सुरुवातीपासून सगळं सांगावं लागणार नाही.`,
    anonymous: `तुम्ही सांगितलंत, त्याबद्दल धन्यवाद. हा एक नेहमीचा प्रश्न आहे असं समजून उत्तर देत राहण्यापेक्षा मी थांबतो आणि तुम्हाला एका माणसापर्यंत पोहोचवतो.

${HELPLINES_MR}

तुम्ही साइन इन केलेलं नाही, त्यामुळे मी हे इथल्या समुपदेशकापर्यंत पोहोचवू शकत नाही. साइन इन करून चेक-इन केलंत, तर तुमच्या बाजूचं कोणीतरी हे पाहू शकेल.`,
  },
};

/**
 * The reply a person gets instead of a model answer.
 *
 * `counsellorNotified` must reflect whether an alert was really written, not
 * whether one was attempted. Telling someone in crisis that help is coming
 * when it is not is worse than saying nothing.
 */
export function crisisResponse(language: string | undefined, counsellorNotified: boolean): string {
  const copy = CRISIS_COPY[(language || "en").slice(0, 2).toLowerCase()] ?? CRISIS_COPY.en;
  return counsellorNotified ? copy.notified : copy.anonymous;
}

/** Alert text for the counsellor. Never includes what the person typed. */
export function crisisAlertReason(tier: CrisisTier): string {
  return tier === "self_harm"
    ? "Crisis language about self-harm or suicide in the assistant chat"
    : "Language describing immediate danger in the assistant chat";
}

export function crisisAlertAction(tier: CrisisTier): string {
  return tier === "self_harm"
    ? "Contact within the hour. The assistant stopped answering and showed crisis lines. Confirm the person is safe before anything else."
    : "Contact within the hour. The assistant stopped answering and showed emergency numbers. Establish whether the danger is current and whether police or shelter contact is wanted.";
}
