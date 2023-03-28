import { createWriteStream, readFileSync, unlink } from "node:fs";
import { Transform } from "node:stream";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { StreamEncoder } from "flac-bindings";
import opus from "@discordjs/opus";
import path from "path";

export const createFlacAudioFileForProcessing = async (connection, opusStream, userId) => {
  const flacFilePath = path.join("./recordings", `${userId}.flac`);
  const encoder = new opus.OpusEncoder(48000, 2);
  const outputStream = createWriteStream(flacFilePath);
  opusStream
    .pipe(new OpusDecodingStream({}, encoder)) // First we decode opus packets streaming from voice channel
    .pipe(getFlacEncoder()) // encoded packets are then encoded to .flac
    .pipe(outputStream); // and piped into the output file
  outputStream.on("finish", async () => {
    console.log(`Temp audio file: ${flacFilePath} created for processing google STT transcript!`);
    await readFlacAudioFileAndPlayAnswer(connection, flacFilePath);
  });
};

const readFlacAudioFileAndPlayAnswer = async (connection, flacFilePath) => {
  const flacAudioFile = readFileSync(flacFilePath);
  await playOpenAiAnswerAfterSpeech(connection, flacAudioFile.toString("base64"));
};

const getFlacEncoder = () => {
  // // Create a new FLAC encoder instance
  return new StreamEncoder({
    compressionLevel: 5, // Set the compression level (0-8)
    totalSamples: -1, // Set the total number of samples (-1 for unknown)
    bitsPerSample: 16, // Set the number of bits per sample
    sampleRate: 48000, // Set the sample rate
    channels: 2, // Set the number of channels
    verify: false, // Disable verification
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
