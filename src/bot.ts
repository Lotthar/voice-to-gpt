import { Client, Collection, Events, GatewayIntentBits, Message, VoiceState } from "discord.js";

import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  getConnection,
  botIsMentioned,
  getMessageContentWithoutMention,
  addVoiceConnectionReadyEvent,
} from "./discord/discord-util.js";
import dotenv from "dotenv";
import { VoiceConnection } from "@discordjs/voice";
import { useOpenAIAssistantBot, useStandardOpenAIBot } from "./discord/discord-commands.js";


dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Bot is Ready! Logged in as ${client.user.tag}`);
});

export const discordCommands = new Collection();

discordClient.on(Events.MessageCreate, async (message: Message) => {
  try {
    if (message.author.bot) return;
    // Only answer to messages in the channel when the bot is specifically mentioned!
    if (botIsMentioned(message)) {
      let messageContent = getMessageContentWithoutMention(message);
      if(messageContent.startsWith("!assistant")) {
        messageContent = messageContent.substring("!assistant".length, messageContent.length);
        useOpenAIAssistantBot(message, messageContent)
      } else {
        useStandardOpenAIBot(message,messageContent);
      }
    }
  } catch (error) {
    console.error(`Error in MessageCreate event in channel: ${message.channelId}`, error);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  let currentChannelId = null;
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    const invalidChannel = await checkIfInvalidVoiceChannel(oldState, newState);
    if (invalidChannel || invalidChannel === null) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    if (!voiceChannelConnection) {
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
      addVoiceConnectionReadyEvent(voiceChannelConnection, currentChannelId!);
    }
  } catch (error) {
    console.error(`Error in VoiceStateUpdate event in channel: ${currentChannelId}`, error);
  }
});


discordClient.login(process.env.DISCORD_API_KEY);
