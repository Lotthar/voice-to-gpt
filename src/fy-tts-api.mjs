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

export const createTTSAudioURL = async (text) => {
  try {
    const ttsModel = fyClient.searchModel("Morgan Free").first();
    const result = await ttsModel.request(text);
    return result.audioURL();
  } catch (error) {
    console.error(`Error creating tts with voice of ${model.title}`);
    return null;
  }
};
