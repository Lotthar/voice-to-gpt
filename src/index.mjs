import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
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
  console.log(`Message recieved: "${message}"`);
  const answer = await generateOpenAIAnswer(message.content);
  currentChannelId = message.channelId;
  sendMessageToProperChannel(answer, currentChannelId);
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    if (checkIfInvalidVoiceChannel(oldState, newState)) return;
    currentChannelId = newState.channelId;
    voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.error(error);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
