import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./open-ai.mjs";
import { sendMessageToProperChannel } from "./util.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
} from "./voiceConnection.mjs";
import dotenv from "dotenv";

dotenv.config();

let voiceChannelConnection;

// Set up Discord client for bot
const discordClient = new Client({
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
  sendMessageToProperChannel(discordClient, answer, message.channelId);
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    if (checkIfInvalidVoiceChannel(oldState, newState)) return;
    voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.error(error);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
