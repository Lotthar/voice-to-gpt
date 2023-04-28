import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const FakeYou = requireModule("fakeyou.js");
import dotenv from "dotenv";
import { sendMessageToProperChannel } from "./discord-util.js";
import { currentChannelId } from "./bot.js";
import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { isCurrentVoiceLanguage } from "./lang-util.js";
import { generateTTSResourceURL } from "./google-api.js";
import { SpeechVoice } from "./interfaces/voice.js";

dotenv.config();
const voices = [
  "Morgan Freeman",
  "Snoop Dogg (V2)",
  "Rick Sanchez",
  "Optimus Prime (Peter Cullen)",
  "Morty Smith",
  "The Joker (Heath Ledger, Version 2.0)",
  "Eminem (Slim Shady era - 1997 - 2001)",
  "James Earl Jones",
  "Sean Connery",
  "2Pac (Tupac Amaru Shakur) (ARPAbet supported)",
];

const fyClient = new FakeYou.Client({
  usernameOrEmail: process.env.FY_USERNAME,
  password: process.env.FY_PASSWORD,
});
await fyClient.start();

let ttsModel: any = null;
export let currentVoice: SpeechVoice = {
  name: null,
  waitingAnswer: null,
  defaultAnswer: null,
};

export const loadVoiceAndModelIfNone = async (): Promise<void> => {
  try {
    if (currentVoice.name !== null) return;
    const voicePath = getVoicePath();
    const voiceS3Stream = await downloadFileFromS3(voicePath);
    const savedVoice: string = await readJsonStreamToString(voiceS3Stream);
    Object.assign(currentVoice, JSON.parse(savedVoice));
    ttsModel = fyClient.searchModel(currentVoice.name).first();
    if (!currentVoice.defaultAnswer || !currentVoice.waitingAnswer) {
      await setWaitingAndDefaultAnswer();
    }
    console.log(`Current TTS voice is: ${currentVoice.name}`);
  } catch (error) {
    console.error("No current TTS voice from s3, setting default...");
    await setCurrentVoice(voices[0]);
  }
};

export const createTTSAudioURL = async (text: string): Promise<string | null> => {
  try {
    if (!ttsModel) return null;
    const result = await ttsModel.request(text);
    return result.audioURL();
  } catch (error) {
    console.error("Error creating TTS with FakeYou API: ", error);
    return null;
  }
};

export const resetVoiceModelIfChanged = async (voiceName: string): Promise<void> => {
  if (currentVoice.name !== getVoiceByName(voiceName)) {
    await setCurrentVoice(voiceName);
    console.log(`TTS Voice has been changed. New voice: ${currentVoice.name}`);
  }
};

export const setCurrentVoice = async (voiceName: string | null): Promise<void> => {
  try {
    await assingModelAndVoice(voiceName);
    const voicePath = getVoicePath();
    const currentVoiceJson = JSON.stringify(currentVoice);
    await uploadFileToS3(voicePath, currentVoiceJson);
  } catch (error) {
    console.error("Error setting current TTS voice:", error);
  }
};

const assingModelAndVoice = async (voiceName: string | null) => {
  if (voiceName !== null) {
    currentVoice.name = getVoiceByName(voiceName);
    ttsModel = fyClient.searchModel(currentVoice.name).first();
  }
  await setWaitingAndDefaultAnswer();
};

const setWaitingAndDefaultAnswer = async (): Promise<void> => {
  if (isCurrentVoiceLanguage("English")) {
    currentVoice.defaultAnswer = await createTTSAudioURL("Your question was not understood or heard properly, please repeat.");
    currentVoice.waitingAnswer = await createTTSAudioURL("Answer is prepared, please wait.");
  } else {
    currentVoice.defaultAnswer = generateTTSResourceURL("Vaše pitanje nije razumljivo ili se ne čuje, molimo vas ponovite.");
    currentVoice.waitingAnswer = generateTTSResourceURL("Vaš odgovor se generiše, molimo vas sačekajte.");
  }
};

export const botTTSVoiceChanged = async (message: string): Promise<boolean> => {
  const command = "!voice ";
  if (!message.startsWith(command)) return false;
  let voiceName = message.replace(command, "");
  await resetVoiceModelIfChanged(voiceName);
  await sendMessageToProperChannel(`You changed TTS voice to: **${currentVoice.name}**`);
  return true;
};

const getVoiceByName = (voiceName: string): string => {
  let voice = voices.find((voice) => voice.toLowerCase().startsWith(voiceName.toLowerCase()));
  return voice ? voice : voices[0];
};

const getVoicePath = (): string => `voices/${currentChannelId}-voice.json`;
