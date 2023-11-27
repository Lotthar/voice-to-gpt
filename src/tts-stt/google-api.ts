import * as googleTTS from "google-tts-api";
import { SpeechClient } from "@google-cloud/speech";
import { IRecognizeRequest, IRecognizeResponse, ISpeechRecognitionResult, AudioEncoding } from "../types/google.js";
import { LongTTSOption } from "../interfaces/google.js";
import dotenv from "dotenv";

dotenv.config();

const speechToTextClient: SpeechClient = new SpeechClient({
  projectId: process.env.GCLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GCLOUD_CLIENT_EMAIL,
    private_key: process.env.GCLOUD_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});

export const processAudioContentIntoText = async (audioDataBase64: string, sttLang: string): Promise<string | null> => {
  console.log(sttLang);
  const request: IRecognizeRequest = {
    audio: {
      content: audioDataBase64,
    },
    config: {
      encoding: AudioEncoding.FLAC,
      sampleRateHertz: 48000,
      audioChannelCount: 2,
      languageCode: sttLang,
      enableSeparateRecognitionPerChannel: true,
    },
  };
  return await callGoogleSpeechApi(request);
};

const callGoogleSpeechApi = async (request: IRecognizeRequest): Promise<string | null> => {
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

export const generateTTSResourceURIArray = (text: string, ttsLang: string): string[] => {
  console.log(ttsLang);
  const ttsResourceLink = googleTTS.getAllAudioUrls(text, getTTSRequestOpts(ttsLang));
  return ttsResourceLink.map((resource) => resource.url);
};

export const generateTTSResourceURL = (text: string, ttsLang: string): string => {
  return googleTTS.getAudioUrl(text, getTTSRequestOpts(ttsLang));
};

const getTTSRequestOpts = (ttsLang: string): LongTTSOption => {
  return {
    lang: ttsLang,
    slow: false,
    host: "https://translate.google.com",
    splitPunct: ",.?",
  };
};

const extractTranscriptionFromResponse = (apiResponse: IRecognizeResponse): string => {
  return [
    ...new Set(
      apiResponse.results
        ?.filter((result: ISpeechRecognitionResult) => result.alternatives !== null && result.alternatives !== undefined)
        .map((result: ISpeechRecognitionResult) => result.alternatives![0].transcript?.trim())
    ),
  ].join("\n");
};
