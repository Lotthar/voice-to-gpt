export interface Language {
  name: string | null;
  sttCode?: string;
  ttsCode?: string;
}

export const English: Language = {
  name: "English",
  sttCode: "en-US",
  ttsCode: "en",
};

export const Serbian: Language = {
  name: "Serbian",
  sttCode: "sr-RS",
  ttsCode: "sr",
};

export interface SpeechVoice {
  name: string | null;
  waitingAnswer: string | null;
  defaultAnswer: string | null;
}
export const DEFAULT_ENGLISH_VOICE = "Google";

export const voices = [
  DEFAULT_ENGLISH_VOICE,
  "Morgan Freeman",
  "Snoop Dogg (V2)",
  "Rick Sanchez",
  "Optimus Prime (Peter Cullen)",
  "Morty Smith",
  "The Joker (Heath Ledger, Version 2.0)",
  "Eminem (Slim Shady era - 1997 - 2001)",
  "James Earl Jones",
  "Sean Connery",
  "2Pac (Tupac Amaru Shakur) (ARPAbet supported)",
];

export let currentVoice: SpeechVoice = {
  name: null,
  waitingAnswer: null,
  defaultAnswer: null,
};

export const voiceLanguages: Language[] = [English, Serbian];

export let currentVoiceLanguage: Language = { name: null };

export const getLanguageFromName = (langName: String): Language => {
  const language = voiceLanguages.find((lang) => lang.name!.toLowerCase() === langName.toLowerCase());
  return !!language ? language : voiceLanguages[0];
};
