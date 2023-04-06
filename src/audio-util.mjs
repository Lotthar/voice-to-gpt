import { PassThrough, Transform } from "node:stream";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";

export const createFlacAudioFileForProcessing = async (connection, opusStream) => {
  const finalAudioDataStream = new PassThrough();
  opusStream
    .pipe(new OpusDecodingStream({}, new opus.OpusEncoder(48000, 2))) // First we decode opus packets streaming from voice channel
    .pipe(getFlacEncoder()) // encoded packets are then encoded to .flac format
    .pipe(finalAudioDataStream); // encoded .flac data is piped into the output stream

  const audioDataChunks = [];
  finalAudioDataStream.on("data", (chunk) => {
    audioDataChunks.push(chunk);
  });

  // Handle the 'end' event
  finalAudioDataStream.on("end", async () => {
    const audioDataBuffer = Buffer.concat(audioDataChunks);
    await playOpenAiAnswerAfterSpeech(connection, audioDataBuffer.toString("base64"));
  });
};

const getFlacEncoder = () => {
  return new StreamEncoder({
    compressionLevel: 5,
    totalSamples: -1,
    bitsPerSample: 16,
    sampleRate: 48000,
    channels: 2,
    verify: false,
  });
};

class OpusDecodingStream extends Transform {
  constructor(options, encoder) {
    super(options);
    this.encoder = encoder;
  }

  _transform(data, encoding, callback) {
    this.push(this.encoder.decode(data));
    callback();
  }
}
