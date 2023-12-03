import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const gptModel: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('model')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The gif category')
				.setRequired(true)
				.addChoices(
					{ name: 'GPT-3.5-Turbo', value: "gpt-3.5-turbo"},
					{ name: 'GPT-4', value: "gpt-4" },
				))
		.setDescription('Selects a new GPT model version for bot to use.'),
	execute: async(interaction: ChatInputCommandInteraction, resetModel: (model: string, channelId: string) => Promise<void>) => {
		const chosenModel = interaction.options.getString('name') ?? "gpt-3.5-turbo";
		await resetModel(chosenModel, interaction.channelId);
		await interaction.reply(`You changed current GPT model to: **${chosenModel}**`);
	},
};

export default gptModel;