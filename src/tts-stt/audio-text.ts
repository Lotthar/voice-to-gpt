import { currentVoiceLanguage } from "../interfaces/language.js";
import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { sendMessageToProperChannel } from "../util/discord-util.js";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.js";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus, AudioPlayer, VoiceConnection, PlayerSubscription } from "@discordjs/voice";

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
  const subscribe = connection.subscribe(player!);
  currentAnswerAudioURIs = [];
  if (currentVoiceLanguage.waitingAnswer === null) return;
  player!.play(createAudioResource(currentVoiceLanguage.waitingAnswer));
  subscribe?.unsubscribe();
};

const initAndSubscribeAudioPlayerToVoiceChannel = (): void => {
  player = createAudioPlayer();
  addOnIdlePlayerEvent();
  addOnErrorPlayerEvent();
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
  if (noAudioURIs) currentAnswerAudioURIs.push(currentVoiceLanguage.defaultAnswer!);
  const firstQueuedAudio = currentAnswerAudioURIs.shift();
  return !!firstQueuedAudio ? firstQueuedAudio : currentVoiceLanguage.defaultAnswer!;
};

const addOnIdlePlayerEvent = (): void => {
  player!.on(AudioPlayerStatus.Idle, () => {
    if (currentAnswerAudioURIs.length > 0) {
      const firstQueuedAudio = currentAnswerAudioURIs.shift();
      player!.play(createAudioResource(firstQueuedAudio ? firstQueuedAudio : currentVoiceLanguage.defaultAnswer!));
    }
  });
};

const addOnErrorPlayerEvent = (): void => {
  player!.on("error", (error: any) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};