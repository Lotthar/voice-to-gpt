import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";
import { convertOpusStreamToWavBuffer, opusStreamToFlacBase64 } from "./stream-util.js";
import { AudioReceiveStream } from "@discordjs/voice";
import wav from "wav";


export const createFlacAudioContentFromOpus = async (opusStream: AudioReceiveStream, channelId: string): Promise<string> => {
  const opusEncoder = new opus.OpusEncoder(48000, 2);
  const flacEncoder = new StreamEncoder({
    compressionLevel: 5,
    bitsPerSample: 16,
    sampleRate: 48000,
    channels: 2,
  });
  try {
    return await opusStreamToFlacBase64(opusStream, opusEncoder, flacEncoder);
  } catch (error) {
    console.error(`Error converting to .flac audio stream for channel: ${channelId}: `, error);
    throw error;
  }
};

export const createWavAudioBufferFromOpus = async (opusStream: AudioReceiveStream, channelId: string): Promise<Buffer> => {
  const opusEncoder = new opus.OpusEncoder(48000, 2);
  const wavEncoder= new wav.Writer({
    channels: 2,
    sampleRate: 48000,
    bitDepth: 16,
  });
  try {
    return await convertOpusStreamToWavBuffer(opusStream,opusEncoder,wavEncoder);
  } catch (error) {
    console.error(`Error converting to .flac audio stream for channel: ${channelId}: `, error);
    throw error;
  }
};
