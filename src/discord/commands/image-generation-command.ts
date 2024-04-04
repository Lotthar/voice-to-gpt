import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const imageGeneration: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('generate_image')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('Describe the image you want to be generated.')
				.setRequired(true))
		.setDescription('Generates the images using OpenAI Dall-E '),
	execute: async(interaction: ChatInputCommandInteraction, generateImage: (prompt: string | null, interaction: ChatInputCommandInteraction) => Promise<void>) => {
		const prompt = interaction.options.getString('prompt') ?? null;
		await generateImage(prompt, interaction);
	},
};

export default imageGeneration;