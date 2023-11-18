import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { isCurrentVoiceLanguage } from "./lang-util.js";
import { generateTTSResourceURL } from "../tts-stt/google-api.js";
import { currentVoice } from "../interfaces/voice.js";

export const loadVoiceIfNone = async (channelId: string): Promise<void> => {
  try {
    await getCurrentVoice(channelId);
  } catch (error) {
    console.error(`No current TTS voice from s3 for channel: ${channelId}, setting default...`);
    await setCurrentVoice(channelId);
  }
};

const getCurrentVoice = async (channelId: string) => {
  try {
    const voicePath = getVoicePath(channelId);
    const voiceS3Stream = await downloadFileFromS3(voicePath);
    const savedVoiceJsonString: string = await readJsonStreamToString(voiceS3Stream);
    Object.assign(currentVoice, JSON.parse(savedVoiceJsonString));
  } catch (error) {
    console.error("Error loading voice from storage, will load default: ", error);
    await setCurrentVoice(channelId);
  }
};

export const setCurrentVoice = async (channelId: string): Promise<void> => {
  try {
    assignVoiceNameAndDefaults();
    const voicePath = getVoicePath(channelId);
    const currentVoiceJson = JSON.stringify(currentVoice);
    await uploadFileToS3(voicePath, currentVoiceJson);
  } catch (error) {
    console.error(`Error setting current voice or channel: ${channelId}:`, error);
  } 
};

const assignVoiceNameAndDefaults = async (): Promise<void> => {
  if (isCurrentVoiceLanguage("English")) {
    currentVoice.defaultAnswer = generateTTSResourceURL("Your question was not understood or heard properly, please repeat.");
    currentVoice.waitingAnswer = generateTTSResourceURL("Please wait while the answer is being prepared.");
  } else {
    currentVoice.defaultAnswer = generateTTSResourceURL("Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.");
    currentVoice.waitingAnswer = generateTTSResourceURL("Vaš odgovor se generiše, molimo vas sačekajte.");
  }
};

const getVoicePath = (channelId: string): string => `voices/${channelId}-voice.json`;
