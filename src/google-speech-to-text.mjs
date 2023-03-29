import { SpeechClient } from "@google-cloud/speech";

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new SpeechClient({
  projectId: "voicetogpt",
  keyFilename: "./gcloud_keyfile.json",
});

export const processAudioContentIntoText = async (speechAudioBase64) => {
  const request = {
    audio: {
      content: speechAudioBase64,
    },
    config: {
      encoding: "FLAC",
      sampleRateHertz: 48000,
      audioChannelCount: 2,
      languageCode: "sr-RS",
      enableSeparateRecognitionPerChannel: true,
    },
  };
  return await callGoogleSpeechApi(request);
};

const callGoogleSpeechApi = async (request) => {
  let transcription = "";
  try {
    const [response] = await speechToTextClient.recognize(request);
    transcription = response.results.map((result) => result.alternatives[0].transcript).join("\n");
    console.log(`Google Speech to Text transcription: "${transcription}"`);
  } catch (error) {
    console.log(error);
  } finally {
    return transcription;
  }
};
