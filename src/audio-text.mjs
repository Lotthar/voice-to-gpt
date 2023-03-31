import { generateOpenAIAnswer } from "./openai-api.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";

const DEFAULT_ANSWER_URI =
  "translate.google.com/translate_tts?ie=UTF-8&q=%0AHi%20there!%20How%20can%20I%20help%20you%3F&tl=en&total=1&idx=0&textlen=30&client=tw-ob&prev=input&ttsspeed=1";

const player = createAudioPlayer();
let currentAnswerAudioURIs = [];

export const playOpenAiAnswerAfterSpeech = async (connection, audioContent) => {
  const transcript = await processAudioContentIntoText(audioContent);
  const openAiAnswer = await generateOpenAIAnswer(transcript);
  await playAudioResourceFromText(connection, openAiAnswer);
};

const playAudioResourceFromText = async (connection, text) => {
  currentAnswerAudioURIs = generateTTSResourceURIArray(text);
  if (currentAnswerAudioURIs.length === 0) currentAnswerAudioURIs.push(DEFAULT_ANSWER_URI);
  initAndSubscribeAudioPlayerToVoiceChannel(connection, text);
  player.play(createAudioResource(currentAnswerAudioURIs.shift()));
};

const initAndSubscribeAudioPlayerToVoiceChannel = (connection, text) => {
  addOnIdlePlayerEvent();
  addOnErrorPlayerEvent();
  connection.subscribe(player);
  sendMessageToProperChannel(text);
};

const addOnIdlePlayerEvent = () => {
  player.on(AudioPlayerStatus.Idle, async () => {
    // Continuing to play until array of answer parts is empty
    if (currentAnswerAudioURIs.length > 0) {
      player.play(createAudioResource(currentAnswerAudioURIs.shift()));
    }
  });
};

const addOnErrorPlayerEvent = () => {
  player.on("error", (error) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};
