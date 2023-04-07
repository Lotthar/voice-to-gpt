import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer, botSystemMessageChanged } from "./openai-api.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  getConnection,
  botIsMentioned,
  getMessageContentWithoutMention,
  botSpeakingLanguageChanged,
} from "./discord-util.mjs";
import { loadCurrentVoiceLangugageIfNone } from "./lang-util.mjs";
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
    currentChannelId = message.channelId;
    let messageContent = getMessageContentWithoutMention(message);
    message.channel.sendTyping();
    if (botSpeakingLanguageChanged(messageContent)) return;
    const systemMsgChanged = await botSystemMessageChanged(messageContent, currentChannelId);
    if (systemMsgChanged) return;
    const answer = await generateOpenAIAnswer(messageContent);
    sendMessageToProperChannel(answer);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    if (await checkIfInvalidVoiceChannel(oldState, newState)) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    await loadCurrentVoiceLangugageIfNone(currentChannelId);
    if (!voiceChannelConnection)
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.log(error);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
