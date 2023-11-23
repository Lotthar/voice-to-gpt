export interface Language {
  name: string | null;
  sttCode?: string;
  ttsCode?: string;
  defaultAnswer: string,
  waitingAnswer: string
}

export const English: Language = {
  name: "English",
  sttCode: "en-US",
  ttsCode: "en",
  defaultAnswer: "Your question was not understood or heard properly, please repeat.",
  waitingAnswer: "Please wait while the answer is being prepared."
};

export const Serbian: Language = {
  name: "Serbian",
  sttCode: "sr-RS",
  ttsCode: "sr",
  defaultAnswer: "Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.",
  waitingAnswer: "Vaš odgovor se generiše, molimo vas sačekajte."

};

export const voiceLanguages: Language[] = [English, Serbian];

export let currentVoiceLanguage: Language = { name: null, defaultAnswer: "Your question was not understood or heard properly, please repeat.",
waitingAnswer: "Please wait while the answer is being prepared."};

export const getLanguageFromName = (langName: String): Language => {
  const language = voiceLanguages.find((lang) => lang.name!.toLowerCase().startsWith(langName.toLowerCase()));
  return !!language ? language : voiceLanguages[0];
};
