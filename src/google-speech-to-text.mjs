import { SpeechClient } from "@google-cloud/speech";

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new SpeechClient({
  projectId: "voicetogpt",
  keyFilename: "./gcloud_keyfile.json",
});

export const processAudioStreamIntoText = async (speechBase64Content) => {
  const request = {
    audio: {
      content: speechBase64Content,
    },
    config: {
      encoding: "OGG_OPUS",
      sampleRateHertz: 48000,
      audioChannelCount: 2,
      languageCode: "en-US",
    },
  };

  const [response] = await speechToTextClient.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Transcription: ${transcription}`);
  return transcription;
};
