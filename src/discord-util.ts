import { ChannelType, TextChannel, VoiceChannel, Message, VoiceState } from "discord.js";
import {
  VoiceConnectionStatus,
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
  VoiceConnection,
  VoiceReceiver,
  AudioReceiveStream,
} from "@discordjs/voice";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.js";
import { discordClient } from "./bot.js";
import { createFlacAudioContentFromOpus } from "./audio-util.js";
import { ChannelCommonType } from "./types/discord.js";

const BOT_NAME = "VoiceToGPT";

let opusStream: AudioReceiveStream | null = null;

export const joinVoiceChannelAndGetConnection = (newState: VoiceState): VoiceConnection => {
  const connection = joinVoiceChannel({
    channelId: newState.channelId!,
    guildId: newState.guild.id,
    adapterCreator: newState.guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: false,
  });
  return connection;
};

export const addVoiceConnectionReadyEvent = (connection: VoiceConnection, channelId: string): void => {
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("Bot is connected and ready to answer users questions!");
    addSpeakingEvents(connection, channelId);
  });
};

const addSpeakingEvents = (connection: VoiceConnection, channelId: string): void => {
  const receiver = connection.receiver;
  receiver.speaking.on("start", async (userId: string) => {
    if (opusStream === null) {
      console.log(`User ${userId} started speaking, waiting for finish...`);
      opusStream = getOpusStream(receiver, userId);
    }
  });

  receiver.speaking.on("end", async (userId: string) => {
    try {
      if (opusStream === null) return;
      console.log(`User ${userId} finished speaking, creating an answer...`);
      const voiceAudioBase64 = await createFlacAudioContentFromOpus(opusStream, channelId);
      await playOpenAiAnswerAfterSpeech(voiceAudioBase64, connection, channelId);
      opusStream = null;
    } catch (error) {
      console.error("Error playing answer on voice channel: ", error);
      await sendMessageToProperChannel("**There was problem with the answer**", channelId);
    }
  });
};

export const checkIfInvalidVoiceChannel = async (oldState: VoiceState, newState: VoiceState): Promise<boolean> => {
  if (newState === null || newState.member === null) return true;
  if (newState.member.user.bot) return true;
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) return false;
  if (oldState.channelId && !newState.channelId) {
    // User has left voice channel
    await destroyConnectionIfOnlyBotRemains(getConnection(oldState.guild.id), oldState.channelId);
    return true;
  }

  return true;
};

const destroyConnectionIfOnlyBotRemains = async (connection: VoiceConnection | undefined, channelId: string): Promise<void> => {
  if (!connection) return;
  const channel = await getCurrentChannel(channelId);
  if (channel === null) return;
  const member = isUserChannelMember(BOT_NAME, channel);
  if (member && channel.members.size === 1) {
    console.log("Destroying current voice connection and it's listeners!");
    connection.removeAllListeners();
    connection.destroy();
  }
};

export const botIsMentioned = (message: Message): boolean =>
  discordClient.user !== null && message.mentions.has(discordClient.user.id) && message.mentions.users.size === 1;

export const getMessageContentWithoutMention = (message: Message): string => {
  const mentioned = message.mentions.members!.first();
  return message.content.replace(`<@${mentioned!.id}> `, "");
};

export const sendTyping = async (message: Message, stopTyping: Function) => {
  while (!stopTyping()) {
    message.channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

export const sendMessageToProperChannel = async (message: string, channelId: string, maxLength = 2000): Promise<void> => {
  const channel = await getCurrentChannel(channelId);
  if (channel === null) return;
  if (message.length <= maxLength) {
    await channel.send(message);
    return;
  }
  const messageParts: string[] = [];
  let currentIndex: number = 0;
  while (currentIndex < message.length) {
    const part = message.slice(currentIndex, currentIndex + maxLength);
    messageParts.push(part);
    currentIndex += maxLength;
  }
  for (const part of messageParts) {
    await channel.send(part);
  }
};

/**
 *  A Readable object mode stream of Opus packets
    Will end when the voice connection is destroyed, or the user has not said anything for 500ms
 * @param {*} receiver - voice channel voice reciever object
 */
const getOpusStream = (receiver: VoiceReceiver, userId: string): AudioReceiveStream => {
  return receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 500,
    },
  });
};

const getCurrentChannel = async (channelId: string): Promise<ChannelCommonType> => {
  if (!channelId) return null;
  const channel = await discordClient.channels.fetch(channelId);
  if (channel instanceof TextChannel || channel instanceof VoiceChannel) {
    return channel;
  }
  return null;
};

const isUserChannelMember = (name: string, channel: TextChannel | VoiceChannel): Boolean =>
  channel.members.some((member) => member.displayName === name);

export const getConnection = (guildId: string): VoiceConnection | undefined => getVoiceConnection(guildId);
