import { fs } from "node:fs";
import { SpeechClient } from "@google-cloud/speech";
import tts from "google-tts-api";

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new SpeechClient();

export const processAudioStreamIntoText = async (audioBytes) => {
  const audio = {
    content: audioBytes,
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
  return response.results.map((result) => result.alternatives[0].transcript).join("\n");
};

const speakAnswer = async (answer) => {
  const url = await tts(answer, "en-US");
  dispatcher.on("start", () => {
    console.log("Playing audio");
  });
  dispatcher.on("finish", () => {
    console.log("Finished playing audio");
  });
  const dispatcher = connection.play(url);
};
