import { generateOpenAIAnswer } from "./open-ai.mjs";
import { sendMessageToProperChannel } from "./voice-connection.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";

export const playOpenAiAnswerAfterSpeech = async (connection, audioContent, audioToSpeechClbc) => {
  const transcript = await audioToSpeechClbc(audioContent);
  const answer = await generateOpenAIAnswer(transcript);
  playAudioResourceFromText(connection, answer);
};

const playAudioResourceFromText = (connection, openAiAnswer) => {
  const resourceLink = getURIForVoiceFromText(openAiAnswer);
  const resource = createAudioResource(resourceLink);
  const player = createAndSubscribeAudioPlayer(
    connection,
    openAiAnswer,
    sendMessageToProperChannel
  );
  player.play(resource);
};

const createAndSubscribeAudioPlayer = (connection, text, sendTextMsgClbc) => {
  const player = createAudioPlayer();
  player.on("error", (error) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
  player.on(AudioPlayerStatus.Playing, () => {
    console.log("The audio answer has started playing!");
    sendTextMsgClbc(text);
  });
  connection.subscribe(player);
  return player;
};

const getURIForVoiceFromText = (text) => {
  return `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(
    text
  )}&tl=en&total=1&idx=0&textlen=${text.length}`;
};
