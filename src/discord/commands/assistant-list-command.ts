import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const assistantList: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_list')
		.setDescription('Lists all available GPT Assistants.'),
	execute: async(interaction: ChatInputCommandInteraction, listAssistants: () => Promise<string>) => {
		const assistants = await listAssistants();
		await interaction.reply(assistants);
	},
};

export default assistantList;