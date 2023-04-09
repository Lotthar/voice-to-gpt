import { generateOpenAIAnswer } from "./openai-api.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { processAudioContentIntoText } from "./google-api.mjs";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus } from "@discordjs/voice";
import { createTTSAudioURL } from "./fy-tts-api.mjs";
import { currentVoiceLanguage, isCurrentVoiceLanguage } from "./lang-util.mjs";
import { generateTTSResourceURIArray } from "./google-api.mjs";

let player = null;
let currentAnswerAudioURIs = [];

export const playOpenAiAnswerAfterSpeech = async (connection, audioContent) => {
  const transcript = await processAudioContentIntoText(audioContent);
  const openAiAnswer = await generateOpenAIAnswer(transcript);
  await processAudioFromTextMultiLang(connection, openAiAnswer);
};

const processAudioFromTextMultiLang = async (connection, text) => {
  let audioResource = null;
  if (player === null) initAndSubscribeAudioPlayerToVoiceChannel(connection, text);
  if (isCurrentVoiceLanguage("English")) {
    audioResource = await getAudioResourceFromTextEngLang(text);
  } else {
    audioResource = getAudioResourceFromTextOtherLang(text);
  }
  player.play(createAudioResource(audioResource));
  await sendMessageToProperChannel(text);
};

const getAudioResourceFromTextEngLang = async (text) => {
  let audioUrl = null;
  const textParts = splitText(text);
  for (let txtPart of textParts) {
    audioUrl = await createTTSAudioURL(txtPart);
    if (audioUrl !== null) currentAnswerAudioURIs.push(audioUrl);
  }
  const noAudioURIs = currentAnswerAudioURIs.length === 0;
  if (noAudioURIs) currentAnswerAudioURIs.push(currentVoiceLanguage.defaultAnswer);
  return currentAnswerAudioURIs.shift();
};

const getAudioResourceFromTextOtherLang = (text) => {
  currentAnswerAudioURIs = generateTTSResourceURIArray(text);
  const noAudioURIs = currentAnswerAudioURIs.length === 0;
  if (noAudioURIs) currentAnswerAudioURIs.push(currentVoiceLanguage.defaultAnswer);
  return currentAnswerAudioURIs.shift();
};

const initAndSubscribeAudioPlayerToVoiceChannel = (connection) => {
  player = createAudioPlayer();
  addOnIdlePlayerEvent();
  addOnErrorPlayerEvent();
  connection.subscribe(player);
};

const addOnIdlePlayerEvent = () => {
  player.on(AudioPlayerStatus.Idle, async () => {
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

const splitText = (text, maxLength = 1000) => {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxLength, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex;
  }

  return chunks;
};
