import { ChannelType, VoiceChannel } from "discord.js";
import {
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  EndBehaviorType,
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
  let opusStream = null;
  const receiver = connection.receiver;
  receiver.speaking.on("start", async (userId) => {
    opusStream = getOpusStream(receiver, userId);
  });

  receiver.speaking.on("end", async (userId) => {
    if (opusStream === null) {
      console.log(`Opus stream was not able to  start after userId: ${userId} started speaking`);
      return;
    }
    console.log(`User ${userId} finished speaking, creating an answer...`);
    await createFlacAudioFileForProcessing(connection, opusStream, userId);
  });
};

export const checkIfInvalidVoiceChannel = (oldState, newState) => {
  if (newState.member.user.bot || !newState.channelId || newState.channelId === oldState.channelId)
    return true;

  if (newState.channel instanceof VoiceChannel && newState.channel.type === ChannelType.GuildVoice)
    return false;

  return true;
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

export const sendMessageToProperChannel = async (message) => {
  const channel = await discordClient.channels.fetch(currentChannelId);
  channel.send(message);
};
