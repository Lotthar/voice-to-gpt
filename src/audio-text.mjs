import fs from "node:fs";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import { sendMessageToProperChannel } from "./util.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";

export const playOpenAiAnswerAfterSpeech = async (connection, audioContent, audioToSpeechClbc) => {
  const transcript = await audioToSpeechClbc(audioContent);
  const answer = await generateOpenAIAnswer(transcript);
  playAudioResourceFromText(connection, answer);
};

const playAudioResourceFromText = (connection, text) => {
  const resourceLink = `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(
    text
  )}&tl=en&total=1&idx=0&textlen=${text.length}`;
  const resource = createAudioResource(resourceLink);
  const player = createAndSubscribeAudioPlayer(connection);
  player.play(resource);
};

const createAndSubscribeAudioPlayer = (connection) => {
  const player = createAudioPlayer();
  player.on("error", (error) => {
    console.error("Error:", error.message, "with track", error.resource.metadata.title);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("The audio player has started playing!");
  });
  connection.subscribe(player);
  return player;
};
