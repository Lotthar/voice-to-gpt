import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { English, Language, getLanguageFromName } from "../interfaces/language.js";
import { sendMessageToProperChannel } from "./discord-util.js";

export const getCurrentVoiceLanguage = async (channelId: string) => {
  try {
    const langPath: string = getLangugagePath(channelId);
    const langS3JsonStream = await downloadFileFromS3(langPath);
    const currentVoiceLanguageJSON: string = await readJsonStreamToString(langS3JsonStream);
    const currentVoiceLanguage = JSON.parse(currentVoiceLanguageJSON);
    console.log(`Current bot voice langugage for channel: ${channelId} is: ${currentVoiceLanguage.name!}`);
    return currentVoiceLanguage;
  } catch (error) {
    console.error(`Error loading language from storage for channel: ${channelId} , setting English as default`, error);
    const currentVoiceLanguage = English;
    await setCurrentLanguage(currentVoiceLanguage, channelId);
    return currentVoiceLanguage;
  }
};

const setCurrentLanguage = async (lang: Language, channelId: string): Promise<void> => {
  try {
    const langPath = getLangugagePath(channelId);
    await uploadFileToS3(langPath, JSON.stringify(lang));
    console.log(`Current language for channel: ${channelId} has been set to: ${lang.name}`);
  } catch (error) {
    console.error(`Error setting current voice language for channel: ${channelId}`, error);
  }
};

export const botSpeakingLanguageChanged = async (message: string, channelId: string): Promise<Boolean> => {
  const command = "!lang ";
  if (!message.startsWith(command)) return false;
  const langName = message.replace(command, "").toLowerCase();
  const currentVoiceLanguage = getLanguageFromName(langName);
  console.log("Lang", currentVoiceLanguage);
  await setCurrentLanguage(currentVoiceLanguage,channelId);
  await sendMessageToProperChannel(`Voice communication language changed to: **${currentVoiceLanguage.name}**`, channelId);
  console.log(`Voice and language have been successfully changed for channel: ${channelId}`);
  return true;
};

const getLangugagePath = (channelId: string): string => `languages/${channelId}-lang`;