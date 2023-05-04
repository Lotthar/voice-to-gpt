import { sendMessageToProperChannel } from "./discord-util.js";
import { currentChannelId } from "./bot.js";
import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { isCurrentVoiceLanguage } from "./lang-util.js";
import { generateTTSResourceURL } from "./google-api.js";
import { loadFakeYouVoice } from "./fy-tts-api.js";
import { currentVoice, voices, DEFAULT_ENGLISH_VOICE } from "./interfaces/voice.js";

export const loadVoiceIfNone = async (): Promise<void> => {
  try {
    if (currentVoice.name !== null) return;
    await loadAndAssignVoiceFromStorage();
  } catch (error) {
    console.error("No current TTS voice from s3, setting default...");
    await setCurrentVoice(null);
  }
};

const loadAndAssignVoiceFromStorage = async () => {
  try {
    const voicePath = getVoicePath();
    const voiceS3Stream = await downloadFileFromS3(voicePath);
    const savedVoiceJsonString: string = await readJsonStreamToString(voiceS3Stream);
    Object.assign(currentVoice, JSON.parse(savedVoiceJsonString));
    console.log(`Current TTS voice is: ${currentVoice.name}`);
  } catch (error) {
    console.error("Error loading voice from storage: ", error);
  }
};

export const botTTSVoiceChanged = async (message: string): Promise<boolean> => {
  const command = "!voice ";
  if (!message.startsWith(command)) return false;
  let voiceName = message.replace(command, "");
  if (currentVoice.name !== getVoiceByName(voiceName)) {
    await setCurrentVoice(voiceName);
    await sendMessageToProperChannel(`You changed TTS voice to: **${currentVoice.name}**`);
    console.log(`TTS Voice has been changed. New voice: ${currentVoice.name}`);
  } else {
    await sendMessageToProperChannel(`You already use TTS voice: **${currentVoice.name}**`);
  }
  return true;
};

export const setCurrentVoice = async (voiceName: string | null): Promise<void> => {
  try {
    await assignVoiceNameAndDefaults(voiceName);
    const voicePath = getVoicePath();
    const currentVoiceJson = JSON.stringify(currentVoice);
    await uploadFileToS3(voicePath, currentVoiceJson);
    console.log(`Successfully saved current TTS voice json: ${currentVoiceJson}`);
  } catch (error) {
    console.error("Error setting current TTS voice:", error);
  }
};

const assignVoiceNameAndDefaults = async (voiceName: string | null): Promise<void> => {
  if (isCurrentVoiceLanguage("English")) {
    if (voiceName === null) voiceName = DEFAULT_ENGLISH_VOICE;
    currentVoice.name = getVoiceByName(voiceName);
    await setWaitingAndDefaultEnglishAnswer();
  } else {
    setWaitingAndDefaultSerbianAnswer();
  }
};

const setWaitingAndDefaultSerbianAnswer = (): void => {
  currentVoice.defaultAnswer = generateTTSResourceURL("Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.");
  currentVoice.waitingAnswer = generateTTSResourceURL("Vaš odgovor se generiše, molimo vas sačekajte.");
};

const setWaitingAndDefaultEnglishAnswer = async (): Promise<void> => {
  const defaultAnswer = "Your question was not understood or heard properly, please repeat.";
  const waitingAnswer = "Please wait while the answer is being prepared.";
  if (checkIfGoogleAPIisUsed()) {
    currentVoice.defaultAnswer = generateTTSResourceURL(defaultAnswer);
    currentVoice.waitingAnswer = generateTTSResourceURL(waitingAnswer);
  } else {
    // Loading one of the DeepFake voices to use instead of Google TTS API
    const fakeYouVoice = await loadFakeYouVoice(currentVoice.name!, defaultAnswer, waitingAnswer);
    currentVoice.defaultAnswer = fakeYouVoice.defaultAnswer;
    currentVoice.waitingAnswer = fakeYouVoice.waitingAnswer;
  }
};

export const getVoiceByName = (voiceName: string): string => {
  let voice = voices.find((voice) => voice.toLowerCase().startsWith(voiceName.toLowerCase()));
  return voice ? voice : voices[0];
};

export const checkIfGoogleAPIisUsed = () => currentVoice.name!.toLocaleLowerCase().startsWith(DEFAULT_ENGLISH_VOICE.toLocaleLowerCase());

const getVoicePath = (): string => `voices/${currentChannelId}-voice.json`;
