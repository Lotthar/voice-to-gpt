import { generateOpenAIAnswer } from "./open-ai.mjs";
import { sendMessageToProperChannel } from "./voice-connection.mjs";
import { processAudioContentIntoText } from "./google-speech-to-text.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";
import * as googleTTS from "google-tts-api";

const DEFAULT_ANSWER_URI =
  "translate.google.com/translate_tts?ie=UTF-8&q=%0AHi%20there!%20How%20can%20I%20help%20you%3F&tl=en&total=1&idx=0&textlen=30&client=tw-ob&prev=input&ttsspeed=1";

const player = createAudioPlayer();
let currentAudioURIs = [];

export const playOpenAiAnswerAfterSpeech = async (connection, audioContent) => {
  const transcript = await processAudioContentIntoText(audioContent);
  const openAiAnswer = await generateOpenAIAnswer(transcript);
  await playAudioResourceFromText(connection, openAiAnswer);
};

const playAudioResourceFromText = async (connection, text) => {
  generateTTSResourceURIArray(text);
  if (currentAudioURIs.length === 0) currentAudioURIs.push(DEFAULT_ANSWER_URI);
  initAndSubscribeAudioPlayerToVoiceChannel(connection, text);
  player.play(createAudioResource(currentAudioURIs.shift()));
};

const initAndSubscribeAudioPlayerToVoiceChannel = (connection, text) => {
  addOnPlayingPlayerEvent(text);
  addOnIdlePlayerEvent();
  addOnErrorPlayerEvent();
  connection.subscribe(player);
};

const addOnPlayingPlayerEvent = (text) => {
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("The audio answer has started playing!");
    sendMessageToProperChannel(text);
  });
};

const addOnIdlePlayerEvent = () => {
  player.on(AudioPlayerStatus.Idle, () => {
    if (currentAudioURIs.length > 0) {
      console.log("Playing another part of the answer...");
      player.play(createAudioResource(currentAudioURIs.shift()));
    }
  });
};

const addOnErrorPlayerEvent = () => {
  player.on("error", (error) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};

const generateTTSResourceURIArray = async (text) => {
  const ttsResourceLink = googleTTS.getAllAudioUrls(text, {
    lang: "en",
    slow: false,
    host: "https://translate.google.com",
    splitPunct: ",.?",
  });
  currentAudioURIs = ttsResourceLink.map((resource) => resource.url);
};
