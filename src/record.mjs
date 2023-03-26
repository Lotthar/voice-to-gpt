import prism from "prism-media";
import { EndBehaviorType } from "@discordjs/voice";
import { StreamEncoder } from "flac-bindings";
import { pipeline } from "node:stream";
import { createWriteStream, createReadStream } from "node:fs";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { processAudioStreamIntoText } from "./google-speech-to-text.mjs";
import path from "path";
import pkg from "@discordjs/opus";
const { OpusEncoder } = pkg;

let isCurrentlyProcessing = false;

export const createOggFileForProcessing = async (connection, userId) => {
  const oggFilePath = path.join("./recordings", `${userId}.ogg`);
  if (isCurrentlyProcessing) return;
  isCurrentlyProcessing = true;
  const opusStream = getOpusStream(connection, userId);
  // const oggStream = getOggStream();
  const flacFilePath = path.join("./recordings", `test.flac`);

  const flacFile = opusStream
    // TODO: Swap decoder with any other possible NE RADI PRSIM ENCODER/DECODER na novim OPUS fajlovima
    //  izgleda da je problem velicina buffer-a
    // Probati OpusDecored iz discord opus paketa
    .pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }))
    .pipe(getFlacEncoder())
    .pipe(createWriteStream(flacFilePath));
  flacFile.on("finish", () => {
    console.log("Successfully created .flac audio file!");
    readFlacFileAndPlayAnswer(connection, flacFilePath);
  });
};

const pipelineOpusStreamIntoFile = (connection, opusStream, oggStream, oggFilePath) => {
  const outputStream = createWriteStream(oggFilePath);
  pipeline(opusStream, oggStream, outputStream, async (error) => {
    if (error) {
      console.warn(`Error recording file ${oggFilePath} - ${error.message}`);
    } else {
      console.log(`Recorded ${oggFilePath}`);
      isCurrentlyProcessing = false;
      readOpusFileAndPlayAnswer(connection, oggFilePath);
    }
  });
};

const readFlacFileAndPlayAnswer = async (connection, flacFilePath) => {
  const audioFile = path.join("./recordings", `test.flac`);
  await playOpenAiAnswerAfterSpeech(
    connection,
    audioFile.toString("base64"),
    processAudioStreamIntoText
  );
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

/**
 *  A Readable object mode stream of Opus packets
    Will end when the voice connection is destroyed, or the user has not said anything for 500ms
 * @param {*} connection - voice channel connection object
 */
const getOpusStream = (connection, userId) => {
  return connection.receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 500,
    },
  });
};

const getOggStream = () => {
  return new prism.opus.OggLogicalBitstream({
    opusHead: new prism.opus.OpusHead({
      channelCount: 2,
      sampleRate: 48000,
    }),
    pageSizeControl: {
      maxPackets: 10,
    },
    crc: false,
  });
};
