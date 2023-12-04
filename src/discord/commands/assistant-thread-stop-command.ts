import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BotCommand } from "../../types/discord.js";

const assistantList: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_stop')
		.setDescription(`Stop GPT assistant from completing the task.`),
	execute: async(interaction: ChatInputCommandInteraction, stopAssistantThread: (interaction: ChatInputCommandInteraction) => Promise<void>) => {
		await stopAssistantThread(interaction);
	},
};

export default assistantList;