import { generateOpenAIAnswer } from "./openai-api.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";

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
