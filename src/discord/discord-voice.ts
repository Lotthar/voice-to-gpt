import axios from "axios";
import { generateOpenAIAnswer, generateOpenAIAnswerFromTranscript } from "../openai/openai-api.js";
import { generateSpeechFromText, generateTextFromSpeech } from "../openai/openai-whisper-api.js";
import { createAudioResource, createAudioPlayer, AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { Readable } from "node:stream";
import { waitingAudioURI } from "../types/discord.js";

let player: AudioPlayer | null = null;
let waitingAudioResource: any;

export const playOpenAiAnswerWithSpeech= async (audioBuffer: Buffer, connection: VoiceConnection, channelId: string) => {
  await initAndSubscribeAudioPlayerToVoiceChannel(connection);
  const transcript = await generateTextFromSpeech(audioBuffer, "wav");
  const openAiAnswer = await generateOpenAIAnswerFromTranscript(transcript!, channelId);
  await playSpeechAudioFromText(openAiAnswer);
};

const initAndSubscribeAudioPlayerToVoiceChannel = async (connection: VoiceConnection): Promise<void> => {
  if(player === null) {
    player = createAudioPlayer();
    addOnErrorPlayerEvent();
  }
  connection.subscribe(player!);
  await generateWaitingAudioResourceIfNone(); 
  if(!!waitingAudioResource) 
    player!.play(createAudioResource(Readable.from(waitingAudioResource)));
};

const playSpeechAudioFromText = async (text: string | null): Promise<void> => {
  if (text !== null) {
    const audio = await generateSpeechFromText(text);
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
      waitingAudioResource = data;
    } catch(error) {
      console.error("Error creating waiting sound before the answer!", error);
    }
  }
}