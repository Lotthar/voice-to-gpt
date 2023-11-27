import { Language } from "../interfaces/language.js";
import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { sendMessageToProperChannel } from "../util/discord-util.js";
import { getCurrentVoiceLanguage } from "../util/lang-util.js";
import { processAudioContentIntoText, generateTTSResourceURIArray } from "./google-api.js";
import { createAudioResource, createAudioPlayer, AudioPlayerStatus, AudioPlayer, VoiceConnection, PlayerSubscription } from "@discordjs/voice";

let player: AudioPlayer | null = null;
let currentAnswerAudioURIs: string[] = [];

export const playOpenAiAnswerAfterSpeech = async (audioContent: string, connection: VoiceConnection, channelId: string) => {
  const currentVoiceLang = await getCurrentVoiceLanguage(channelId);
  initPlayerAndPlayWaitingMessage(connection, currentVoiceLang);
  const transcript = await processAudioContentIntoText(audioContent,currentVoiceLang.sttCode!);
  const openAiAnswer = await generateOpenAIAnswer(transcript!, channelId);
  await processAudioFromText(openAiAnswer,currentVoiceLang,  channelId);
};

const initPlayerAndPlayWaitingMessage = (connection: VoiceConnection, currentVoiceLang: Language): void => {
  if(player === null) initAndSubscribeAudioPlayerToVoiceChannel(currentVoiceLang);
  const subscribe = connection.subscribe(player!);
  currentAnswerAudioURIs = [];
  if (currentVoiceLang.waitingAnswer === null) return;
  player!.play(createAudioResource(currentVoiceLang.waitingAnswer));
};

const initAndSubscribeAudioPlayerToVoiceChannel = (currentVoiceLang: Language): void => {
  player = createAudioPlayer();
  addOnIdlePlayerEvent(currentVoiceLang);
  addOnErrorPlayerEvent();
  player.on(AudioPlayerStatus.Playing, () => {
    console.log('The audio player has started playing...');
  });
  
};

const processAudioFromText = async (text: string | null, currentVoiceLang: Language, channelId: string): Promise<void> => {
  if (text !== null) {
    currentAnswerAudioURIs = generateTTSResourceURIArray(text, currentVoiceLang.ttsCode!);
    await sendMessageToProperChannel(text, channelId);
    const audio = getFirstAudioFromCurrent(currentVoiceLang);
    player!.play(createAudioResource(audio));
  }
};

const getFirstAudioFromCurrent = (currentVoiceLang: Language,): string => {
  const noAudioURIs = currentAnswerAudioURIs.length === 0;
  if (noAudioURIs) currentAnswerAudioURIs.push(currentVoiceLang.defaultAnswer!);
  const firstQueuedAudio = currentAnswerAudioURIs.shift();
  return !!firstQueuedAudio ? firstQueuedAudio : currentVoiceLang.defaultAnswer!;
};


const addOnIdlePlayerEvent = (lang: Language): void => {
  player!.on(AudioPlayerStatus.Idle, () => {
    console.log('The audio player is IDLE!');
    if (currentAnswerAudioURIs.length > 0) {
      const firstQueuedAudio = currentAnswerAudioURIs.shift();
      player!.play(createAudioResource(firstQueuedAudio ? firstQueuedAudio : lang.defaultAnswer!));
    }
  });
};

const addOnErrorPlayerEvent = (): void => {
  player!.on("error", (error: any) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};