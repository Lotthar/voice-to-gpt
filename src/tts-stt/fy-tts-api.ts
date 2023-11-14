import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const FakeYou = requireModule("fakeyou.js");
import dotenv from "dotenv";
import { DEFAULT_ENGLISH_VOICE, SpeechVoice, currentVoice } from "../interfaces/voice.js";

dotenv.config();

const fyClient = new FakeYou.Client({
  usernameOrEmail: process.env.FY_USERNAME,
  password: process.env.FY_PASSWORD,
});
await fyClient.start();

export const loadFakeYouVoice = async (voiceName: string, defaultAnswer: string, waitingAnswer: string, channelId: string) => {
  currentVoice.ttsModel = await loadTTSModel(voiceName);
  let fakeYouVoice = await createDefaultAndWaitingAnswers(voiceName, defaultAnswer, waitingAnswer, channelId);
  if (fakeYouVoice === null) fakeYouVoice = { name: DEFAULT_ENGLISH_VOICE, defaultAnswer: "", waitingAnswer: "" };
  console.log(`Using FakeYou voice: ${fakeYouVoice.name}, for English language in channel: ${channelId}`);
  return fakeYouVoice;
};

const createDefaultAndWaitingAnswers = async (
  voiceName: string,
  defaultAnswer: string,
  waitingAnswer: string,
  channelId: string
): Promise<SpeechVoice | null> => {
  try {
    const [defAnswer, waitAnswer] = await Promise.all([createTTSAudioURL(defaultAnswer, channelId), createTTSAudioURL(waitingAnswer, channelId)]);
    return { name: voiceName, defaultAnswer: defAnswer, waitingAnswer: waitAnswer };
  } catch (error) {
    console.error(`Error loading default and waiting answer for FakeYou voice in channel: ${channelId}: `, error);
    return null;
  }
};

export const loadTTSModel = async (voiceName: string) => {
  const ttsModel = await fyClient.searchModel(voiceName).first();
  return ttsModel;
};

export const createTTSAudioURL = async (text: string, channelId: string): Promise<string | null> => {
  try {
    if (!currentVoice.ttsModel) return null;
    const result = await currentVoice.ttsModel.request(text);
    return result.audioURL();
  } catch (error) {
    console.error(`Error creating TTS with FakeYou API in channel: ${channelId}: `, error);
    return null;
  }
};
