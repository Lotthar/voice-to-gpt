import { Collection, Message, REST, Routes } from "discord.js";
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
import { sendTyping } from "./discord-util.js";
import { BotCommand } from "../types/discord.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_API_KEY);

// and deploy your commands!
export const registerCommandsInDiscord = async (commandsToRegister: Collection<string, BotCommand>) => {
    const commands = await loadAllBotCommands(commandsToRegister);
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);		
        await rest.put(Routes.applicationCommands(process.env.DISCORD_APP_ID),{ body: commands });
		console.log(`Successfully reloaded application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
}

export const loadAllBotCommands = async (commands: Collection<string, BotCommand>) => {
  const commandsPath = path.join(__dirname, "commands", "utility");
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  const commandsToRegister = [];
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      let command = await import(filePath);
      command = command.default;
      if ("data" in command && "execute" in command) {
        commands.set(command.data.name, command);
        commandsToRegister.push(command.data.toJSON());
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`[ERROR] Error loading command at ${filePath}:`, error);
    }
  }
  return commandsToRegister;
};

export const useOpenAIAssistantBot = async (message: Message, messageContent: string) => {
  const assistantSettingsChanged = await configuringAssistantSettings(messageContent, message.channelId);
  if (assistantSettingsChanged) return;
  await sendMessageWithTypingAndClbk(message, () => generateAssistantAnswer(message, messageContent));
};

export const useStandardOpenAIBot = async (message: Message, messageContent: string) => {
  const botSettingsChanged = await configuringBotSettings(messageContent, message.channelId);
  if (botSettingsChanged) return;
  await sendMessageWithTypingAndClbk(message, () => generateOpenAIAnswer(messageContent, message.channelId));
};

const sendMessageWithTypingAndClbk = async (message: Message, clbk: () => Promise<void | string>) => {
  let messageSent = false;
  const stopTyping = () => messageSent;
  const typingPromise = sendTyping(message, stopTyping);
  const clbkPromise = clbk().then(() => {
    messageSent = true;
  });
  await Promise.all([typingPromise, clbkPromise]);
};

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
