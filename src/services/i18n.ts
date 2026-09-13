import { LanguageCode } from "../types";

export interface Translations {
  [key: string]: any;
  appName: string;
  prototypeNotice: string;
  tagline: string;
  welcome: string;
  welcomeSub: string;
  dailyCheckIn: string;
  startCheckIn: string;
  stepOf: (current: number, total: number) => string;
  back: string;
  next: string;
  submit: string;
  cancel: string;
  languageSelect: string;
  voluntaryAgreement?: string;
  beginReflection?: string;
  todaySignal?: string;
  factorsReasoning?: string;
  ethicalNotice?: string;
  howFeelingToday?: string;
  veryDifficult?: string;
  difficult?: string;
  neutral?: string;
  good?: string;
  veryGood?: string;
  stressLevelToday?: string;
  calmLow?: string;
  mild?: string;
  moderate?: string;
  elevated?: string;
  veryHigh?: string;
  sleepRestful?: string;
  veryPoor?: string;
  restless?: string;
  fair?: string;
  goodSleep?: string;
  veryRestful?: string;
  feelSafeEnvironment?: string;
  yes?: string;
  mostly?: string;
  unsure?: string;
  no?: string;
  connectedCommunity?: string;
  isolated?: string;
  mostlyAlone?: string;
  someContact?: string;
  connected?: string;
  stronglySupported?: string;
  supportPersonCheckin?: string;
  yesConnect?: string;
  noTracking?: string;
  previous?: string;
  skip?: string;
  continue?: string;
  submitCheckin?: string;
  consent: {
    title: string;
    description: string;
    voluntary: string;
    noDiagnosis: string;
    dataUsage: string;
    acceptAndProceed: string;
  };
  questions: {
    wellbeing: {
      title: string;
      subtitle: string;
      options: { value: number; label: string; desc: string }[];
    };
    stress: {
      title: string;
      subtitle: string;
      options: { value: number; label: string; desc: string }[];
    };
    sleep: {
      title: string;
      subtitle: string;
      options: { value: number; label: string; desc: string }[];
    };
    safety: {
      title: string;
      subtitle: string;
      options: { value: string; label: string; desc: string }[];
    };
    connection: {
      title: string;
      subtitle: string;
      options: { value: number; label: string; desc: string }[];
    };
    support: {
      title: string;
      subtitle: string;
      yesOption: string;
      noOption: string;
    };
    optionalNote: {
      title: string;
      subtitle: string;
      placeholder: string;
      shareLabel: string;
      skip: string;
    };
  };
  voiceCheckIn: {
    toggleText: string;
    toggleVoice: string;
    listening: string;
    speakNow: string;
    samplePrompts: string;
    simulatedNotice: string;
    retry: string;
    useTranscription: string;
  };
  results: {
    completeTitle: string;
    completeDesc: string;
    indicatorLabel: string;
    statusStable: string;
    statusElevated: string;
    statusUrgent: string;
    supportOffered: string;
    supportNotNeeded: string;
    groundingTipTitle: string;
    groundingTip: string;
    returnHome: string;
  };
  emergency: {
    buttonText: string;
    bannerTitle: string;
    bannerText: string;
    callNow: string;
    crisisDirectory: string;
  };
  offline: {
    online: string;
    offline: string;
    simulatingOffline: string;
    pendingSync: (count: number) => string;
    syncNow: string;
    syncSuccess: string;
  };
  disclaimer: string;
}

/**
 * Hand-written dictionaries. Only the three languages the project shipped with
 * are here; every other supported language is filled in at runtime from these
 * English strings via Bhashini, which is why this is a Partial.
 */
export const TRANSLATIONS: Partial<Record<LanguageCode, Translations>> = {
  en: {
    appName: "AURA",
    prototypeNotice: "Demonstration Prototype",
    tagline: "Adaptive Wellbeing & Distress Monitoring",
    welcome: "Welcome to your safe reflection space",
    welcomeSub: "Track how you feel over time. AURA supports you without making medical diagnoses.",
    dailyCheckIn: "Daily Wellbeing Check-in",
    startCheckIn: "Begin 2-Minute Reflection",
    stepOf: (curr, total) => `Question ${curr} of ${total}`,
    back: "Back",
    next: "Continue",
    submit: "Complete Check-in",
    cancel: "Cancel",
    languageSelect: "Language / भाषा / भाषा निवडा",
    voluntaryAgreement: "Voluntary Reflection Agreement",
    beginReflection: "Begin Reflection",
    todaySignal: "Today's Wellbeing Indicator",
    factorsReasoning: "Contributing Factors & Transparent Reasoning",
    ethicalNotice: "Ethical Guardrail: Not a medical diagnosis. Indicator reflects change in self-reported factors.",
    howFeelingToday: "How are you feeling overall today?",
    veryDifficult: "Very Difficult",
    difficult: "Difficult",
    neutral: "Moderate",
    good: "Good",
    veryGood: "Very Good",
    stressLevelToday: "How would you describe your stress level today?",
    calmLow: "Calm / Low",
    mild: "Mild",
    moderate: "Moderate",
    elevated: "Elevated",
    veryHigh: "Very High",
    sleepRestful: "How restful was your sleep last night?",
    veryPoor: "Very Poor",
    restless: "Restless",
    fair: "Fair",
    goodSleep: "Good",
    veryRestful: "Very Restful",
    feelSafeEnvironment: "Do you feel physically safe in your current living environment?",
    yes: "Yes, Safe",
    mostly: "Mostly Safe",
    unsure: "Unsure / Uneasy",
    no: "No, Unsafe",
    connectedCommunity: "How connected do you feel to friends, family, or community?",
    isolated: "Isolated",
    mostlyAlone: "Mostly Alone",
    someContact: "Some Contact",
    connected: "Connected",
    stronglySupported: "Strongly Supported",
    supportPersonCheckin: "Would you like a support person or counselor to check in with you?",
    yesConnect: "Yes, please connect me with a counselor",
    noTracking: "No, I'm just recording my reflection",
    previous: "Previous",
    skip: "Skip this question",
    continue: "Continue",
    submitCheckin: "Submit Check-in",
    consent: {
      title: "Voluntary Participation & Privacy Safeguards",
      description: "AURA provides supportive trend signals for human humanitarian staff. It does not replace clinical care.",
      voluntary: "I am voluntarily participating in this wellbeing reflection.",
      noDiagnosis: "I understand AURA generates assistive trend signals, not medical or psychiatric diagnoses.",
      dataUsage: "I understand my responses help trained counselors provide timely care.",
      acceptAndProceed: "Accept & Continue"
    },
    questions: {
      wellbeing: {
        title: "How have you been feeling overall today?",
        subtitle: "Reflect on your emotional and mental comfort over the last 24 hours.",
        options: [
          { value: 1, label: "Very Difficult", desc: "Feeling overwhelmed, exhausted, or deeply down" },
          { value: 2, label: "Difficult", desc: "Struggling with mood, feeling drained" },
          { value: 3, label: "Moderate / Neutral", desc: "Managing day-to-day, mixed feelings" },
          { value: 4, label: "Mostly Good", desc: "Feeling positive, functioning reasonably well" },
          { value: 5, label: "Good & Stable", desc: "Calm, grounded, and feeling well" }
        ]
      },
      stress: {
        title: "What is your stress or tension level right now?",
        subtitle: "Consider mental pressure, worry, or physical tightness you may be experiencing.",
        options: [
          { value: 1, label: "Low / Calm", desc: "Peaceful, manageable pressure" },
          { value: 2, label: "Mild Stress", desc: "Slight worry, but manageable" },
          { value: 3, label: "Moderate Stress", desc: "Noticeable tension or daily pressure" },
          { value: 4, label: "High Stress", desc: "Significant pressure, feeling strained" },
          { value: 5, label: "Overwhelming Stress", desc: "Intense pressure, finding it hard to cope" }
        ]
      },
      sleep: {
        title: "How was your sleep quality last night?",
        subtitle: "Sleep disruption is often a key signal of changing emotional and physical strain.",
        options: [
          { value: 1, label: "Severely Disrupted", desc: "Unable to sleep, frequent nightmares, or woke up exhausted" },
          { value: 2, label: "Poor Sleep", desc: "Woke up multiple times, restless night" },
          { value: 3, label: "Fair / Interrupted", desc: "Average rest, slight morning fatigue" },
          { value: 4, label: "Good Rest", desc: "Fell asleep reasonably well, mostly rested" },
          { value: 5, label: "Deep & Restful", desc: "Woke up refreshed and well-rested" }
        ]
      },
      safety: {
        title: "Do you feel safe in your current environment?",
        subtitle: "Your safety and security are fundamental to your personal wellbeing.",
        options: [
          { value: "Yes", label: "Yes, I feel safe", desc: "My surroundings feel stable and secure" },
          { value: "Mostly", label: "Mostly safe", desc: "Minor concerns, but generally okay" },
          { value: "Unsure", label: "Unsure / Ambiguous", desc: "Uncertain circumstances or uncomfortable environment" },
          { value: "No", label: "No, I do not feel safe", desc: "Facing direct instability, danger, or emotional crisis" }
        ]
      },
      connection: {
        title: "How connected do you feel to others around you?",
        subtitle: "Social ties, family contact, or community support can protect emotional resilience.",
        options: [
          { value: 1, label: "Completely Isolated", desc: "Feeling entirely alone with no one to talk to" },
          { value: 2, label: "Mostly Alone", desc: "Limited contact, feeling misunderstood" },
          { value: 3, label: "Some Connection", desc: "A few conversations, but want more depth" },
          { value: 4, label: "Well Connected", desc: "Have trusted friends, family, or peers" },
          { value: 5, label: "Strongly Supported", desc: "Deeply connected, surrounded by supportive community" }
        ]
      },
      support: {
        title: "Would you like a human counselor to check in with you?",
        subtitle: "You can request a gentle, confidential conversation with a trained counselor.",
        yesOption: "Yes, please have a counselor reach out",
        noOption: "No, I am just recording my daily reflection"
      },
      optionalNote: {
        title: "Is there anything you would like your counselor to know?",
        subtitle: "Optional: Share any thoughts, worries, or details in your own words. (You can skip this).",
        placeholder: "e.g., Struggling with relocation noise, feeling anxious about work tomorrow...",
        shareLabel: "Share this text note with my assigned counselor",
        skip: "Skip this question"
      }
    },
    voiceCheckIn: {
      toggleText: "Text Mode",
      toggleVoice: "Voice Check-in (Demo)",
      listening: "Listening to your reflection...",
      speakNow: "Speak naturally into your microphone or pick a demo prompt",
      samplePrompts: "Or choose an example prompt for demonstration:",
      simulatedNotice: "Language pattern analysis only. It does not diagnose or infer medical conditions.",
      retry: "Record Again",
      useTranscription: "Use This Reflection"
    },
    results: {
      completeTitle: "Reflection Recorded",
      completeDesc: "Thank you for taking time for yourself today. Your check-in has been securely processed.",
      indicatorLabel: "Current Wellbeing Indicator",
      statusStable: "Your reflection indicates a stable routine today.",
      statusElevated: "We noticed some increased stress signals today. A counselor is available if you would like to connect.",
      statusUrgent: "Your safety is our top priority. Immediate crisis resources are available right now.",
      supportOffered: "A humanitarian counselor has received your check-in and will follow up gently.",
      supportNotNeeded: "Continue voluntary daily monitoring to keep track of your journey.",
      groundingTipTitle: "Quick Calming Technique (4-4-4 Breathing)",
      groundingTip: "Inhale gently for 4 seconds, hold your breath for 4 seconds, and exhale slowly for 4 seconds. Repeat 3 times.",
      returnHome: "Return to Profile"
    },
    emergency: {
      buttonText: "Emergency Safety",
      bannerTitle: "Need Immediate Help?",
      bannerText: "If you are in acute crisis, please contact local emergency or crisis support services.",
      callNow: "Access Crisis Lines",
      crisisDirectory: "National & Regional Helplines"
    },
    offline: {
      online: "Online",
      offline: "Offline Mode",
      simulatingOffline: "Simulating Offline / Low-Connectivity",
      pendingSync: (count) => `${count} check-in(s) stored locally`,
      syncNow: "Sync Now",
      syncSuccess: "Check-ins successfully synchronized with secure cloud layer!"
    },
    disclaimer: "AI-assisted wellbeing prototype. Not a diagnostic tool. Human review required for all elevated signals."
  },
  hi: {
    appName: "ऑरा (AURA)",
    prototypeNotice: "प्रदर्शन प्रोटोटाइप",
    tagline: "अनुकूलित भलाई और तनाव निगरानी",
    welcome: "आपके सुरक्षित आत्म-चिंतन स्थल में आपका स्वागत है",
    welcomeSub: "समय के साथ अपनी भावनाओं को समझें। AURA बिना किसी चिकित्सीय निदान के आपकी मदद करता है।",
    dailyCheckIn: "दैनिक भलाई चेक-इन",
    startCheckIn: "2-मिनट का आत्म-चिंतन शुरू करें",
    stepOf: (curr, total) => `प्रश्न ${curr} / ${total}`,
    back: "पीछे जाएं",
    next: "आगे बढ़ें",
    submit: "चेक-इन पूरा करें",
    cancel: "रद्द करें",
    languageSelect: "Language / भाषा / भाषा निवडा",
    consent: {
      title: "स्वैच्छिक भागीदारी और गोपनीयता सुरक्षा",
      description: "AURA मानवीय सहायता कार्यकर्ताओं के लिए केवल सहायक संकेत प्रदान करता है। यह डॉक्टरी इलाज का विकल्प नहीं है।",
      voluntary: "मैं इस भलाई चिंतन में स्वेच्छा से भाग ले रहा/रही हूँ।",
      noDiagnosis: "मैं समझता/समझती हूँ कि AURA चिकित्सीय या मानसिक विकार का निदान नहीं करता है।",
      dataUsage: "मैं समझता/समझती हूँ कि मेरी प्रतिक्रियाएं प्रशिक्षित परामर्शदाता को समय पर सहायता प्रदान करने में मदद करती हैं।",
      acceptAndProceed: "स्वीकार करें और आगे बढ़ें"
    },
    questions: {
      wellbeing: {
        title: "आज आप कुल मिलाकर कैसा महसूस कर रहे हैं?",
        subtitle: "पिछले 24 घंटों के दौरान अपनी भावनात्मक और मानसिक स्थिति पर विचार करें।",
        options: [
          { value: 1, label: "बहुत कठिन / तनावपूर्ण", desc: "अत्यधिक परेशान, थका हुआ या उदास महसूस करना" },
          { value: 2, label: "कठिन", desc: "मनोदशा में परेशानी, ऊर्जा की कमी" },
          { value: 3, label: "सामान्य / मध्यम", desc: "मिश्रित भावनाएं, सामान्य दिनचर्या" },
          { value: 4, label: "अधिकतर अच्छा", desc: "सकारात्मक महसूस करना, अच्छा कामकाज" },
          { value: 5, label: "बहुत अच्छा और शांत", desc: "संतुलित, शांत और स्वस्थ महसूस करना" }
        ]
      },
      stress: {
        title: "इस समय आपका तनाव या चिंता का स्तर क्या है?",
        subtitle: "अपने मानसिक दबाव, चिंता या शारीरिक तनाव पर ध्यान दें।",
        options: [
          { value: 1, label: "कम / शांत", desc: "शांतिपूर्ण और सामान्य स्थिति" },
          { value: 2, label: "हल्का तनाव", desc: "थोड़ी चिंता लेकिन नियंत्रण में" },
          { value: 3, label: "मध्यम तनाव", desc: "दैनिक दबाव या ध्यान देने योग्य तनाव" },
          { value: 4, label: "अधिक तनाव", desc: "काफी मानसिक दबाव महसूस करना" },
          { value: 5, label: "अत्यधिक भारी तनाव", desc: "संभालना बहुत कठिन महसूस होना" }
        ]
      },
      sleep: {
        title: "कल रात आपकी नींद कैसी थी?",
        subtitle: "नींद में बाधा अक्सर बढ़ते तनाव का मुख्य संकेत होती है।",
        options: [
          { value: 1, label: "अत्यधिक खराब", desc: "सो नहीं पाए या बार-बार नींद खुली" },
          { value: 2, label: "खराब नींद", desc: "बेचैन रात, बार-बार जागना" },
          { value: 3, label: "साधारण / ठीक-ठाक", desc: "औसत आराम, हल्की थकान" },
          { value: 4, label: "अच्छी नींद", desc: "अच्छी तरह सोए, तरोताजा महसूस किया" },
          { value: 5, label: "गहरी और आरामदायक", desc: "पूरी नींद ली और ऊर्जावान महसूस किया" }
        ]
      },
      safety: {
        title: "क्या आप अपने वर्तमान परिवेश में सुरक्षित महसूस करते हैं?",
        subtitle: "आपकी सुरक्षा और शांति आपकी भलाई के लिए सबसे महत्वपूर्ण है।",
        options: [
          { value: "Yes", label: "हाँ, मैं सुरक्षित महसूस करता/करती हूँ", desc: "मेरा वातावरण स्थिर और सुरक्षित है" },
          { value: "Mostly", label: "अधिकतर सुरक्षित", desc: "छोटी चिंताएं हैं, लेकिन आमतौर पर ठीक" },
          { value: "Unsure", label: "अनिश्चित / अस्पष्ट", desc: "असुरक्षित परिस्थितियाँ या असहज वातावरण" },
          { value: "No", label: "नहीं, मैं सुरक्षित नहीं हूँ", desc: "सीधे संकट, अस्थिरता या डर का सामना" }
        ]
      },
      connection: {
        title: "आप अपने आस-पास के लोगों से कितना जुड़ाव महसूस करते हैं?",
        subtitle: "परिवार, दोस्त या समुदाय का साथ भावनात्मक शक्ति देता है।",
        options: [
          { value: 1, label: "पूरी तरह अकेला", desc: "बात करने के लिए कोई नहीं है" },
          { value: 2, label: "काफी हद तक अकेला", desc: "सीमित संपर्क, अनसुना महसूस होना" },
          { value: 3, label: "थोड़ा जुड़ाव", desc: "कुछ लोगों से सामान्य बातचीत" },
          { value: 4, label: "अच्छा जुड़ाव", desc: "भरोसेमंद दोस्त या परिवार मौजूद हैं" },
          { value: 5, label: "मजबूत सामाजिक सहारा", desc: "गहरा समर्थन और समझदार लोग साथ हैं" }
        ]
      },
      support: {
        title: "क्या आप चाहते हैं कि कोई मानवीय परामर्शदाता आपसे संपर्क करे?",
        subtitle: "आप एक प्रशिक्षित परामर्शदाता के साथ गोपनीय बातचीत का अनुरोध कर सकते हैं।",
        yesOption: "हाँ, कृपया किसी परामर्शदाता को मुझसे बात करने कहें",
        noOption: "नहीं, मैं केवल दैनिक चिंतन रिकॉर्ड कर रहा/रही हूँ"
      },
      optionalNote: {
        title: "क्या आप अपने सपोर्ट वर्कर को कुछ बताना चाहते हैं?",
        subtitle: "वैकल्पिक: अपने शब्दों में कोई बात या चिंता साझा करें। (आप इसे छोड़ भी सकते हैं)।",
        placeholder: "उदा. नई जगह में सोने में परेशानी, आने वाले दिनों की चिंता...",
        shareLabel: "यह संदेश मेरे परामर्शदाता के साथ साझा करें",
        skip: "यह प्रश्न छोड़ें"
      }
    },
    voiceCheckIn: {
      toggleText: "टेक्स्ट मोड",
      toggleVoice: "आवाज से चेक-इन (डेमो)",
      listening: "आपकी बात सुनी जा रही है...",
      speakNow: "माइक्रोफोन में स्वाभाविक रूप से बोलें या डेमो विकल्प चुनें",
      samplePrompts: "या प्रदर्शन के लिए एक उदाहरण चुनें:",
      simulatedNotice: "केवल भाषा पैटर्न विश्लेषण। किसी भी बीमारी का निदान नहीं करता है।",
      retry: "पुनः रिकॉर्ड करें",
      useTranscription: "इस प्रतिक्रिया का उपयोग करें"
    },
    results: {
      completeTitle: "चिंतन सफलतापूर्वक दर्ज हुआ",
      completeDesc: "आज अपने लिए समय निकालने के लिए धन्यवाद। आपकी जानकारी सुरक्षित रूप से संसाधित की गई है।",
      indicatorLabel: "वर्तमान भलाई सूचक",
      statusStable: "आपकी आज की स्थिति स्थिर और सामान्य दिखाई देती है।",
      statusElevated: "हमने कुछ बढ़ते तनाव के संकेत देखे हैं। यदि आप चाहें तो परामर्शदाता उपलब्ध है।",
      statusUrgent: "आपकी सुरक्षा हमारी सर्वोच्च प्राथमिकता है। आपातकालीन सहायता तुरंत उपलब्ध है।",
      supportOffered: "मानवीय कार्यकर्ता को आपका चेक-इन मिल गया है और वे शीघ्र संपर्क करेंगे।",
      supportNotNeeded: "अपनी प्रगति पर नजर रखने के लिए दैनिक चिंतन जारी रखें।",
      groundingTipTitle: "शांत होने की त्वरित तकनीक (4-4-4 श्वास)",
      groundingTip: "4 सेकंड तक सांस अंदर लें, 4 सेकंड रोकें, और 4 सेकंड में धीरे-धीरे छोड़ें। 3 बार दोहराएं।",
      returnHome: "प्रोफ़ाइल पर वापस जाएं"
    },
    emergency: {
      buttonText: "आपातकालीन सहायता",
      bannerTitle: "तुरंत मदद चाहिए?",
      bannerText: "यदि आप गंभीर संकट में हैं, तो कृपया तुरंत आपातकालीन सेवाओं से संपर्क करें।",
      callNow: "हेल्पलाइन देखें",
      crisisDirectory: "राष्ट्रीय एवं क्षेत्रीय संकट हेल्पलाइन"
    },
    offline: {
      online: "ऑनलाइन",
      offline: "ऑफलाइन मोड",
      simulatingOffline: "ऑफलाइन / कम नेटवर्क का प्रदर्शन",
      pendingSync: (count) => `${count} चेक-इन डिवाइस में सुरक्षित हैं`,
      syncNow: "अभी सिंक करें",
      syncSuccess: "डेटा सुरक्षित सर्वर के साथ सफलतापूर्वक सिंक हो गया!"
    },
    disclaimer: "एआई-सहायक भलाई प्रोटोटाइप। यह कोई नैदानिक उपकरण नहीं है। सभी महत्वपूर्ण संकेतों के लिए मानवीय समीक्षा आवश्यक है।"
  },
  mr: {
    appName: "ऑरा (AURA)",
    prototypeNotice: "प्रात्यक्षिक प्रोटोटाइप",
    tagline: "अनुकूलित मानसिक स्वास्थ्य आणि ताण निरीक्षण",
    welcome: "तुमच्या सुरक्षित आत्मचिंतन जागेत स्वागत आहे",
    welcomeSub: "काळाच्या ओघात तुमच्या भावना समजून घ्या. AURA वैद्यकीय निदान न करता तुम्हाला आधार देतो.",
    dailyCheckIn: "दैनिक स्वास्थ्य चेक-इन",
    startCheckIn: "२ मिनिटांचे आत्मचिंतन सुरू करा",
    stepOf: (curr, total) => `प्रश्न ${curr} / ${total}`,
    back: "मागे जा",
    next: "पुढे जा",
    submit: "चेक-इन पूर्ण करा",
    cancel: "रद्द करा",
    languageSelect: "Language / भाषा / भाषा निवडा",
    consent: {
      title: "ऐच्छिक सहभाग आणि गोपनीयता संरक्षण",
      description: "AURA मदतनीसांसाठी केवळ पूरक माहिती पुरवतो. हा कोणत्याही वैद्यकीय उपचारांचा पर्याय नाही.",
      voluntary: "मी या स्वास्थ्य चिंतनात स्वेच्छेने सहभागी होत आहे.",
      noDiagnosis: "मला समजले आहे की AURA कोणताही मानसिक किंवा शारीरिक आजार ठरवत नाही.",
      dataUsage: "मला समजले आहे की माझी उत्तरे प्रशिक्षित समुपदेशकाला योग्य वेळी मदत करण्यास साहाय्य करतात.",
      acceptAndProceed: "स्वीकारा आणि पुढे चला"
    },
    questions: {
      wellbeing: {
        title: "आज तुम्हाला एकंदरीत कसे वाटत आहे?",
        subtitle: "गेल्या २४ तासांतील तुमच्या मानसिक आणि भावनिक स्थितीवर विचार करा.",
        options: [
          { value: 1, label: "खूप कठीण / अस्वस्थ", desc: "अतिशय निराश, थकलेले किंवा त्रासलेले वाटणे" },
          { value: 2, label: "कठीण", desc: "मन अस्वस्थ, ऊर्जेचा अभाव" },
          { value: 3, label: "मध्यम / सामान्य", desc: "मिश्र भावना, दैनंदिन कामे चालू आहेत" },
          { value: 4, label: "बऱ्यापैकी चांगले", desc: "सकारात्मक, उत्साही वाटत आहे" },
          { value: 5, label: "उत्तम आणि शांत", desc: "शांत, स्थिर आणि आनंदी वाटत आहे" }
        ]
      },
      stress: {
        title: "सध्या तुमच्या ताणतणावाचे प्रमाण किती आहे?",
        subtitle: "तुमच्या मनातील चिंता, भार किंवा शरीरातील अस्वस्थतेवर लक्ष द्या.",
        options: [
          { value: 1, label: "कमी / शांत", desc: "शांत आणि नियंत्रणात" },
          { value: 2, label: "हलका ताण", desc: "थोडीशी चिंता, पण हाताळता येण्यासारखी" },
          { value: 3, label: "मध्यम ताण", desc: "दैनंदिन ताण जाणवत आहे" },
          { value: 4, label: "जास्त ताण", desc: "मोठा मानसिक भार जाणवत आहे" },
          { value: 5, label: "अतिशय तीव्र ताण", desc: "ताण सहन करणे खूप कठीण जात आहे" }
        ]
      },
      sleep: {
        title: "काल रात्री तुमची झोप कशी झाली?",
        subtitle: "झोपेत अडथळा हा मानसिक ताणाचा महत्त्वाचा निर्देशक असतो.",
        options: [
          { value: 1, label: "अतिशय खराब झोप", desc: "झोपच लागली नाही किंवा सतत जाग आली" },
          { value: 2, label: "अशांत झोप", desc: "अस्वस्थ रात्र, अपुरी झोप" },
          { value: 3, label: "साधारण", desc: "मध्यम विश्रांती, हलका थकवा" },
          { value: 4, label: "चांगली झोप", desc: "व्यवस्थित झोप झाली, बरे वाटले" },
          { value: 5, label: "गाढ आणि शांत झोप", desc: "पूर्ण विश्रांती झाली, ताजेतवाने वाटत आहे" }
        ]
      },
      safety: {
        title: "तुम्हाला तुमच्या सध्याच्या परिसरात सुरक्षित वाटते का?",
        subtitle: "तुमची सुरक्षितता तुमच्या मानसिक स्वास्थ्यासाठी अत्यंत महत्त्वाची आहे.",
        options: [
          { value: "Yes", label: "होय, मला सुरक्षित वाटते", desc: "परिसर स्थिर आणि सुरक्षित आहे" },
          { value: "Mostly", label: "बऱ्यापैकी सुरक्षित", desc: "काही किरकोळ चिंता, पण एकूण ठीक" },
          { value: "Unsure", label: "अस्पष्ट / खात्री नाही", desc: "असुरक्षित किंवा संभ्रमित वातावरण" },
          { value: "No", label: "नाही, मला सुरक्षित वाटत नाही", desc: "थेट संकट, अस्थिरता किंवा भीती" }
        ]
      },
      connection: {
        title: "तुम्हाला तुमच्या आजूबाजूच्या लोकांशी किती जवळीक वाटते?",
        subtitle: "कुटुंब किंवा मित्रांचा आधार मानसिक शक्ती टिकवून ठेवतो.",
        options: [
          { value: 1, label: "पूर्णपणे एकटे", desc: "मन मोकळे करायला कोणीही नाही" },
          { value: 2, label: "बरेचसे एकटे", desc: "कमी संपर्क, कोणी समजावून घेत नाही असे वाटणे" },
          { value: 3, label: "काही प्रमाणात संपर्क", desc: "काही लोकांशी संवाद आहे" },
          { value: 4, label: "चांगला संपर्क", desc: "विश्वासू मित्र किंवा कुटुंब सोबत आहे" },
          { value: 5, label: "मजबूत सामाजिक पाठबळ", desc: "खूप जवळचे आणि आधार देणारे लोक सोबत आहेत" }
        ]
      },
      support: {
        title: "तुम्हाला एखाद्या समुपदेशकाने संपर्क करावा असे वाटते का?",
        subtitle: "तुम्ही प्रशिक्षित समुपदेशकाशी गोपनीय संभाषणासाठी विनंती करू शकता.",
        yesOption: "होय, कृपया समुपदेशकाला माझ्याशी बोलण्यास सांगा",
        noOption: "नाही, मी फक्त माझे दैनिक चिंतन नोंदवत आहे"
      },
      optionalNote: {
        title: "तुम्हाला तुमच्या समुपदेशकाला काही सांगायचे आहे का?",
        subtitle: "ऐच्छिक: तुमच्या स्वतःच्या शब्दात कोणतीही अडचण किंवा विचार लिहा. (तुम्ही हे वगळू शकता).",
        placeholder: "उदा. नवीन वातावरणात झोप येत नाही, भविष्याची चिंता वाटत आहे...",
        shareLabel: "हा संदेश माझ्या समुपदेशकासोबत शेअर करा",
        skip: "हा प्रश्न वगळा"
      }
    },
    voiceCheckIn: {
      toggleText: "मजकूर मोड",
      toggleVoice: "आवाज चेक-इन (डेमो)",
      listening: "तुमचे बोलणे ऐकले जात आहे...",
      speakNow: "मायक्रोफोनमध्ये सहजपणे बोला किंवा उदाहरणांमधून निवडा",
      samplePrompts: "किंवा प्रात्यक्षिकासाठी खालीलपैकी एक निवडा:",
      simulatedNotice: "केवळ भाषा नमुना विश्लेषण. कोणत्याही आजाराचे निदान करत नाही.",
      retry: "पुन्हा रेकॉर्ड करा",
      useTranscription: "हे उत्तर वापरा"
    },
    results: {
      completeTitle: "चिंतन यशस्वीरीत्या नोंदवले गेले",
      completeDesc: "आज स्वतःसाठी वेळ दिल्याबद्दल धन्यवाद. तुमची नोंद सुरक्षितपणे साठवली गेली आहे.",
      indicatorLabel: "सध्याचा स्वास्थ्य निर्देशांक",
      statusStable: "तुमची आजची स्थिती सामान्य आणि स्थिर दिसत आहे.",
      statusElevated: "आम्हाला ताणतणावात काही वाढ जाणवली आहे. तुम्हाला हवे असल्यास समुपदेशक उपलब्ध आहेत.",
      statusUrgent: "तुमची सुरक्षितता ही आमची सर्वोच्च प्राथमिकता आहे. तातडीची मदत उपलब्ध आहे.",
      supportOffered: "समुपदेशकाला तुमची नोंद मिळाली असून ते लवकरच संपर्क साधतील.",
      supportNotNeeded: "तुमच्या प्रवासाची नोंद ठेवण्यासाठी दैनिक चिंतन सुरू ठेवा.",
      groundingTipTitle: "मन शांत करण्याचे तंत्र (४-४-४ श्वासोच्छ्वास)",
      groundingTip: "४ सेकंद श्वास आत घ्या, ४ सेकंद रोखून धरा आणि ४ सेकंदात हळूहळू सोडा. ३ वेळा करा.",
      returnHome: "प्रोफाइलवर परत जा"
    },
    emergency: {
      buttonText: "आपत्कालीन मदत",
      bannerTitle: "तातडीची मदत हवी आहे?",
      bannerText: "तुम्ही गंभीर संकटात असाल, तर कृपया स्थानिक आपत्कालीन सेवेशी संपर्क साधा.",
      callNow: "हेल्पलाइन पहा",
      crisisDirectory: "राष्ट्रीय व प्रादेशिक संकट हेल्पलाइन"
    },
    offline: {
      online: "ऑनलाइन",
      offline: "ऑफलाइन मोड",
      simulatingOffline: "ऑफलाइन / कमी नेटवर्क प्रात्यक्षिक",
      pendingSync: (count) => `${count} चेक-इन डिव्हाइसमध्ये सुरक्षित आहेत`,
      syncNow: "आता सिंक करा",
      syncSuccess: "डेटा सुरक्षित सर्व्हरवर यशस्वीपणे सिंक झाला!"
    },
    disclaimer: "एआय-सहाय्यक स्वास्थ्य प्रोटोटाइप. हे कोणतेही वैद्यकीय निदान साधन नाही. मानवी पडताळणी आवश्यक आहे."
  }
};

export type Language = LanguageCode;

export const getTranslation = (lang: LanguageCode): Translations => {
  return TRANSLATIONS[lang] || (TRANSLATIONS.en as Translations);
};

/** Languages with a hand-written dictionary — instant, and never a network call. */
export const BUILT_IN_LANGUAGES: LanguageCode[] = ["en", "hi", "mr"];

export const hasBuiltInTranslation = (lang: LanguageCode): boolean =>
  BUILT_IN_LANGUAGES.includes(lang);
