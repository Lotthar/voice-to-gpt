import { sendMessageToProperChannel } from "./discord-util.js";
import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { isCurrentVoiceLanguage } from "./lang-util.js";
import { generateTTSResourceURL } from "./google-api.js";
// import { loadFakeYouVoice, loadTTSModel } from "./fy-tts-api.js";
import { currentVoice, voices, DEFAULT_ENGLISH_VOICE } from "./interfaces/voice.js";

const defaultAnswer = "Your question was not understood or heard properly, please repeat.";
const waitingAnswer = "Please wait while the answer is being prepared.";

export const loadVoiceIfNone = async (channelId: string): Promise<void> => {
  try {
    if (currentVoice.name !== null) return;
    await getCurrentVoice(channelId);
  } catch (error) {
    console.error(`No current TTS voice from s3 for channel: ${channelId}, setting default...`);
    await setCurrentVoice(null, channelId);
  }
};

const getCurrentVoice = async (channelId: string) => {
  try {
    const voicePath = getVoicePath(channelId);
    const voiceS3Stream = await downloadFileFromS3(voicePath);
    const savedVoiceJsonString: string = await readJsonStreamToString(voiceS3Stream);
    Object.assign(currentVoice, JSON.parse(savedVoiceJsonString));
    // await loadFakeYouTTSModelIfRequired();
    console.log(`Current TTS voice for channel: ${channelId} is: ${currentVoice.name}`);
  } catch (error) {
    console.error("Error loading voice from storage, will load default: ", error);
    await setCurrentVoice(voices[0], channelId);
  }
};

// const loadFakeYouTTSModelIfRequired = async () => {
//   if (isCurrentVoiceLanguage("English") && !checkIfGoogleAPIisUsed()) {
//     currentVoice.ttsModel = await loadTTSModel(currentVoice.name!);
//   }
// };

export const botTTSVoiceChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!voice ";
  if (!message.startsWith(command)) return false;
  let voiceName = message.replace(command, "");
  if (currentVoice.name !== getVoiceByName(voiceName)) {
    await setCurrentVoice(voiceName, channelId);
    await sendMessageToProperChannel(`You changed TTS voice to: **${currentVoice.name}**`, channelId);
  } else {
    await sendMessageToProperChannel(`You already use TTS voice: **${currentVoice.name}**`, channelId);
  }
  return true;
};

export const setCurrentVoice = async (voiceName: string | null, channelId: string): Promise<void> => {
  let ttsModel;
  try {
    await assignVoiceNameAndDefaults(voiceName, channelId);
    ttsModel = currentVoice.ttsModel;
    delete currentVoice.ttsModel;
    const voicePath = getVoicePath(channelId);
    const currentVoiceJson = JSON.stringify(currentVoice);
    await uploadFileToS3(voicePath, currentVoiceJson);
    console.log(`Successfully saved current TTS voice for channel: ${channelId} to: ${currentVoice.name}`);
  } catch (error) {
    console.error(`Error setting current TTS voice or channel: ${channelId}:`, error);
  } finally {
    currentVoice.ttsModel = ttsModel;
  }
};

const assignVoiceNameAndDefaults = async (voiceName: string | null, channelId: string): Promise<void> => {
  if (isCurrentVoiceLanguage("English")) {
    if (voiceName === null) voiceName = DEFAULT_ENGLISH_VOICE;
    currentVoice.name = getVoiceByName(voiceName);
    await setWaitingAndDefaultEnglishAnswer(channelId);
  } else {
    setWaitingAndDefaultSerbianAnswer();
  }
};

const setWaitingAndDefaultSerbianAnswer = (): void => {
  currentVoice.defaultAnswer = generateTTSResourceURL("Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.");
  currentVoice.waitingAnswer = generateTTSResourceURL("Vaš odgovor se generiše, molimo vas sačekajte.");
};

const setWaitingAndDefaultEnglishAnswer = async (channelId: string): Promise<void> => {
  if (checkIfGoogleAPIisUsed()) {
    currentVoice.defaultAnswer = generateTTSResourceURL(defaultAnswer);
    currentVoice.waitingAnswer = generateTTSResourceURL(waitingAnswer);
  } else {
    // Loading one of the DeepFake voices to use instead of Google TTS API
    // const fakeYouVoice = await loadFakeYouVoice(currentVoice.name!, defaultAnswer, waitingAnswer, channelId);
    // currentVoice.defaultAnswer = fakeYouVoice.defaultAnswer;
    // currentVoice.waitingAnswer = fakeYouVoice.waitingAnswer;
  }
};

export const getVoiceByName = (voiceName: string): string => {
  let voice = voices.find((voice) => voice.toLowerCase().startsWith(voiceName.toLowerCase()));
  return voice ? voice : voices[0];
};

export const checkIfGoogleAPIisUsed = () => currentVoice.name!.toLocaleLowerCase().startsWith(DEFAULT_ENGLISH_VOICE.toLocaleLowerCase());

const getVoicePath = (channelId: string): string => `voices/${channelId}-voice.json`;
