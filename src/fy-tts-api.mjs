import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const FakeYou = requireModule("fakeyou.js");
import dotenv from "dotenv";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { currentChannelId } from "./bot.mjs";
import { uploadFileToS3, downloadFileFromS3 } from "./aws-s3-util.mjs";
import { readJsonStream } from "./stream-util.mjs";
import { isCurrentVoiceLanguage } from "./lang-util.mjs";
import { generateTTSResourceURL } from "./google-api.mjs";

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

let ttsModel = null;
export let currentVoice = {
  name: null,
  waitingAnswer: null,
  defaultAnswer: null,
};

export const loadVoiceAndModelIfNone = async () => {
  try {
    if (currentVoice.name !== null) return;
    const voicePath = getVoicePath();
    const voiceS3Stream = await downloadFileFromS3(voicePath);
    const savedVoice = await readJsonStream(voiceS3Stream);
    Object.assign(currentVoice, savedVoice);
    ttsModel = fyClient.searchModel(currentVoice.name).first();
    await setWaitingAndDefaultAnswer();
    console.log(`Current TTS voice is: ${currentVoice.name}`);
  } catch (error) {
    console.error("No current TTS voice from s3, setting default...");
    await setCurrentVoice(voices[0]);
  }
};

export const createTTSAudioURL = async (text) => {
  try {
    if (!ttsModel) return null;
    const result = await ttsModel.request(text);
    return result.audioURL();
  } catch (error) {
    console.error("Error creating TTS with FakeYou API: ", error);
    return null;
  }
};

export const resetVoiceModelIfChanged = async (voiceName) => {
  if (currentVoice.name !== getVoiceByName(voiceName)) {
    await setCurrentVoice(voiceName);
    console.log(`TTS Voice has been changed. New voice: ${currentVoice.name}`);
  }
};

const setCurrentVoice = async (voiceName) => {
  try {
    await assingModelAndVoice(voiceName);
    const voicePath = getVoicePath();
    const currentVoiceJson = JSON.stringify(currentVoice, null, 2);
    await uploadFileToS3(voicePath, currentVoiceJson);
  } catch (error) {
    console.error("Error setting current TTS voice:", error);
    return null;
  }
};

const assingModelAndVoice = async (voiceName) => {
  currentVoice.name = getVoiceByName(voiceName);
  ttsModel = fyClient.searchModel(currentVoice.name).first();
  await setWaitingAndDefaultAnswer();
};

const setWaitingAndDefaultAnswer = async () => {
  if (isCurrentVoiceLanguage("English")) {
    currentVoice.defaultAnswer = await createTTSAudioURL(
      "Your question was not understood or heard properly, please repeat."
    );
    currentVoice.waitingAnswer = await createTTSAudioURL("Answer is prepared, please wait.");
  } else {
    currentVoice.defaultAnswer = generateTTSResourceURL(
      "Vase pitanje nije razumljivo ili se ne cuje, molimo vas ponovite."
    );
    currentVoice.waitingAnswer = generateTTSResourceURL("Odgovor se generise, molimo sacekajte.");
  }
};

export const botTTSVoiceChanged = async (message) => {
  const command = "!voice ";
  if (!message.startsWith(command)) return false;
  let voiceName = message.replace(command, "");
  await resetVoiceModelIfChanged(voiceName);
  await sendMessageToProperChannel(`You changed TTS voice to: **${currentVoice.name}**`);
  return true;
};

const getVoiceByName = (voiceName) => {
  let voice = voices.find((voice) => voice.toLowerCase().startsWith(voiceName.toLowerCase()));
  return voice ? voice : voices[0];
};

const getVoicePath = () => `voices/${currentChannelId}-voice`;
