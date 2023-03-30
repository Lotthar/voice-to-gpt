import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  getConnection,
  botIsMentioned,
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
  if (botIsMentioned(message)) {
    const answer = await generateOpenAIAnswer(message.content);
    currentChannelId = message.channelId;
    sendMessageToProperChannel(answer);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    if (await checkIfInvalidVoiceChannel(oldState, newState)) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    if (!voiceChannelConnection)
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.log(error);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
