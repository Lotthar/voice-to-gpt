import { generateOpenAIAnswer } from "./openai-api.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.js";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus, AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { createTTSAudioURL } from "./fy-tts-api.js";
import { currentVoice } from "./interfaces/voice.js";
import { isCurrentVoiceLanguage } from "./lang-util.js";
import { checkIfGoogleAPIisUsed } from "./voice-util.js";
import { currentChannelId } from "./bot.js";

let player: AudioPlayer | null = null;
let currentAnswerAudioURIs: string[] = [];

export const playOpenAiAnswerAfterSpeech = async (connection: VoiceConnection, audioContent: string) => {
  initPlayerAndPlayWaitingMessage(connection);
  const transcript = await processAudioContentIntoText(audioContent);
  const openAiAnswer = await generateOpenAIAnswer(transcript!);
  await processAudioFromTextMultiLang(openAiAnswer);
};

const initPlayerAndPlayWaitingMessage = (connection: VoiceConnection): void => {
  if (player === null) initAndSubscribeAudioPlayerToVoiceChannel(connection);
  connection.subscribe(player!);
  if (currentVoice.waitingAnswer === null) return;
  player!.play(createAudioResource(currentVoice.waitingAnswer));
};

const initAndSubscribeAudioPlayerToVoiceChannel = (connection: VoiceConnection): void => {
  player = createAudioPlayer();
  addOnIdlePlayerEvent();
  addOnAutoPausePlayerEvent();
  addOnErrorPlayerEvent();
};

const processAudioFromTextMultiLang = async (text: string | null): Promise<void> => {
  if (text !== null) {
    if (isCurrentVoiceLanguage("English")) await getAudioResourceFromTextEngLang(text);
    else currentAnswerAudioURIs = generateTTSResourceURIArray(text);
    await sendMessageToProperChannel(text);
    player!.play(createAudioResource(getFirstAudioFromCurrent()));
  }
};

const getAudioResourceFromTextEngLang = async (text: string) => {
  if (checkIfGoogleAPIisUsed()) {
    currentAnswerAudioURIs = generateTTSResourceURIArray(text);
  } else {
    await loadAnswersFromFakeYouAPI(text);
  }
};

const loadAnswersFromFakeYouAPI = async (text: string) => {
  let audioUrl: string | null = null;
  const textParts = splitText(text);
  for (let txtPart of textParts) {
    audioUrl = await createTTSAudioURL(txtPart);
    if (audioUrl !== null) currentAnswerAudioURIs.push(audioUrl);
  }
};

const getFirstAudioFromCurrent = (): string => {
  const noAudioURIs = currentAnswerAudioURIs.length === 0;
  if (noAudioURIs) currentAnswerAudioURIs.push(currentVoice.defaultAnswer!);
  const firstQueuedAudio = currentAnswerAudioURIs.shift();
  return !!firstQueuedAudio ? firstQueuedAudio : currentVoice.defaultAnswer!;
};

const addOnIdlePlayerEvent = (): void => {
  player!.on(AudioPlayerStatus.Idle, () => {
    if (currentAnswerAudioURIs.length > 0) {
      const firstQueuedAudio = currentAnswerAudioURIs.shift();
      player!.play(createAudioResource(firstQueuedAudio ? firstQueuedAudio : currentVoice.defaultAnswer!));
    }
  });
};

const addOnAutoPausePlayerEvent = (): void => {
  player!.on(AudioPlayerStatus.AutoPaused, () => {
    console.log(`Discord voice player AutoPaused for channel ${currentChannelId}`);
  });
};

const addOnErrorPlayerEvent = (): void => {
  player!.on("error", (error: any) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};

const splitText = (text: string, maxLength = 550): string[] => {
  const chunks: string[] = [];
  let startIndex: number = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxLength, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex;
  }

  return chunks;
};
