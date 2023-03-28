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
      languageCode: "en-US",
      enableSeparateRecognitionPerChannel: true,
    },
  };

  const [response] = await speechToTextClient.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Google Speech to Text transcription: "${transcription}"`);
  return transcription;
};
