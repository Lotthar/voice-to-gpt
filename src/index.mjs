import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  destroyConnectionIfNoOneLeft,
  getConnection,
} from "./voice-connection.mjs";
import dotenv from "dotenv";

dotenv.config();

let voiceChannelConnection;
export let currentChannelId = null;

// Set up Discord client for bot
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

discordClient.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

discordClient.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  // Only answer to messages in the channel when the bot is specifically mentioned!
  if (message.mentions.has(discordClient.user.id) && message.mentions.users.size === 1) {
    const answer = await generateOpenAIAnswer(message.content);
    currentChannelId = message.channelId;
    sendMessageToProperChannel(answer, currentChannelId);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    if (checkIfInvalidVoiceChannel(oldState, newState)) return;
    currentChannelId = newState.channelId;
    voiceChannelConnection = getConnection(newState.guild.id);
    if (!voiceChannelConnection)
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.log(error);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
