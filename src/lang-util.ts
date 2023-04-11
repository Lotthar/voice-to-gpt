import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readTextStream } from "./stream-util.js";
import { getLanguageFromName, voiceLanguages, currentVoiceLanguage } from "./interfaces/language.js";
import { currentChannelId } from "./bot.js";
import { sendMessageToProperChannel } from "./discord-util.js";



export const loadCurrentVoiceLangugageIfNone = async () : Promise<void> => {
  try {
    if (currentVoiceLanguage.name !== null) return;
    const langPath: string = getLangugagePath();
    const langS3Stream = await downloadFileFromS3(langPath);
    const langName: string = await readTextStream(langS3Stream);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
    console.log(`Current voice channel language is ${currentVoiceLanguage.name}`);
  } catch (error) {
    console.error("No current voice language from s3, setting default...");
    await setCurrentLanguage(voiceLanguages[0].name);
  }
};

export const resetLangugageIfChanged = async (langName: string) : Promise<void> => {
  if (currentVoiceLanguage.name !== langName) {
    await setCurrentLanguage(langName);
    console.log(`Voice language has been changed. New langugage: ${currentVoiceLanguage.name}`);
  }
};

const setCurrentLanguage = async (langName : string) : Promise<void> => {
  try {
    const langPath = getLangugagePath();
    await uploadFileToS3(langPath, langName);
    Object.assign(currentVoiceLanguage, getLanguageFromName(langName));
  } catch (error) {
    console.error("Error setting current voice language:", error);
  }
};

export const botSpeakingLanguageChanged = async (message : string) : Promise<Boolean> => {
  const command = "!lang !";
  if (!message.startsWith(command)) return false;
  const langName = message.replace(command, "");
  await resetLangugageIfChanged(langName);
  await sendMessageToProperChannel(
    `Voice communication language changed to: **${currentVoiceLanguage.name}**`
  );
  return true;
};



const getLangugagePath = () : string => `languages/${currentChannelId}-lang`;

export const isCurrentVoiceLanguage = (langName : string) : Boolean =>
  !!currentVoiceLanguage && currentVoiceLanguage.name === langName;
