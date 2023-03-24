import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

export const deleteFile = (fileName) => {
  fs.unlink(fileName, (err) => {
    if (err) {
      console.error(`Failed to delete file: ${err}`);
    } else {
      console.log(`File ${fileName} deleted`);
    }
  });
};

export const convertOggFileToMp3 = (oggFilePath, mp3FilePath, onConvertClbc) => {
  // TODO: maybe change library for conversion .ogg file is working
  const ffm = ffmpeg();
  ffm.input(oggFilePath);
  ffm.audioChannels(2);
  ffm.audioCodec("libmp3lame");
  ffm
    .output(mp3FilePath)
    .on("end", () => onConvertClbc())
    .on("error", (err) => console.error(err))
    .run();
};

export const sendMessageToProperChannel = async (client, message, channelId) => {
  const channel = await client.channels.fetch(channelId);
  channel.send(message);
};
