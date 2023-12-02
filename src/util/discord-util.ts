import { ChannelType, TextChannel, VoiceChannel, Message, VoiceState, AttachmentBuilder } from "discord.js";
import {
  VoiceConnectionStatus,
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
  VoiceConnection,
  AudioReceiveStream,
} from "@discordjs/voice";
import { playOpenAiAnswerWithSpeech } from "./discord-voice.js";
import { discordClient } from "../bot.js";
import { ChannelCommonType } from "../types/discord.js";
import { AssistantFile } from "../types/openai.js";
import { createWavAudioBufferFromOpus } from "./audio-util.js";

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
    console.log(`User ${userId} started speaking, waiting for finish...`);
    receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });
  });

  receiver.speaking.on("end", async (userId: string) => {
    try {
      const userOpusStream = receiver.subscriptions.get(userId);
      if(!userOpusStream) return;
      console.log(`User ${userId} finished speaking, creating an answer...`);
      const voiceAudioBuffer = await createWavAudioBufferFromOpus(userOpusStream, channelId);
      await playOpenAiAnswerWithSpeech(voiceAudioBuffer, connection, channelId);
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

export const sendMessageToProperChannelWithFile = async (message: string, files: Array<AssistantFile>, channelId: string) => {
  const channel = await sendMessageToProperChannel(message, channelId);
  if(channel === null || files.length === 0) return;
  const fileAttachments = files.map(fileData =>  new AttachmentBuilder(fileData.file, { name:  fileData.name }));
  channel.send({files: fileAttachments});
}

export const sendMessageToProperChannel = async (message: string, channelId: string,tts = false, maxLength = 2000): Promise<ChannelCommonType> => {
  const channel = await getCurrentChannel(channelId);
  if (channel === null) return null;
  if (message.length <= maxLength) {
    await channel.send({content: message, tts: tts});
    return channel;
  }
  const messageParts: string[] = [];
  let currentIndex: number = 0;
  while (currentIndex < message.length) {
    const part = message.slice(currentIndex, currentIndex + maxLength);
    messageParts.push(part);
    currentIndex += maxLength;
  }
  for (const part of messageParts) {
    await channel.send({content: part, tts: tts});
  }
  return channel;
};

export const getCurrentChannel = async (channelId: string): Promise<ChannelCommonType> => {
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
