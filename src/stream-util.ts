import { OpusEncoder } from "@discordjs/opus";
import { AudioReceiveStream } from "@discordjs/voice";
import { StreamEncoder } from "flac-bindings";
import { Readable, TransformOptions } from "node:stream";
import { Transform, PassThrough, TransformCallback } from "node:stream";

export class OpusDecodingStream extends Transform {
  private _encoder: OpusEncoder;

  constructor(options: TransformOptions, encoder: OpusEncoder) {
    super(options);
    this._encoder = encoder;
  }

  _transform(data: Buffer, encoding: any, callback: TransformCallback) {
    this.push(this._encoder.decode(data));
    callback();
  }
}

export const opusStreamToFlacBase64 = async (
  opusStream: AudioReceiveStream,
  opusEncoder: OpusEncoder,
  flacEncoder: StreamEncoder
): Promise<string> => {
  const finalAudioDataStream = new PassThrough();
  return new Promise((resolve, reject) => {
    opusStream
      .pipe(new OpusDecodingStream({}, opusEncoder)) // First we decode opus packets streaming from voice channel
      .pipe(flacEncoder) // encoded packets are then encoded to .flac format
      .pipe(finalAudioDataStream); // encoded .flac data is piped into the output stream

    const audioDataChunks: Uint8Array[] = [];
    finalAudioDataStream
      .on("data", (chunk) => audioDataChunks.push(chunk))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(Buffer.concat(audioDataChunks).toString("base64")));
  });
};

export const readJsonStreamToString = async (stream: Readable): Promise<string> => {
  return new Promise((resolve, reject) => {
    let jsonString = "";
    stream
      .on("data", (chunk: string) => (jsonString += chunk.toString()))
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve(jsonString));
  });
};

export const readTextStreamToString = async (stream: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    let message = "";
    stream
      .on("data", (chunk: string) => (message += chunk.toString()))
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve(message));
  });
};
