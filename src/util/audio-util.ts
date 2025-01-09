// import opus from "@discordjs/opus";
import { convertOpusStreamToWavBuffer } from "./stream-util.js";
import { AudioReceiveStream } from "@discordjs/voice";
import wav from "wav";

// export const createWavAudioBufferFromOpus = async (opusStream: AudioReceiveStream, channelId: string): Promise<Buffer> => {
//   const opusEncoder = new opus.OpusEncoder(48000, 2);
//   const wavEncoder = new wav.Writer({
//     channels: 2,
//     sampleRate: 48000,
//     bitDepth: 16,
//   });
//   try {
//     return await convertOpusStreamToWavBuffer(opusStream, opusEncoder, wavEncoder);
//   } catch (error) {
//     console.error(`Error converting to .flac audio stream for channel: ${channelId}: `, error);
//     throw error;
//   }
// };
