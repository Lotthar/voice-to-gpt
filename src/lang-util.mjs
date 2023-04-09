import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.mjs";
import { readTextStream } from "./stream-util.mjs";

const VoiceLanguages = [
  {
    name: "English",
    sttCode: "en-US",
    ttsCode: "en",
    defaultAnswer:
      "https://storage.googleapis.com/vocodes-public/tts_inference_output/b/5/0/vocodes_b507e91f-f83d-4f50-b5ed-5e3d45acfcc2.wav",
    waitingAnswer:
      "https://storage.googleapis.com/vocodes-public/tts_inference_output/7/7/6/vocodes_776e6e18-f09f-410d-b359-66373ff1c906.wav",
  },
  {
    name: "Serbian",
    sttCode: "sr-RS",
    ttsCode: "sr",
    defaultAnswer:
      "https://storage.googleapis.com/vocodes-public/tts_inference_output/b/5/0/vocodes_b507e91f-f83d-4f50-b5ed-5e3d45acfcc2.wav",
    waitingAnswer:
      "https://storage.googleapis.com/vocodes-public/tts_inference_output/7/7/6/vocodes_776e6e18-f09f-410d-b359-66373ff1c906.wav",
  },
];

export let currentVoiceLanguage = {
  name: null,
  sttCode: null,
  ttsCode: null,
  defaultAnswer: null,
  waitingAnswer: null,
};

export const loadCurrentVoiceLangugageIfNone = async (channelId) => {
  try {
    if (currentVoiceLanguage.name !== null) return;
    const langPath = getLangugagePath(channelId);
    const langS3Stream = await downloadFileFromS3(langPath);
    const langName = await readTextStream(langS3Stream);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
    console.log(`Current voice channel language is ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error("No current voice language from s3, setting default...");
    setCurrentLanguage(VoiceLanguages[0].name, channelId);
  }
};

export const resetLangugageIfChanged = async (langName, channelId) => {
  if (currentVoiceLanguage.name !== langName) {
    await setCurrentLanguage(langName, channelId);
    console.log(`Voice language has been changed. New langugage: ${currentVoiceLanguage.name}`);
  }
};

const setCurrentLanguage = async (langName, channelId) => {
  try {
    const langPath = getLangugagePath(channelId);
    await uploadFileToS3(langPath, langName);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
  } catch (error) {
    console.error("Error setting current voice language:", error);
    return null;
  }
};

const getLanguageFromName = (langName) => {
  let lang = VoiceLanguages.find((lang) => lang.name.toLowerCase() === langName.toLowerCase());
  return lang ? lang : VoiceLanguages[0];
};

const getLangugagePath = (channelId) => `languages/${channelId}-lang`;

export const isCurrentVoiceLanguage = (langName) =>
  !!currentVoiceLanguage && currentVoiceLanguage.name === langName;
