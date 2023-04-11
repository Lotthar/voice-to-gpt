import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./openai-api.mjs";
import { botSystemMessageChanged } from "./openai-util.mjs";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  getConnection,
  botIsMentioned,
  getMessageContentWithoutMention,
} from "./discord-util.mjs";
import { loadCurrentVoiceLangugageIfNone, botSpeakingLanguageChanged } from "./lang-util.mjs";
import { botTTSVoiceChanged, loadVoiceAndModelIfNone } from "./fy-tts-api.mjs";
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
  try {
    if (message.author.bot) return;
    // Only answer to messages in the channel when the bot is specifically mentioned!
    if (botIsMentioned(message)) {
      currentChannelId = message.channelId;
      let messageContent = getMessageContentWithoutMention(message);
      message.channel.sendTyping();
      const botSettingsChanged = await configuringBotSettings(messageContent);
      if (botSettingsChanged) return;
      const answer = await generateOpenAIAnswer(messageContent);
      await sendMessageToProperChannel(answer);
    }
  } catch (error) {
    console.error("Error in MessageCreate event: ", error);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    if (await checkIfInvalidVoiceChannel(oldState, newState)) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    await loadCurrentVoiceLangugageIfNone();
    await loadVoiceAndModelIfNone();
    if (!voiceChannelConnection)
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
  } catch (error) {
    console.error("Error in VoiceStateUpdate event: ", error);
  }
});

const configuringBotSettings = async (settingCommand) => {
  const botSpeakingLangChanged = await botSpeakingLanguageChanged(settingCommand);
  if (botSpeakingLangChanged) return true;
  const systemMsgChanged = await botSystemMessageChanged(settingCommand);
  if (systemMsgChanged) return true;
  const botVoiceChanged = await botTTSVoiceChanged(settingCommand);
  if (botVoiceChanged) return true;
  return false;
};

discordClient.login(process.env.DISCORD_API_KEY);
