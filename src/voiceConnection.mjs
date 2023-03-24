import { ChannelType, VoiceChannel } from "discord.js";
import { VoiceConnectionStatus, entersState, joinVoiceChannel } from "@discordjs/voice";
import { createFileFromRawAudio } from "./record.mjs";
const opusStream = null;

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
    addConnectionOnSpeakingEvents(connection);
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

const addConnectionOnSpeakingEvents = (connection) => {
  connection.receiver.speaking.on("start", (userId) => {
    console.log(`User ${userId} started speaking`);
    const rawAudio = createFileFromRawAudio(connection, userId);
  });
  return true;
};

export const checkIfInvalidVoiceChannel = (oldState, newState) => {
  if (newState.member.user.bot || !newState.channelId || newState.channelId === oldState.channelId)
    return true;

  if (newState.channel instanceof VoiceChannel && newState.channel.type === ChannelType.GuildVoice)
    return false;

  return true;
};
