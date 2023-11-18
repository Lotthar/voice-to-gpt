import { Client, Events, GatewayIntentBits, Message, VoiceState } from "discord.js";

import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  getConnection,
  botIsMentioned,
  getMessageContentWithoutMention,
  addVoiceConnectionReadyEvent,
  sendTyping,
} from "./util/discord-util.js";
import { loadCurrentVoiceLangugageIfNone, botSpeakingLanguageChanged } from "./util/lang-util.js";
import { loadVoiceIfNone } from "./util/voice-util.js";
import dotenv from "dotenv";
import { VoiceConnection } from "@discordjs/voice";
import { generateOpenAIAnswer } from "./openai/openai-api.js";
import { botChatGptModelChanged, botSystemMessageChanged } from "./openai/openai-util.js";
import { assistantChanged, assistantThreadReset, generateAssistantAnswer } from "./openai/openai-assistant.js";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

// Set up Discord client for bot
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

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
    await loadCurrentVoiceLangugageIfNone(currentChannelId!);
    await loadVoiceIfNone(currentChannelId!);
    if (!voiceChannelConnection) voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
    addVoiceConnectionReadyEvent(voiceChannelConnection, currentChannelId!);
  } catch (error) {
    console.error(`Error in VoiceStateUpdate event in channel: ${currentChannelId}`, error);
  }
});

const useOpenAIAssistantBot = async (message: Message, messageContent: string) => {
  const assistantSettingsChanged = await configuringAssistantSettings(messageContent, message.channelId);
  if (assistantSettingsChanged) return;
  let messageSent = false;
  const stopTyping = () => messageSent;
  const typingPromise = sendTyping(message, stopTyping);
  let messagePromise = generateAssistantAnswer(message, messageContent).then(() => {
    messageSent = true;
  });
  await Promise.all([typingPromise, messagePromise]);
}

const useStandardOpenAIBot = async (message: Message, messageContent: string) => {
  const botSettingsChanged = await configuringBotSettings(messageContent, message.channelId);
  if (botSettingsChanged) return;
  let messageSent = false;
  const stopTyping = () => messageSent;
  const typingPromise = sendTyping(message, stopTyping);
  let answer = await generateOpenAIAnswer(messageContent, message.channelId);
  const messagePromise = sendMessageToProperChannel(answer, message.channelId, true).then(() => {
    messageSent = true;
  });
  await Promise.all([typingPromise, messagePromise]);
}

const configuringAssistantSettings = async (settingCommand: string, channelId: string) => {
  const assistantSettingChanged = await assistantChanged(settingCommand, channelId);
  if (assistantSettingChanged) return true;
  const assistantThreadCleared = await assistantThreadReset(settingCommand,channelId);
  if(assistantThreadCleared) return true;
  return false;
}

const configuringBotSettings = async (settingCommand: string, channelId: string): Promise<boolean> => {
  const botSpeakingLangChanged = await botSpeakingLanguageChanged(settingCommand, channelId);
  if (botSpeakingLangChanged) return true;
  const systemMsgChanged = await botSystemMessageChanged(settingCommand, channelId);
  if (systemMsgChanged) return true;
  const botModelChanged = await botChatGptModelChanged(settingCommand, channelId);
  if (botModelChanged) return true;
  return false;
};

discordClient.login(process.env.DISCORD_API_KEY);
