import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";
import { opusStreamToFlacBase64 } from "./stream-util.mjs";

export const createFlacAudioContentFromOpus = async (opusStream) => {
  const finalAudioDataStream = new PassThrough();
  const opusEncoder = new opus.OpusEncoder(48000, 2);
  const flacEncoder = new StreamEncoder({
    compressionLevel: 5,
    totalSamples: -1,
    bitsPerSample: 16,
    sampleRate: 48000,
    channels: 2,
    verify: false,
  });
  try {
    opusStream
      .pipe(new OpusDecodingStream({}, opusEncoder)) // First we decode opus packets streaming from voice channel
      .pipe(flacEncoder) // encoded packets are then encoded to .flac format
      .pipe(finalAudioDataStream); // encoded .flac data is piped into the output stream
    return await opusStreamToFlacBase64(opusStream, opusEncoder, flacEncoder);
  } catch (error) {
    console.error("Error converting to .flac audio stream: ", error);
    throw error;
  }
};
