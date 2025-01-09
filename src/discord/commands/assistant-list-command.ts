import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const assistantList: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_list')
		.setDescription('Lists all available GPT Assistants.'),
	execute: async(interaction: ChatInputCommandInteraction, listAssistants: (interaction: ChatInputCommandInteraction) => Promise<string>) => {
		await interaction.deferReply({ ephemeral: true });
		await listAssistants(interaction);
	},
};

export default assistantList;