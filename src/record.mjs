import prism from "prism-media";
import { EndBehaviorType, VoiceReceiver, demuxProbe, createAudioResource } from "@discordjs/voice";
import { StreamEncoder } from "flac-bindings";
import { pipeline } from "node:stream";
import { createWriteStream, createReadStream } from "node:fs";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";
import { processAudioStreamIntoText } from "./google-speech-to-text.mjs";

import path from "path";

let isCurrentlyProcessing = false;

export const createOggFileForProcessing = async (opusStream, userId) => {
  const oggFilePath = path.join("./recordings", `test.ogg`);
  const oggOut = createWriteStream(oggFilePath);
  // const flacEncoder = getFlacEncoder();
  pipeline(opusStream, getOggStream(), oggOut, async (error) => {
    if (error) {
      console.warn(`Error recording file ${oggFilePath} - ${error.message}`);
    } else {
      console.log(`Recorded ${oggFilePath}`);
      const oggStream = await probeAndCreateResource(createReadStream(oggFilePath));
      console.log("breakpoint");
    }
  });
};

const probeAndCreateResource = async (readableStream) => {
  const { stream, type } = await demuxProbe(readableStream);
  return createAudioResource(stream, { inputType: type });
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
export const getOpusStream = (receiver, userId) => {
  return receiver.subscribe(userId, {
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
