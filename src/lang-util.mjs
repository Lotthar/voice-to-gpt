import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.mjs";
import { readTextStream } from "./stream-util.mjs";
import { currentChannelId } from "./bot.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";

const VoiceLanguages = [
  {
    name: "English",
    sttCode: "en-US",
    ttsCode: "en",
  },
  {
    name: "Serbian",
    sttCode: "sr-RS",
    ttsCode: "sr",
  },
];

export let currentVoiceLanguage = {
  name: null,
  sttCode: null,
  ttsCode: null,
};

export const loadCurrentVoiceLangugageIfNone = async () => {
  try {
    if (currentVoiceLanguage.name !== null) return;
    const langPath = getLangugagePath();
    const langS3Stream = await downloadFileFromS3(langPath);
    const langName = await readTextStream(langS3Stream);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
    console.log(`Current voice channel language is ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error("No current voice language from s3, setting default...");
    await setCurrentLanguage(VoiceLanguages[0].name);
  }
};

export const resetLangugageIfChanged = async (langName) => {
  if (currentVoiceLanguage.name !== langName) {
    await setCurrentLanguage(langName);
    console.log(`Voice language has been changed. New langugage: ${currentVoiceLanguage.name}`);
  }
};

const setCurrentLanguage = async (langName) => {
  try {
    const langPath = getLangugagePath();
    await uploadFileToS3(langPath, langName);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
  } catch (error) {
    console.error("Error setting current voice language:", error);
    return null;
  }
};

export const botSpeakingLanguageChanged = async (message) => {
  const command = "!lang !";
  if (!message.startsWith(command)) return false;
  const langName = message.replace(command, "");
  await resetLangugageIfChanged(langName);
  await sendMessageToProperChannel(
    `Voice communication language changed to: **${currentVoiceLanguage.name}**`
  );
  return true;
};

const getLanguageFromName = (langName) => {
  let lang = VoiceLanguages.find((lang) => lang.name.toLowerCase() === langName.toLowerCase());
  return lang ? lang : VoiceLanguages[0];
};

const getLangugagePath = () => `languages/${currentChannelId}-lang`;

export const isCurrentVoiceLanguage = (langName) =>
  !!currentVoiceLanguage && currentVoiceLanguage.name === langName;
