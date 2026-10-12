export interface SupportedLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  speechLang: string;
  ttsCode: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: "auto",
    label: "Auto-Detect",
    nativeLabel: "Auto",
    speechLang: "en-US",
    ttsCode: "en",
  },
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    speechLang: "en-US",
    ttsCode: "en",
  },
  {
    code: "hi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    speechLang: "hi-IN",
    ttsCode: "hi",
  },
  {
    code: "te",
    label: "Telugu",
    nativeLabel: "తెలుగు",
    speechLang: "te-IN",
    ttsCode: "te",
  },
  {
    code: "ta",
    label: "Tamil",
    nativeLabel: "தமிழ்",
    speechLang: "ta-IN",
    ttsCode: "ta",
  },
  {
    code: "kn",
    label: "Kannada",
    nativeLabel: "ಕನ್ನಡ",
    speechLang: "kn-IN",
    ttsCode: "kn",
  },
  {
    code: "bn",
    label: "Bengali",
    nativeLabel: "বাংলা",
    speechLang: "bn-IN",
    ttsCode: "bn",
  },
  {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    speechLang: "es-ES",
    ttsCode: "es",
  },
];

/**
 * Strips markdown symbols, headers, URLs, and code blocks for clean, natural speech synthesis.
 */
export function stripMarkdownForTTS(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Replace code blocks with a brief spoken note
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " (code block omitted) ");

  // Strip inline code backticks
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // Strip markdown images and links
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Strip headers (#, ##, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Strip blockquotes and horizontal rules
  cleaned = cleaned.replace(/^>\s+/gm, "");
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, "");

  // Strip bold/italic markers (*, **, _, __)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, "$2");

  // Strip bullet points and list numbering
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

  // Strip URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "link");

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Check if the browser supports SpeechSynthesis
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Find the best voice for a language code (e.g. "hi", "te", "ta", "en")
 */
export function findBestVoiceForLang(langCode: string): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const target = (langCode === "auto" ? "en" : langCode).toLowerCase();

  // 1. Exact match on language prefix (e.g., 'hi', 'hi-IN')
  const matched = voices.find(
    (v) =>
      v.lang.toLowerCase() === target ||
      v.lang.toLowerCase().startsWith(target + "-") ||
      v.lang.toLowerCase().startsWith(target + "_")
  );
  if (matched) return matched;

  // 2. Name contains language name
  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === target);
  if (langObj) {
    const byName = voices.find((v) =>
      v.name.toLowerCase().includes(langObj.label.toLowerCase())
    );
    if (byName) return byName;
  }

  // 3. Fallback to default or first available voice
  return voices.find((v) => v.default) || voices[0] || null;
}

/**
 * Speak text using SpeechSynthesis with custom event handlers
 */
export function speakText(
  text: string,
  langCode: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: string) => void;
  }
): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.("Speech synthesis is not supported in this browser.");
    return null;
  }

  // Cancel any ongoing speech first
  stopSpeaking();

  const spokenText = stripMarkdownForTTS(text);
  if (!spokenText.trim()) {
    callbacks?.onEnd?.();
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(spokenText);
  const voice = findBestVoiceForLang(langCode);

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    utterance.lang = langObj?.speechLang || "en-US";
  }

  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    // Ignore interrupted/canceled errors caused by user clicking stop
    if (e.error === "canceled" || e.error === "interrupted") {
      callbacks?.onEnd?.();
      return;
    }
    callbacks?.onError?.(e.error || "Speech playback error");
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if the browser supports SpeechRecognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window
  );
}

// Window type augmentation for Web Speech API
type SpeechRecognitionType = any;

/**
 * Create a SpeechRecognition instance with event callbacks
 */
export function createSpeechRecognition(
  langCode: string,
  callbacks: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError: (errorMessage: string) => void;
    onEnd: () => void;
    onStart: () => void;
  }
): SpeechRecognitionType | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError("Speech recognition is not supported in this browser.");
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) return null;

  try {
    const recognition = new SpeechRecognitionClass();
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    recognition.lang = langObj?.speechLang || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      callbacks.onStart();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      const isFinal = Boolean(finalTranscript);
      callbacks.onResult(text, isFinal);
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      let friendlyMsg = "Speech recognition error: " + err;
      if (err === "not-allowed" || err === "permission-denied") {
        friendlyMsg = "Microphone access was denied. Please allow microphone permission in your browser address bar.";
      } else if (err === "no-speech") {
        friendlyMsg = "No speech was detected. Please click the mic and speak clearly.";
      } else if (err === "audio-capture") {
        friendlyMsg = "No microphone hardware detected on your device.";
      } else if (err === "network") {
        friendlyMsg = "Network error occurred during speech recognition.";
      }
      callbacks.onError(friendlyMsg);
    };

    recognition.onend = () => {
      callbacks.onEnd();
    };

    return recognition;
  } catch (err: any) {
    callbacks.onError("Could not initialize microphone: " + (err?.message || "Unknown error"));
    return null;
  }
}
