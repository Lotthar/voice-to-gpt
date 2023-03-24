import fs from "node:fs";
import { SpeechClient } from "@google-cloud/speech";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import { sendMessageToProperChannel } from "./util.mjs";

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new SpeechClient({
  projectId: "voicetogpt",
  keyFilename: "./gcloud_keyfile.json",
});

export const processAudioStreamIntoText = async (userId) => {
  const file = fs.readFileSync(`./recordings/${userId}.mp3`);
  const audio = {
    content: file.toString("base64"),
  };
  const config = {
    encoding: "PCM",
    sampleRateHertz: 48000,
    languageCode: "en-US",
  };
  const request = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [response] = await speechToTextClient.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Transcription: ${transcription}`);
  return transcription;
};

export const playAudioTranscriptionAfterOpenAi = async (userId, processAudioToSpeechClbc) => {
  const transcript = await processAudioToSpeechClbc(userId);
  const answer = generateOpenAIAnswer(transcript);
  console.log(`Answer after OpenAI: ${answer}`);
  connection.play(
    `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(
      answer
    )}&tl=en&total=1&idx=0&textlen=${answer.length}`
  );
};
