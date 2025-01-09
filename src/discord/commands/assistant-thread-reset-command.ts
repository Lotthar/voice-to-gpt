import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BotCommand } from "../../types/discord.js";

const assistantList: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_reset')
		.setDescription(`Reset current conversation with GPT assistant and it's history.`),
	execute: async(interaction: ChatInputCommandInteraction, resetAssistantThread: (interaction: ChatInputCommandInteraction) => Promise<void>) => {
		await interaction.deferReply({ ephemeral: true });
		await resetAssistantThread(interaction);
	},
};

export default assistantList;