import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";
import { opusStreamToFlacBase64 } from "./stream-util.js";
import { AudioReceiveStream } from "@discordjs/voice";

export const createFlacAudioContentFromOpus = async (opusStream: AudioReceiveStream): Promise<string> => {
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
    console.error("Error converting to .flac audio stream: ", error);
    throw error;
  }
};
