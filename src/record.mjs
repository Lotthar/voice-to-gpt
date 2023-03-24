import prism from "prism-media";
import { EndBehaviorType } from "@discordjs/voice";
import { pipeline } from "node:stream";
import { createWriteStream } from "node:fs";
import path from "path";
import { convertOggFileToMp3 } from "./util.mjs";

let isCurrentlyProcessing = false;

export const createFileFromRawAudio = async (connection, userId, processAudioToSpeechClbc) => {
  const oggFilePath = path.join("./recordings", `${userId}.ogg`);
  const mp3FilePath = path.join("./recordings", `${userId}.mp3`);
  const outputStream = createWriteStream(oggFilePath);
  console.log(`Mp3 file path: ${mp3FilePath}`);
  if (isCurrentlyProcessing) return;
  const opusStream = getOpusStream(connection, userId);
  const oggStream = getOggStream();
  isCurrentlyProcessing = true;
  pipeline(opusStream, oggStream, outputStream, async (error) => {
    if (error) {
      console.warn(`Error recording file ${oggFilePath} - ${error.message}`);
    } else {
      console.log(`Recorded ${oggFilePath}`);
      convertOggFileToMp3(oggFilePath, mp3FilePath, onConvertToMp3);
    }
    isCurrentlyProcessing = false;
  });
};

const onConvertToMp3 = () => {
  console.log("Conversion from .ogg to .mp3 is complete!");
};

/**
 * Getting raw audio from opus stream with prism Decoder
 *
 * @param {*} opusStream - given opus stream to process
 */
export const getRawAudioResourceFromStream = (connection, userId) => {
  const opusStream = getOpusStream(connection, userId);
  return opusStream.pipe(new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 }));
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
