import type { VoiceErrorCode } from "./voiceTypes";

export interface Strings {
  title: string;
  subtitle: string;
  tapToTalk: string;
  connecting: string;
  listening: string;
  listeningHint: string;
  thinking: string;
  speaking: string;
  speakingHint: string;
  start: string;
  stop: string;
  interrupt: string;
  mute: string;
  unmute: string;
  mutedNotice: string;
  language: string;
  captionsShow: string;
  captionsHide: string;
  captions: string;
  you: string;
  assistant: string;
  typeLabel: string;
  typePlaceholder: string;
  send: string;
  consentTitle: string;
  consentIntro: string;
  consentProcessing: string;
  consentNoPressure: string;
  consentNotHuman: string;
  consentStop: string;
  consentStore: (days: number) => string;
  consentStart: string;
  safetyTitle: string;
  safetyContinue: string;
  safetyCall: (name: string) => string;
  endedTimeLimit: string;
  endedIdle: string;
  textOption: string;
  errors: Record<VoiceErrorCode, string>;
}

// Hindi and Marathi strings need review by native speakers before launch.
const en: Strings = {
  title: "Talk with Support",
  subtitle: "Speak naturally. You can stop at any time.",
  tapToTalk: "Tap to talk",
  connecting: "Connecting...",
  listening: "I'm listening...",
  listeningHint: "Take your time. I'm here.",
  thinking: "Give me a moment...",
  speaking: "I'm speaking...",
  speakingHint: "You can interrupt me at any time — just start talking.",
  start: "Start voice conversation",
  stop: "Stop voice conversation",
  interrupt: "Interrupt",
  mute: "Turn my microphone off",
  unmute: "Turn my microphone back on",
  mutedNotice: "Your microphone is off. Nothing is being heard or sent. The conversation is still here when you want it.",
  language: "Language",
  captionsShow: "Show captions",
  captionsHide: "Hide captions",
  captions: "Conversation captions",
  you: "You",
  assistant: "Assistant",
  typeLabel: "Prefer to type?",
  typePlaceholder: "Type a message",
  send: "Send",
  consentTitle: "Talk with Support",
  consentIntro: "You can speak naturally with the support assistant.",
  consentProcessing: "Your voice is processed to provide the conversation. Audio is not recorded or stored.",
  consentNoPressure: "You don't need to share information you're uncomfortable sharing.",
  consentNotHuman: "This assistant is not a person, and not a doctor, lawyer, police officer or therapist.",
  consentStop: "You can stop the conversation at any time.",
  consentStore: (days) => `Keep a temporary transcript of my conversation for ${days} days (optional)`,
  consentStart: "Start conversation",
  safetyTitle: "Safety support",
  safetyContinue: "Continue conversation",
  safetyCall: (name) => `Call ${name}`,
  endedTimeLimit: "This conversation reached its time limit. You can start a new one whenever you like.",
  endedIdle: "The conversation ended after a long quiet period. You can start again whenever you like.",
  textOption: "You can still use the text chat.",
  errors: {
    mic_denied: "I can't access your microphone. Please allow microphone access and try again.",
    mic_unavailable: "I couldn't find a microphone. Please check your device and try again.",
    unsupported: "Voice isn't supported in this browser. You can still use the text chat.",
    network: "Your connection seems to have been interrupted.",
    connection_lost: "Your connection seems to have been interrupted.",
    provider_unavailable: "I'm having trouble connecting right now. Please try again in a moment.",
    quota_exceeded: "Voice support is temporarily unavailable. You can still use the text support options.",
    session_limit: "Voice support is busy right now. Please try again in a few minutes.",
    rate_limited: "Voice support is busy right now. Please try again in a few minutes.",
    session_expired: "This conversation has ended. You can start a new one.",
    stt_failed: "Sorry, I didn't catch that. Could you say it again?",
    internal: "Something went wrong. Please try again.",
  },
};

const hi: Strings = {
  ...en,
  title: "सहायता से बात करें",
  subtitle: "आराम से बोलिए। आप कभी भी रोक सकते हैं।",
  tapToTalk: "बात करने के लिए टैप करें",
  connecting: "जुड़ रहा है...",
  listening: "मैं सुन रहा हूँ...",
  listeningHint: "आराम से, अपना समय लीजिए।",
  thinking: "एक पल...",
  speaking: "मैं बोल रहा हूँ...",
  speakingHint: "आप कभी भी बोलकर मुझे रोक सकते हैं।",
  start: "आवाज़ से बातचीत शुरू करें",
  stop: "बातचीत रोकें",
  interrupt: "रोकें",
  mute: "मेरा माइक्रोफ़ोन बंद करें",
  unmute: "मेरा माइक्रोफ़ोन फिर चालू करें",
  mutedNotice: "आपका माइक्रोफ़ोन बंद है। कुछ भी सुना या भेजा नहीं जा रहा। बातचीत यहीं है, जब आप चाहें।",
  language: "भाषा",
  captionsShow: "कैप्शन दिखाएँ",
  captionsHide: "कैप्शन छिपाएँ",
  captions: "बातचीत के कैप्शन",
  you: "आप",
  assistant: "सहायक",
  typeLabel: "लिखना पसंद है?",
  typePlaceholder: "संदेश लिखें",
  send: "भेजें",
  consentTitle: "सहायता से बात करें",
  consentIntro: "आप सहायक से स्वाभाविक रूप से बात कर सकते हैं।",
  consentProcessing: "बातचीत के लिए आपकी आवाज़ प्रोसेस की जाती है। ऑडियो रिकॉर्ड या सेव नहीं किया जाता।",
  consentNoPressure: "जो बताने में आप सहज नहीं हैं, वह बताने की ज़रूरत नहीं है।",
  consentNotHuman: "यह सहायक कोई व्यक्ति नहीं है, और न ही डॉक्टर, वकील, पुलिस या थेरेपिस्ट है।",
  consentStop: "आप कभी भी बातचीत रोक सकते हैं।",
  consentStore: (days) => `मेरी बातचीत का अस्थायी लिखित रिकॉर्ड ${days} दिनों तक रखें (वैकल्पिक)`,
  consentStart: "बातचीत शुरू करें",
  safetyTitle: "सुरक्षा सहायता",
  safetyContinue: "बातचीत जारी रखें",
  safetyCall: (name) => `${name} को कॉल करें`,
  textOption: "आप अभी भी टेक्स्ट चैट का उपयोग कर सकते हैं।",
  errors: {
    ...en.errors,
    mic_denied: "मैं आपके माइक्रोफ़ोन तक नहीं पहुँच पा रहा। कृपया माइक्रोफ़ोन की अनुमति दें और फिर कोशिश करें।",
    network: "लगता है आपका कनेक्शन टूट गया है।",
    connection_lost: "लगता है आपका कनेक्शन टूट गया है।",
    provider_unavailable: "अभी जुड़ने में दिक्कत हो रही है। कृपया थोड़ी देर बाद कोशिश करें।",
    quota_exceeded: "आवाज़ सहायता अभी उपलब्ध नहीं है। आप टेक्स्ट सहायता का उपयोग कर सकते हैं।",
    internal: "कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",
  },
};

const mr: Strings = {
  ...en,
  title: "मदतीशी बोला",
  subtitle: "सहजपणे बोला. तुम्ही कधीही थांबवू शकता.",
  tapToTalk: "बोलण्यासाठी टॅप करा",
  connecting: "जोडत आहे...",
  listening: "मी ऐकत आहे...",
  listeningHint: "सावकाश, तुमचा वेळ घ्या.",
  thinking: "एक क्षण...",
  speaking: "मी बोलत आहे...",
  speakingHint: "तुम्ही कधीही बोलून मला थांबवू शकता.",
  start: "आवाजाने संवाद सुरू करा",
  stop: "संवाद थांबवा",
  interrupt: "थांबवा",
  mute: "माझा मायक्रोफोन बंद करा",
  unmute: "माझा मायक्रोफोन पुन्हा चालू करा",
  mutedNotice: "तुमचा मायक्रोफोन बंद आहे. काहीही ऐकले किंवा पाठवले जात नाही. संभाषण इथेच आहे, तुम्हाला हवे तेव्हा.",
  language: "भाषा",
  captionsShow: "कॅप्शन दाखवा",
  captionsHide: "कॅप्शन लपवा",
  captions: "संवादाचे कॅप्शन",
  you: "तुम्ही",
  assistant: "सहाय्यक",
  typeLabel: "लिहायला आवडेल?",
  typePlaceholder: "संदेश लिहा",
  send: "पाठवा",
  consentTitle: "मदतीशी बोला",
  consentIntro: "तुम्ही सहाय्यकाशी सहजपणे बोलू शकता.",
  consentProcessing: "संवादासाठी तुमचा आवाज प्रक्रिया केला जातो. ऑडिओ रेकॉर्ड किंवा जतन केला जात नाही.",
  consentNoPressure: "जे सांगायला तुम्हाला सोयीचे वाटत नाही, ते सांगण्याची गरज नाही.",
  consentNotHuman: "हा सहाय्यक व्यक्ती नाही, तसेच डॉक्टर, वकील, पोलीस किंवा थेरपिस्ट नाही.",
  consentStop: "तुम्ही कधीही संवाद थांबवू शकता.",
  consentStore: (days) => `माझ्या संवादाची तात्पुरती लेखी नोंद ${days} दिवस ठेवा (ऐच्छिक)`,
  consentStart: "संवाद सुरू करा",
  safetyTitle: "सुरक्षितता मदत",
  safetyContinue: "संवाद सुरू ठेवा",
  safetyCall: (name) => `${name} ला कॉल करा`,
  textOption: "तुम्ही अजूनही मजकूर चॅट वापरू शकता.",
  errors: {
    ...en.errors,
    mic_denied: "मला तुमच्या मायक्रोफोनपर्यंत पोहोचता येत नाही. कृपया परवानगी द्या आणि पुन्हा प्रयत्न करा.",
    network: "तुमचे कनेक्शन तुटल्यासारखे दिसते.",
    connection_lost: "तुमचे कनेक्शन तुटल्यासारखे दिसते.",
    provider_unavailable: "आत्ता जोडण्यात अडचण येत आहे. कृपया थोड्या वेळाने प्रयत्न करा.",
    quota_exceeded: "आवाज मदत सध्या उपलब्ध नाही. तुम्ही मजकूर मदत वापरू शकता.",
    internal: "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.",
  },
};

const STRINGS: Record<string, Strings> = { en, hi, mr };

export function getStrings(language: string): Strings {
  return STRINGS[language.slice(0, 2)] ?? en;
}
