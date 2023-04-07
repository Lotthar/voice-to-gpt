import { ChannelType } from "discord.js";
import {
  VoiceConnectionStatus,
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
} from "@discordjs/voice";
import { createFlacAudioContentFromOpus } from "./audio-util.mjs";
import { playOpenAiAnswerAfterSpeech } from "./audio-text.mjs";

import { currentChannelId, discordClient } from "./bot.mjs";

const BOT_NAME = "VoiceToGPT";

const Languages = [
  {
    name: "English",
    sttCode: "en-US",
    ttsCode: "en",
  },
  {
    name: "Serbian",
    sttCode: "sr-RS",
    ttsCode: "sr",
  },
];

export let currentVoiceLanguage = Languages[0];

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
    try {
      const voiceAudioBase64 = await createFlacAudioContentFromOpus(opusStream);
      await playOpenAiAnswerAfterSpeech(connection, voiceAudioBase64);
    } catch (error) {
      console.log("Error playing answer on voice channel: ", error);
      sendMessageToProperChannel("There was problem with the answer");
    }
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
  const member = isUserChannelMember(BOT_NAME, channel);
  if (member && channel.members.size === 1) {
    console.log("Destroying current voice connection!");
    connection.destroy();
  }
};

export const botIsMentioned = (message) =>
  message.mentions.has(discordClient.user.id) && message.mentions.users.size === 1;

export const getMessageContentWithoutMention = (message) => {
  const mentioned = message.mentions.members.first(); // get first mentioned member
  return message.content.replace(`<@${mentioned.id}> `, ""); // remove mention
};

const getCurrentChannel = async () => await discordClient.channels.fetch(currentChannelId);

const isUserChannelMember = (name, channel) => channel.members.some((m) => m.displayName === name);

export const getConnection = (guildId) => getVoiceConnection(guildId);

export const botSpeakingLanguageChanged = (message) => {
  const command = "!lang !";
  if (message.startsWith(command)) {
    currentVoiceLanguage = getLanguageFromMessage(message.replace(command, ""));
    sendMessageToProperChannel(
      `You successfully changed voice communication language to ${currentVoiceLanguage.name}`
    );
    return true;
  }
  return false;
};

export const getLanguageFromMessage = (message) => {
  message = message.substring(1);
  let lang = Languages.find((lang) => lang.name.toLowerCase() === message.toLowerCase());
  return lang ? lang : Languages[0];
};

export const sendMessageToProperChannel = async (message, maxLength = 2000) => {
  const channel = await getCurrentChannel();
  if (message.length <= maxLength) {
    await channel.send(message);
    return;
  }
  const messageParts = [];
  let currentIndex = 0;
  while (currentIndex < message.length) {
    const part = message.slice(currentIndex, currentIndex + maxLength);
    messageParts.push(part);
    currentIndex += maxLength;
  }
  for (const part of messageParts) {
    await channel.send(part);
  }
};
