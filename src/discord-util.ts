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
import { currentChannelId, discordClient } from "./bot.js";
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
  addVoiceConnectionReadyEvent(connection);
  return connection;
};

const addVoiceConnectionReadyEvent = (connection: VoiceConnection): void => {
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("Bot is connected and ready to answer users questions!");
    addSpeakingEvents(connection);
  });
};

const addSpeakingEvents = (connection: VoiceConnection): void => {
  const receiver = connection.receiver;
  receiver.speaking.on("start", async (userId: string) => {
    console.log(`User ${userId} started speaking, waiting for finish...`);
    if (opusStream === null) opusStream = getOpusStream(receiver, userId);
  });

  receiver.speaking.on("end", async (userId: string) => {
    console.log(`User ${userId} finished speaking, creating an answer...`);
    try {
      if (opusStream === null) return;
      const voiceAudioBase64 = await createFlacAudioContentFromOpus(opusStream);
      await playOpenAiAnswerAfterSpeech(connection, voiceAudioBase64);
      opusStream = null;
    } catch (error) {
      console.error("Error playing answer on voice channel: ", error);
      await sendMessageToProperChannel("**There was problem with the answer**");
    }
  });
};

export const checkIfInvalidVoiceChannel = async (oldState: VoiceState, newState: VoiceState): Promise<boolean> => {
  if (newState === null || newState.member === null) return true;
  if (newState.member.user.bot) return true;
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) return false;
  if (oldState.channelId && !newState.channelId) {
    // User has left voice channel
    await destroyConnectionIfOnlyBotRemains(getConnection(oldState.guild.id));
    return true;
  }

  return true;
};

const destroyConnectionIfOnlyBotRemains = async (connection: VoiceConnection | undefined): Promise<void> => {
  if (!connection) return;
  const channel = await getCurrentChannel();
  if (channel === null) return;
  const member = isUserChannelMember(BOT_NAME, channel);
  if (member && channel.members.size === 1) {
    console.log("Destroying current voice connection!");
    connection.destroy();
  }
};

export const botIsMentioned = (message: Message): boolean =>
  discordClient.user !== null && message.mentions.has(discordClient.user.id) && message.mentions.users.size === 1;

export const getMessageContentWithoutMention = (message: Message): string => {
  const mentioned = message.mentions.members!.first(); // get first mentioned member
  return message.content.replace(`<@${mentioned!.id}> `, ""); // remove mention
};

export const sendMessageToProperChannel = async (message: string, maxLength = 2000): Promise<void> => {
  const channel = await getCurrentChannel();
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

const getCurrentChannel = async (): Promise<ChannelCommonType> => {
  if (!currentChannelId) return null;
  const channel = await discordClient.channels.fetch(currentChannelId);
  if (channel instanceof TextChannel || channel instanceof VoiceChannel) {
    return channel;
  }
  return null;
};

const isUserChannelMember = (name: string, channel: TextChannel | VoiceChannel): Boolean =>
  channel.members.some((member) => member.displayName === name);

export const getConnection = (guildId: string): VoiceConnection | undefined => getVoiceConnection(guildId);
