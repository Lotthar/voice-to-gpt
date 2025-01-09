import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { GPTModels } from '../../types/openai.js';

const chatgptModel: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('chatgpt_model')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('Setting standard GPT bot model version.')
				.setRequired(true)
				.addChoices(
					{ name: 'GPT-3.5-Turbo', value: GPTModels[0]},
					{ name: 'GPT-4', value: GPTModels[1] },
				))
		.setDescription('Selects a new GPT model version for bot to use.'),
	execute: async(interaction: ChatInputCommandInteraction, resetModel: (model: string, channelId: string) => Promise<void>) => {
		await interaction.deferReply({ ephemeral: true });
		const chosenModel = interaction.options.getString('name') ?? GPTModels[0];
		await resetModel(chosenModel, interaction.channelId);
		await interaction.reply(`You changed current GPT model to: **${chosenModel}**`);
	},
};

export default chatgptModel;