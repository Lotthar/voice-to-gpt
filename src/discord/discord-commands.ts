import { ChatInputCommandInteraction, Collection, REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { BotCommand, isBotCommand } from "../types/discord.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const discordRestClient = new REST().setToken(process.env.DISCORD_API_KEY);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const registerCommandsInDiscord = async (commandsToRegister: Collection<string, BotCommand>) => {
    const commands = await loadAllBotCommands(commandsToRegister);
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);		
        await discordRestClient.put(Routes.applicationCommands(process.env.DISCORD_APP_ID),{ body: commands });
		console.log(`Successfully reloaded application (/) commands.`);
	} catch (error) {
		console.error("Error loading VoiceToGPT commands!", error);
	}
}

export const loadAllBotCommands = async (commands: Collection<string, BotCommand>) => {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  const commandsToRegister = [];
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      let command = (await import(filePath)).default;
      console.log(command);
      if (!isBotCommand(command)) continue;
        commands.set(command.data.name, command);
        commandsToRegister.push(command.data.toJSON());
    } catch (error) {
      console.error(`Error loading command at ${filePath}:`, error);
    }
  }
  return commandsToRegister;
};


// const configuringAssistantSettings = async (settingCommand: string, channelId: string) => {
//   const assistantSettingChanged = await assistantForChannelChanged(settingCommand, channelId);
//   if (assistantSettingChanged) return true;

//   const assistantSettingList = await listAllAssistants(settingCommand, channelId);
//   if (assistantSettingList) return true;

//   const assistantSettingDeleted = await deleteAssistant(settingCommand, channelId);
//   if (assistantSettingDeleted) return true;

//   const assistantSettingUpdated = await assistantUpdated(settingCommand, channelId);
//   if (assistantSettingUpdated) return true;

//   const assistantSettingCreated = await assistantCreated(settingCommand, channelId);
//   if (assistantSettingCreated) return true;

//   const assistantThreadCleared = await assistantThreadReset(settingCommand, channelId);
//   if (assistantThreadCleared) return true;

//   const assistantStoped = await assistantRunsStop(settingCommand, channelId);
//   if (assistantStoped) return true;

//   return false;
// };

// const configuringBotSettings = async (settingCommand: string, channelId: string): Promise<boolean> => {
//   const botModelChanged = await botChatGptModelChanged(settingCommand, channelId);
//   if (botModelChanged) return true;
//   return false;
// };
