import prism from "prism-media";
import { EndBehaviorType } from "@discordjs/voice";
import { pipeline } from "node:stream";
import { createWriteStream, readFileSync } from "node:fs";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { processAudioStreamIntoText } from "./google-speech-to-text.mjs";
import path from "path";

let isCurrentlyProcessing = false;

export const createOggFileForProcessing = async (connection, userId) => {
  const oggFilePath = path.join("./recordings", `${userId}.ogg`);
  if (isCurrentlyProcessing) return;
  isCurrentlyProcessing = true;
  const opusStream = getOpusStream(connection, userId);
  const oggStream = getOggStream();
  pipelineOpusStreamIntoFile(connection, opusStream, oggStream, oggFilePath);
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

const readOpusFileAndPlayAnswer = async (connection, oggFilePath) => {
  // TODO: ovdje odraditi konverziju .ogg to .flac ako ke uopste moguce
  const flacFilePath = path.join("./recordings", `sample.flac`);
  const audioFile = readFileSync(flacFilePath);
  await playOpenAiAnswerAfterSpeech(
    connection,
    audioFile.toString("base64"),
    processAudioStreamIntoText
  );
};

/**
 * Getting raw audio from opus stream with prism Decoder
 *
 * @param {*} opusStream - given opus stream to process
 */
export const getOpusDecoder = (opusStream) => {
  return new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
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
