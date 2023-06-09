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

export const voiceLanguages: Language[] = [English, Serbian];

export let currentVoiceLanguage: Language = { name: null };

export const getLanguageFromName = (langName: String): Language => {
  const language = voiceLanguages.find((lang) => lang.name!.toLowerCase().startsWith(langName.toLowerCase()));
  return !!language ? language : voiceLanguages[0];
};
