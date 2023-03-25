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
  const outputStream = createWriteStream(oggFilePath);
  if (isCurrentlyProcessing) return;
  const opusStream = getOpusStream(connection, userId);
  const oggStream = getOggStream();
  isCurrentlyProcessing = true;
  pipeline(opusStream, oggStream, outputStream, async (error) => {
    if (error) {
      console.warn(`Error recording file ${oggFilePath} - ${error.message}`);
    } else {
      console.log(`Recorded ${oggFilePath}`);
      const file = readFileSync(oggFilePath);
      await playOpenAiAnswerAfterSpeech(
        connection,
        file.toString("base64"),
        processAudioStreamIntoText
      );
      isCurrentlyProcessing = false;
    }
  });
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
    Will end when the voice connection is destroyed, or the user has not said anything for 100ms
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
    crc: false,
  });
};
