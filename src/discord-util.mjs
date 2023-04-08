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
import { resetLangugageIfChanged } from "./lang-util.mjs";

const BOT_NAME = "VoiceToGPT";

let opusStream = null;

export const joinVoiceChannelAndGetConnection = (newState) => {
  const connection = joinVoiceChannel({
    channelId: newState.channelId,
    guildId: newState.guild.id,
    adapterCreator: newState.guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: false,
  });
  addVoiceConnectionReadyEvent(connection);
};

const addVoiceConnectionReadyEvent = (connection) => {
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("Bot is connected and ready to answer users questions!");
    addSpeakingEvents(connection);
  });
};

const addSpeakingEvents = (connection) => {
  const receiver = connection.receiver;
  receiver.speaking.on("start", async (userId) => {
    console.log(`User ${userId} started speaking, waiting for finish...`);
    if (opusStream === null) opusStream = getOpusStream(receiver, userId);
  });

  receiver.speaking.on("end", async (userId) => {
    console.log(`User ${userId} finished speaking, creating an answer...`);
    try {
      const voiceAudioBase64 = await createFlacAudioContentFromOpus(opusStream);
      await playOpenAiAnswerAfterSpeech(connection, voiceAudioBase64);
      opusStream = null;
    } catch (error) {
      console.error("Error playing answer on voice channel: ", error);
      sendMessageToProperChannel("There was problem with the answer");
    }
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

export const botSpeakingLanguageChanged = async (message) => {
  const command = "!lang !";
  if (message.startsWith(command)) {
    const langName = message.replace(command, "");
    await resetLangugageIfChanged(langName, currentChannelId);
    sendMessageToProperChannel(
      `You successfully changed voice communication language to ${langName}`
    );
    return true;
  }
  return false;
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

/**
 *  A Readable object mode stream of Opus packets
    Will end when the voice connection is destroyed, or the user has not said anything for 500ms
 * @param {*} receiver - voice channel voice reciever object
 */
const getOpusStream = (receiver, userId) => {
  return receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 500,
    },
  });
};

const getCurrentChannel = async () => await discordClient.channels.fetch(currentChannelId);

const isUserChannelMember = (name, channel) => channel.members.some((m) => m.displayName === name);

export const getConnection = (guildId) => getVoiceConnection(guildId);
