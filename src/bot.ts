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
import dotenv from "dotenv";
import { VoiceConnection } from "@discordjs/voice";
import { generateOpenAIAnswer } from "./openai/openai-api.js";
import { botChatGptModelChanged, botSystemMessageChanged } from "./util/openai-api-util.js";
import { assistantForChannelChanged, assistantCreated, assistantThreadReset, assistantUpdated, deleteAssistant, generateAssistantAnswer, listAllAssistants, assistantRunsStop } from "./openai/openai-assistant-api.js";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Bot is Ready! Logged in as ${client.user.tag}`);
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
    if (!voiceChannelConnection) {
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
      addVoiceConnectionReadyEvent(voiceChannelConnection, currentChannelId!);
    }
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
  const messagePromise = sendMessageToProperChannel(answer, message.channelId).then(() => {
    messageSent = true;
  });
  await Promise.all([typingPromise, messagePromise]);
}

const configuringAssistantSettings = async (settingCommand: string, channelId: string) => {
  const assistantSettingChanged = await assistantForChannelChanged(settingCommand, channelId);
  if (assistantSettingChanged) return true;

  const assistantSettingList = await listAllAssistants(settingCommand, channelId);
  if (assistantSettingList) return true;

  const assistantSettingDeleted = await deleteAssistant(settingCommand, channelId);
  if (assistantSettingDeleted) return true;

  const assistantSettingUpdated = await assistantUpdated(settingCommand, channelId);
  if (assistantSettingUpdated) return true;

  const assistantSettingCreated = await assistantCreated(settingCommand, channelId);
  if (assistantSettingCreated) return true;

  const assistantThreadCleared = await assistantThreadReset(settingCommand,channelId);
  if(assistantThreadCleared) return true;

  const assistantStoped = await assistantRunsStop(settingCommand, channelId);
  if(assistantStoped) return true;

  return false;
}

const configuringBotSettings = async (settingCommand: string, channelId: string): Promise<boolean> => {
  const systemMsgChanged = await botSystemMessageChanged(settingCommand, channelId);
  if (systemMsgChanged) return true;
  const botModelChanged = await botChatGptModelChanged(settingCommand, channelId);
  if (botModelChanged) return true;
  return false;
};

discordClient.login(process.env.DISCORD_API_KEY);
