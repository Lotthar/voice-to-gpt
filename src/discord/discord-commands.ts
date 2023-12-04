import { AutocompleteInteraction, ChatInputCommandInteraction, Collection, REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { BotCommand, BotCommandCallbacks, isBotCommand } from "../types/discord.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { resetHistoryIfNewSystemMessage, setChatGptModel } from "../util/openai-api-util.js";
import { stopAssistantThreadRuns, createAssistant, deleteAssistantByName, listAllAssistants, resetAssistantThread, updateAssistant, changeAssistantForChannel, generateAssistantAnswer } from "../openai/openai-assistant-api.js";
import { retrieveAllAssitantsNames } from "../util/openai-assistant-util.js";

dotenv.config();

const discordRestClient = new REST().setToken(process.env.DISCORD_API_KEY);
const __dirname = path.dirname(fileURLToPath(import.meta.url));


/**
 * 1. Each command needs a new definition in commands directory as separate file with default export
 * 2. In order to inject functions from different contexts inside command's execute or autocomplete function
 *    use map fro below **commandBotCallbacks** and follow the same principle
 */
export const commandCallbacks: Map<string, BotCommandCallbacks> = new Map();

commandCallbacks.set("system_message", { execute: resetHistoryIfNewSystemMessage });
commandCallbacks.set("model", { execute: setChatGptModel });
commandCallbacks.set("assistant", {execute: generateAssistantAnswer});
commandCallbacks.set("assistant_list", { execute: listAllAssistants });
commandCallbacks.set("assistant_change", { execute: changeAssistantForChannel , autocomplete: retrieveAllAssitantsNames });
commandCallbacks.set("assistant_create", { execute: createAssistant });
commandCallbacks.set("assistant_update", { execute: updateAssistant, autocomplete: retrieveAllAssitantsNames });
commandCallbacks.set("assistant_delete", { execute: deleteAssistantByName, autocomplete: retrieveAllAssitantsNames });
commandCallbacks.set("assistant_reset", { execute: resetAssistantThread });
commandCallbacks.set("assistant_stop", { execute: stopAssistantThreadRuns });


export const registerCommandsInDiscord = async (commandsToRegister: Collection<string, BotCommand>) => {
  const commands = await loadAllBotCommands(commandsToRegister);
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    await discordRestClient.put(Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.DISCORD_GUILD_ID), { body: commands });
    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error("Error loading VoiceToGPT commands!", error);
  }
};

export const loadAllBotCommands = async (commands: Collection<string, BotCommand>) => {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  const commandsToRegister = [];
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      let command = (await import(filePath)).default;
      if (!isBotCommand(command)) continue;
      commands.set(command.data.name, command);
      commandsToRegister.push(command.data.toJSON());
    } catch (error) {
      console.error(`Error loading command at ${filePath}:`, error);
    }
  }
  return commandsToRegister;
};

export const handleAutocompleteInteraction = async (interaction: AutocompleteInteraction, commands: Collection<string, BotCommand>) => {
  try {
    const command = commands.get(interaction.commandName);
    if (!command || !command.autocomplete) {
      console.error(`No command matching ${interaction.commandName} was found or it doesn't have an autocomplete clbk defined.`);
      return;
    }
    const commandWithClbk = commandCallbacks.get(interaction.commandName)
    if (!commandWithClbk || !commandWithClbk.autocomplete) {
        console.error(`No command matching ${interaction.commandName} was found in commandCallbacks or it doesnt have autocomplete clbk defined.`);
        return;
    }
    command.autocomplete(interaction, commandWithClbk.autocomplete);
  } catch (error) {
    console.error("Error autocompleting interaction", error);
  }
};

export const handleChatInputInteraction = async (interaction: ChatInputCommandInteraction, commands: Collection<string, BotCommand>) => {
  try {
    const command = commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    const commandWithClbk = commandCallbacks.get(interaction.commandName)
    if (!commandWithClbk) {
        console.error(`No command matching ${interaction.commandName} was found in commandCallbacks.`);
        return;
    }
    await command.execute(interaction, commandWithClbk.execute);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
    } else {
      await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
  }
};

