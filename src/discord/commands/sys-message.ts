import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { resetHistoryIfNewSystemMessage } from '../../util/openai-api-util.js';

const sysMessage: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('system_message')
		.addStringOption(option =>
			option.setName('message')
				.setDescription('Value for the system message.')
				.setRequired(true))
		.setDescription('Creates new system message for standard bot and resets the chat history.'),
	execute: async(interaction: ChatInputCommandInteraction) => {
		const sysMessage = interaction.options.getString('message') ?? 'No message provided';
		// await resetHistoryIfNewSystemMessage(sysMessage, interaction.channelId);
		await interaction.reply(`You changed bot standard system message to: **${sysMessage}** `);
	},
};

export default sysMessage;