import { generateTTSResourceURL } from "../tts-stt/google-api.js";

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
  defaultAnswer: generateTTSResourceURL("Your question was not understood or heard properly, please repeat.","en"),
  waitingAnswer: generateTTSResourceURL("Please wait while the answer is being prepared.", "en")
};

export const Serbian: Language = {
  name: "Serbian",
  sttCode: "sr-RS",
  ttsCode: "sr",
  defaultAnswer: generateTTSResourceURL("Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.", "sr"),
  waitingAnswer: generateTTSResourceURL("Vaš odgovor se generiše, molimo vas sačekajte.","sr")
};

export const voiceLanguages: Language[] = [English, Serbian];

export const getLanguageFromName = (langName: String): Language => {
  const language = voiceLanguages.find((lang) => lang.name!.toLowerCase().startsWith(langName.toLowerCase()));
  return !!language ? language : voiceLanguages[0];
};
