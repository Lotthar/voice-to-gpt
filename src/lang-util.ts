import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readTextStreamToString } from "./stream-util.js";
import { getLanguageFromName, voiceLanguages, currentVoiceLanguage, currentVoice } from "./interfaces/language.js";
import { currentChannelId } from "./bot.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { setCurrentVoice } from "./voice.js";

export const loadCurrentVoiceLangugageIfNone = async (): Promise<void> => {
  try {
    if (currentVoiceLanguage.name !== null) return;
    await loadAndAssignFromStorage();
  } catch (error) {
    console.error("No current voice language from s3, setting default...");
    await resetLangugageWithVoice(voiceLanguages[0].name!);
  }
};

const loadAndAssignFromStorage = async () => {
  try {
    const langPath: string = getLangugagePath();
    const langS3Stream = await downloadFileFromS3(langPath);
    const langName: string = await readTextStreamToString(langS3Stream);
    Object.assign(currentVoiceLanguage!, getLanguageFromName(langName));
    console.log(`Current bot voice langugage is: ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error("Error loading language from storage: ", error);
  }
};

export const resetLangugageWithVoice = async (langName: string): Promise<void> => {
  await setCurrentLanguage(langName);
  await setCurrentVoice(currentVoice.name);
  console.log(`Voice and language have been successfully changed!`);
};

const setCurrentLanguage = async (langName: string): Promise<void> => {
  try {
    const langPath = getLangugagePath();
    await uploadFileToS3(langPath, langName);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
    console.log(`Current language has been set to: ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error("Error setting current voice language:", error);
  }
};

export const botSpeakingLanguageChanged = async (message: string): Promise<Boolean> => {
  const command = "!lang ";
  if (!message.startsWith(command)) return false;
  const langName = message.replace(command, "").toLowerCase();
  if (currentVoiceLanguage.name == null || currentVoiceLanguage.name.toLowerCase() !== langName) {
    await resetLangugageWithVoice(langName);
    await sendMessageToProperChannel(`Voice communication language changed to: **${currentVoiceLanguage.name}**`);
  } else {
    await sendMessageToProperChannel(`You already use voice langugage: **${currentVoiceLanguage.name}**`);
  }
  return true;
};

const getLangugagePath = (): string => `languages/${currentChannelId}-lang`;

export const isCurrentVoiceLanguage = (langName: string): Boolean => !!currentVoiceLanguage && currentVoiceLanguage.name === langName;
