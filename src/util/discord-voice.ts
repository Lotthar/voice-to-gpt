import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { generateSpeechFromText, generateTextFromSpeech } from "../openai/openai-whisper-api.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { createAudioResource, createAudioPlayer, AudioPlayer, VoiceConnection, AudioPlayerStatus } from "@discordjs/voice";

let player: AudioPlayer | null = null;

export const playOpenAiAnswerWithSpeech= async (audioBuffer: Buffer, connection: VoiceConnection, channelId: string) => {
  initAndSubscribeAudioPlayerToVoiceChannel(connection);
  const transcript = await generateTextFromSpeech(audioBuffer, "wav");
  const openAiAnswer = await generateOpenAIAnswer(transcript!, channelId);
  await playSpeechAudioFromText(openAiAnswer, channelId);
};

const initAndSubscribeAudioPlayerToVoiceChannel = (connection: VoiceConnection): void => {
  if(player === null) {
    player = createAudioPlayer();
    connection.subscribe(player!);
    addOnErrorPlayerEvent();
  }
};

const playSpeechAudioFromText = async (text: string | null, channelId: string): Promise<void> => {
  if (text !== null) {
    const audio = await generateSpeechFromText(text);
    await sendMessageToProperChannel(text, channelId);
    player!.play(createAudioResource(audio));
  }
};

const addOnErrorPlayerEvent = (): void => {
  player!.on("error", (error: any) => {
    console.error("Error:", error.message, "with audio", error.resource.metadata.title);
  });
};