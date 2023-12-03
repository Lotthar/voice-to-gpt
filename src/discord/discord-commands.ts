import { Collection, Interaction, Message } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { generateOpenAIAnswer } from "../openai/openai-api.js";
import { botChatGptModelChanged, botSystemMessageChanged } from "../util/openai-api-util.js";
import {
  assistantForChannelChanged,
  assistantCreated,
  assistantThreadReset,
  assistantUpdated,
  deleteAssistant,
  generateAssistantAnswer,
  listAllAssistants,
  assistantRunsStop,
} from "../openai/openai-assistant-api.js";
import { sendMessageToProperChannel, sendTyping } from "./discord-util.js";

export const loadAllBotCommands = (commands: Collection<string, Interaction>) => {
  const foldersPath = path.join(__dirname, "discord/commands/utility");
  const commandFolders = readdirSync(foldersPath);
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ("data" in command && "execute" in command) {
        commands.set(command.data.name, command);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }
};

export const useOpenAIAssistantBot = async (message: Message, messageContent: string) => {
  const assistantSettingsChanged = await configuringAssistantSettings(messageContent, message.channelId);
  if (assistantSettingsChanged) return;
  await sendMessageWithTypingAndClbk(message, () =>  generateAssistantAnswer(message, messageContent));
};

export const useStandardOpenAIBot = async (message: Message, messageContent: string) => {
  const botSettingsChanged = await configuringBotSettings(messageContent, message.channelId);
  if (botSettingsChanged) return;
  await sendMessageWithTypingAndClbk(message, () => generateOpenAIAnswer(messageContent,message.channelId))
};

const sendMessageWithTypingAndClbk = async (message: Message, clbk: () => Promise<void | string>) => {
    let messageSent = false;
    const stopTyping = () => messageSent;
    const typingPromise = sendTyping(message, stopTyping);
    const clbkPromise = clbk().then(() => {
        messageSent = true;
    });
    await Promise.all([typingPromise, clbkPromise]);
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

  const assistantThreadCleared = await assistantThreadReset(settingCommand, channelId);
  if (assistantThreadCleared) return true;

  const assistantStoped = await assistantRunsStop(settingCommand, channelId);
  if (assistantStoped) return true;

  return false;
};

const configuringBotSettings = async (settingCommand: string, channelId: string): Promise<boolean> => {
  const systemMsgChanged = await botSystemMessageChanged(settingCommand, channelId);
  if (systemMsgChanged) return true;
  const botModelChanged = await botChatGptModelChanged(settingCommand, channelId);
  if (botModelChanged) return true;
  return false;
};
