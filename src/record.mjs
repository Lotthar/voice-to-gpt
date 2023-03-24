import { sendMessageToProperChannel } from "./util.mjs";
import prism from "prism-media";
import { EndBehaviorType } from "@discordjs/voice";
import { pipeline } from "node:stream";
import { createWriteStream } from "node:fs";

let isCurrentlyProcessing = false;

export const createFileFromRawAudio = (connection, userId) => {
  const filename = `./recordings/${userId}.ogg`;
  const out = createWriteStream(filename);
  if (isCurrentlyProcessing) return;
  const opusStream = getOpusStream(connection, userId);
  const oggStream = getOggStream();
  isCurrentlyProcessing = true;
  pipeline(opusStream, oggStream, out, (error) => {
    if (error) {
      console.warn(`Error recording file ${filename} - ${error.message}`);
    } else {
      console.log(`Recorded ${filename}`);
    }
    isCurrentlyProcessing = false;
  });
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
    pageSizeControl: {
      maxPackets: 10,
    },
    crc: false,
  });
};
