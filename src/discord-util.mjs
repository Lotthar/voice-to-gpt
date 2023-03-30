import { ChannelType } from "discord.js";
import {
  VoiceConnectionStatus,
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
} from "@discordjs/voice";
import { createFlacAudioFileForProcessing } from "./audio-util.mjs";
import { currentChannelId, discordClient } from "./index.mjs";

export const joinVoiceChannelAndGetConnection = (newState) => {
  const connection = joinVoiceChannel({
    channelId: newState.channelId,
    guildId: newState.guild.id,
    adapterCreator: newState.guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: false,
  });
  addConnectionReadyEvent(connection);
};

const addConnectionReadyEvent = (connection) => {
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("The connection has entered the Ready state - ready to play audio!");
    addSpeakingEvent(connection);
  });
};

const addSpeakingEvent = (connection) => {
  let opusStream = null;
  const receiver = connection.receiver;
  receiver.speaking.on("start", async (userId) => {
    opusStream = getOpusStream(receiver, userId);
  });

  receiver.speaking.on("end", async (userId) => {
    console.log(`User ${userId} finished speaking, creating an answer...`);
    await createFlacAudioFileForProcessing(connection, opusStream, userId);
  });
};

/**
 *  A Readable object mode stream of Opus packets
    Will end when the voice connection is destroyed, or the user has not said anything for 500ms
 * @param {*} receiver - voice channel voice reciever object
 */
export const getOpusStream = (receiver, userId) => {
  return receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 500,
    },
  });
};

export const checkIfInvalidVoiceChannel = async (oldState, newState) => {
  if (newState.member.user.bot) return true;
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) return false;
  if (oldState.channelId && !newState.channelId) {
    // User has left voice channel
    await destroyConnectionIfOnlyBotRemains(getConnection(oldState.guild.id));
    return true;
  }

  return true;
};

const destroyConnectionIfOnlyBotRemains = async (connection) => {
  if (!connection) return;
  const channel = await getCurrentChannel();
  const member = isUserChannelMember("VoiceToGPT", channel);
  if (member && channel.members.size === 1) {
    console.log("Destroying current voice connection!");
    connection.destroy();
  }
};

export const sendMessageToProperChannel = async (message) => {
  const channel = await getCurrentChannel();
  channel.send(message);
};
export const botIsMentioned = (message) =>
  message.mentions.has(discordClient.user.id) && message.mentions.users.size === 1;

const getCurrentChannel = async () => await discordClient.channels.fetch(currentChannelId);

const isUserChannelMember = (name, channel) => channel.members.some((m) => m.displayName === name);

export const getConnection = (guildId) => getVoiceConnection(guildId);
