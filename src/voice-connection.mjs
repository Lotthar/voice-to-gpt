import { ChannelType, VoiceChannel } from "discord.js";
import {
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  VoiceReceiver,
} from "@discordjs/voice";
import opus from "@discordjs/opus";
import { createOggFileForProcessing, getOpusStream } from "./record.mjs";

export const joinVoiceChannelAndGetConnection = (newState) => {
  const connection = joinVoiceChannel({
    channelId: newState.channelId,
    guildId: newState.guild.id,
    adapterCreator: newState.guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: false,
  });
  addConnectionReadyEvent(connection);
  addConnectionDisconnectedEvent(connection);
};

const addConnectionReadyEvent = (connection) => {
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("The connection has entered the Ready state - ready to play audio!");
    addSpeakingEvent(connection);
  });
};

const addConnectionDisconnectedEvent = (connection) => {
  connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 3_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 3_000),
      ]);
      // Seems to be reconnecting to a new channel - ignore disconnect
    } catch (error) {
      // Seems to be a real disconnect which SHOULDN'T be recovered from
      console.log(`Destroying current voice connection!`);
      connection.destroy();
    }
  });
};

const addSpeakingEvent = (connection) => {
  const receiver = connection.receiver;
  const encoder = new opus.OpusEncoder(48000, 2);
  let opusStream;
  receiver.speaking.on("start", async (userId) => {
    opusStream = getOpusStream(receiver, userId);
  });

  receiver.speaking.on("end", async (userId) => {
    console.log(`User ${userId} finished speaking`);
    await createOggFileForProcessing(opusStream, userId);
  });
};

export const checkIfInvalidVoiceChannel = (oldState, newState) => {
  if (newState.member.user.bot || !newState.channelId || newState.channelId === oldState.channelId)
    return true;

  if (newState.channel instanceof VoiceChannel && newState.channel.type === ChannelType.GuildVoice)
    return false;

  return true;
};

// AIzaSyBkKyZzkWaiTC-5ILILM3UR8Di21kAsEPs
