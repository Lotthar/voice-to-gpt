import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const FakeYou = requireModule("fakeyou.js");
import dotenv from "dotenv";
import { DEFAULT_ENGLISH_VOICE, SpeechVoice } from "./interfaces/language.js";

dotenv.config();

const fyClient = new FakeYou.Client({
  usernameOrEmail: process.env.FY_USERNAME,
  password: process.env.FY_PASSWORD,
});
await fyClient.start();

let ttsModel: any = null;

export const loadFakeYouVoice = async (voiceName: string, defaultAnswer: string, waitingAnswer: string) => {
  await loadTTSModel(voiceName);
  let fakeYouVoice = await createDefaultAndWaitingAnswers(voiceName, defaultAnswer, waitingAnswer);
  if (fakeYouVoice === null) fakeYouVoice = { name: DEFAULT_ENGLISH_VOICE, defaultAnswer: "", waitingAnswer: "" };
  console.log(`Using FakeYou voice: ${fakeYouVoice.name}`);
  return fakeYouVoice;
};

const createDefaultAndWaitingAnswers = async (voiceName: string, defaultAnswer: string, waitingAnswer: string): Promise<SpeechVoice | null> => {
  try {
    const result = await Promise.all([createTTSAudioURL(defaultAnswer), createTTSAudioURL(waitingAnswer)]);
    return { name: voiceName, defaultAnswer: result[0], waitingAnswer: result[1] };
  } catch (error) {
    console.error("Error loading default and waiting answer for FakeYou voice: ", error);
    return null;
  }
};

const loadTTSModel = async (voiceName: string) => {
  ttsModel = fyClient.searchModel(voiceName).first();
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
