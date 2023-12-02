import axios from "axios";
import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { generateSpeechFromText, generateTextFromSpeech } from "../openai/openai-whisper-api.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { createAudioResource, createAudioPlayer, AudioPlayer, VoiceConnection, AudioPlayerStatus, StreamType, AudioResource } from "@discordjs/voice";
import { Readable } from "node:stream";
import { waitingAudioURI } from "../types/discord.js";

let player: AudioPlayer | null = null;
let waitingAudioResource: AudioResource<null> | undefined;

export const playOpenAiAnswerWithSpeech= async (audioBuffer: Buffer, connection: VoiceConnection, channelId: string) => {
  await initAndSubscribeAudioPlayerToVoiceChannel(connection);
  const transcript = await generateTextFromSpeech(audioBuffer, "wav");
  const openAiAnswer = await generateOpenAIAnswer(transcript!, channelId);
  await playSpeechAudioFromText(openAiAnswer, channelId);
};

const initAndSubscribeAudioPlayerToVoiceChannel = async (connection: VoiceConnection): Promise<void> => {
  if(player === null) {
    player = createAudioPlayer();
    connection.subscribe(player!);
    addOnErrorPlayerEvent();
  }
  await generateWaitingAudioResourceIfNone(); 
  if(!!waitingAudioResource) player!.play(waitingAudioResource);
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

const generateWaitingAudioResourceIfNone = async() => {
  if(!waitingAudioResource) {
    try {
      const { data } = await axios.get(waitingAudioURI, {
        responseType: 'arraybuffer',
        headers: {
            'Content-Type': 'audio/ogg'
        }
      });
      waitingAudioResource = createAudioResource(Readable.from(data));
    } catch(error) {
      console.error("Error creating waiting sound before the answer!", error);
    }
  }
}