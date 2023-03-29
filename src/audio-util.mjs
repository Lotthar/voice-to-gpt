import { createWriteStream, readFileSync, unlink } from "node:fs";
import { Transform } from "node:stream";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";
import path from "path";

export const createFlacAudioFileForProcessing = async (connection, opusStream, userId) => {
  const flacFilePath = path.join("./recordings", `${userId}.flac`);
  const flacFileOutput = createWriteStream(flacFilePath);
  opusStream
    .pipe(new OpusDecodingStream({}, new opus.OpusEncoder(48000, 2))) // First we decode opus packets streaming from voice channel
    .pipe(getFlacEncoder()) // encoded packets are then encoded to .flac format
    .pipe(flacFileOutput); // encoded .flac data is piped into the output file

  flacFileOutput.on("finish", async () => {
    await readFlacAudioFileAndPlayAnswer(connection, flacFilePath);
  });
};

const readFlacAudioFileAndPlayAnswer = async (connection, flacFilePath) => {
  const flacAudioFile = readFileSync(flacFilePath);
  await playOpenAiAnswerAfterSpeech(connection, flacAudioFile.toString("base64"));
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
