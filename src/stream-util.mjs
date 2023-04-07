import { Transform, PassThrough } from "node:stream";

export class OpusDecodingStream extends Transform {
  constructor(options, encoder) {
    super(options);
    this.encoder = encoder;
  }

  _transform(data, encoding, callback) {
    this.push(this.encoder.decode(data));
    callback();
  }
}

export const opusStreamToFlacBase64 = (opusStream, opusEncoder, flacEncoder) => {
  const finalAudioDataStream = new PassThrough();
  return new Promise((resolve, reject) => {
    opusStream
      .pipe(new OpusDecodingStream({}, opusEncoder)) // First we decode opus packets streaming from voice channel
      .pipe(flacEncoder) // encoded packets are then encoded to .flac format
      .pipe(finalAudioDataStream); // encoded .flac data is piped into the output stream

    const audioDataChunks = [];
    finalAudioDataStream
      .on("data", (chunk) => audioDataChunks.push(chunk))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(Buffer.concat(audioDataChunks).toString("base64")));
  });
};

export const readJsonStream = async (stream) => {
  return new Promise((resolve, reject) => {
    let jsonString = "";
    stream
      .on("data", (chunk) => (jsonString += chunk.toString()))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(JSON.parse(jsonString)));
  });
};

export const readTextStream = async (stream) => {
  return new Promise((resolve, reject) => {
    let message = "";
    stream
      .on("data", (chunk) => (message += chunk.toString()))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(message));
  });
};
