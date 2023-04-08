import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const FakeYou = requireModule("fakeyou.js");
import dotenv from "dotenv";

dotenv.config();

const fyClient = new FakeYou.Client({
  usernameOrEmail: process.env.FY_USERNAME,
  password: process.env.FY_PASSWORD,
});
await fyClient.start();
const ttsModel = fyClient.searchModel("Morgan Freeman").first();

export const createTTSAudioURL = async (text) => {
  try {
    if (!ttsModel) return null;
    const result = await ttsModel.request(text);
    return result.audioURL();
  } catch (error) {
    console.error(`Error creating tts with voice of ${model.title}`);
    return null;
  }
};
