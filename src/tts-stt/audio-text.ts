import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { sendMessageToProperChannel } from "../util/discord-util.js";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.js";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus, AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { currentVoice } from "../interfaces/voice.js";

let player: AudioPlayer | null = null;
let currentAnswerAudioURIs: string[] = [];

export const playOpenAiAnswerAfterSpeech = async (audioContent: string, connection: VoiceConnection, channelId: string) => {
  initPlayerAndPlayWaitingMessage(connection);
  const transcript = await processAudioContentIntoText(audioContent);
  const openAiAnswer = await generateOpenAIAnswer(transcript!, channelId);
  await processAudioFromText(openAiAnswer, channelId);
};

const initPlayerAndPlayWaitingMessage = (connection: VoiceConnection): void => {
  if(player === null) initAndSubscribeAudioPlayerToVoiceChannel();
  currentAnswerAudioURIs = [];
  connection.subscribe(player!);
  if (currentVoice.waitingAnswer === null) return;
  console.log(currentVoice.waitingAnswer);
  player!.play(createAudioResource(currentVoice.waitingAnswer, {inlineVolume: true}));
};

const initAndSubscribeAudioPlayerToVoiceChannel = (): void => {
  player = createAudioPlayer();
  addOnIdlePlayerEvent();
  addOnErrorPlayerEvent();
  console.log(player)
};

const processAudioFromText = async (text: string | null, channelId: string): Promise<void> => {
  if (text !== null) {
    currentAnswerAudioURIs = generateTTSResourceURIArray(text);
    await sendMessageToProperChannel(text, channelId);
    const audio = getFirstAudioFromCurrent();
    player!.play(createAudioResource(audio, {inlineVolume: true}));
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
      player!.play(createAudioResource(firstQueuedAudio ? firstQueuedAudio : currentVoice.defaultAnswer!, {inlineVolume: true}));
    }
  });
};

const addOnErrorPlayerEvent = (): void => {
  player!.on("error", (error: any) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};