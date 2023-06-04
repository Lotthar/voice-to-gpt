import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readTextStreamToString } from "./stream-util.js";
import { getLanguageFromName, voiceLanguages, currentVoiceLanguage } from "./interfaces/language.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { setCurrentVoice } from "./voice-util.js";
import { currentVoice } from "./interfaces/voice.js";

export const loadCurrentVoiceLangugageIfNone = async (channelId: string): Promise<void> => {
  try {
    if (currentVoiceLanguage.name !== null) return;
    await getCurrentVoiceLanguage(channelId);
  } catch (error) {
    console.error(`No current voice language from s3 for channel: ${channelId}, setting default...`);
    await resetLangugageWithVoice(voiceLanguages[0].name!, channelId);
  }
};

const getCurrentVoiceLanguage = async (channelId: string) => {
  try {
    const langPath: string = getLangugagePath(channelId);
    const langS3Stream = await downloadFileFromS3(langPath);
    const langName: string = await readTextStreamToString(langS3Stream);
    Object.assign(currentVoiceLanguage!, getLanguageFromName(langName));
    console.log(`Current bot voice langugage for channel: ${channelId} is: ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error(`Error loading language from storage for channel: ${channelId}: `, error);
    await setCurrentLanguage(voiceLanguages[0].name!, channelId);
  }
};

export const resetLangugageWithVoice = async (langName: string, channelId: string): Promise<void> => {
  await setCurrentLanguage(langName, channelId);
  await setCurrentVoice(currentVoice.name, channelId);
  console.log(`Voice and language have been successfully changed for channel: ${channelId}`);
};

const setCurrentLanguage = async (langName: string, channelId: string): Promise<void> => {
  try {
    const langPath = getLangugagePath(channelId);
    await uploadFileToS3(langPath, langName);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
    console.log(`Current language for channel: ${channelId} has been set to: ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error(`Error setting current voice language for channel: ${channelId}`, error);
  }
};

export const botSpeakingLanguageChanged = async (message: string, channelId: string): Promise<Boolean> => {
  const command = "!lang ";
  if (!message.startsWith(command)) return false;
  const langName = message.replace(command, "").toLowerCase();
  if (currentVoiceLanguage.name == null || currentVoiceLanguage.name.toLowerCase() !== langName) {
    await resetLangugageWithVoice(langName, channelId);
    await sendMessageToProperChannel(`Voice communication language changed to: **${currentVoiceLanguage.name}**`, channelId);
  } else {
    await sendMessageToProperChannel(`You already use voice langugage: **${currentVoiceLanguage.name}**`, channelId);
  }
  return true;
};
const getLangugagePath = (channelId: string): string => `languages/${channelId}-lang`;

export const isCurrentVoiceLanguage = (langName: string): Boolean => !!currentVoiceLanguage && currentVoiceLanguage.name === langName;
