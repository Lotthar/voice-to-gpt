import { SpeechClient } from "@google-cloud/speech";
import * as googleTTS from "google-tts-api";
import { currentVoiceLanguage } from "./lang-util.mjs";
import dotenv from "dotenv";

dotenv.config();

const speechToTextClient = new SpeechClient({
  projectId: process.env.GCLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GCLOUD_CLIENT_EMAIL,
    private_key: process.env.GCLOUD_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
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
    console.error("Error calling google Speech-to-Text API: ", error);
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
