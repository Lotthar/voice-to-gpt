import { SpeechClient } from "@google-cloud/speech";
import * as googleTTS from "google-tts-api";
import { currentVoiceLanguage } from "./lang-util.mjs";
import dotenv from "dotenv";

dotenv.config();

const speechToTextClient = new SpeechClient({
  projectId: process.env.STT_API_PROJECT_ID,
  keyFilename: "./gcloud_keyfile.json",
});

export const processAudioContentIntoText = async (audioDataBase64) => {
  const request = {
    audio: {
      content: audioDataBase64,
    },
    config: {
      encoding: "FLAC",
      sampleRateHertz: 48000,
      audioChannelCount: 2,
      languageCode: currentVoiceLanguage.sttCode,
      enableSeparateRecognitionPerChannel: true,
    },
  };
  return await callGoogleSpeechApi(request);
};

const callGoogleSpeechApi = async (request) => {
  try {
    const [response] = await speechToTextClient.recognize(request);
    let transcription = extractTranscriptionFromResponse(response);
    console.log(`Google Speech to Text transcription: "${transcription}"`);
    return transcription;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const generateTTSResourceURIArray = (text) => {
  const ttsResourceLink = googleTTS.getAllAudioUrls(text, {
    lang: currentVoiceLanguage.ttsCode,
    slow: false,
    host: "https://translate.google.com",
    splitPunct: ",.?",
  });
  return ttsResourceLink.map((resource) => resource.url);
};

const extractTranscriptionFromResponse = (apiResponse) => {
  return [
    ...new Set(apiResponse.results.map((result) => result.alternatives[0].transcript.trim())),
  ].join("\n");
};
