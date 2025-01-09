import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const chatgptSysMessage: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('chatgpt_sys_message')
		.addStringOption(option =>
			option.setName('message')
				.setDescription('Setting value of the standard GPT bot system message.')
				.setRequired(true))
		.setDescription('Creates new system message for standard bot and resets the chat history.'),
	execute: async(interaction: ChatInputCommandInteraction, resetSystemMessage: (message: string, channelId: string) => Promise<void>) => {
		await interaction.deferReply({ ephemeral: true });
		const sysMessage = interaction.options.getString('message') ?? 'No message provided';
		await resetSystemMessage(sysMessage, interaction.channelId);
		await interaction.reply(`You changed bot standard system message to: **${sysMessage}** `);
	},
};

export default chatgptSysMessage;