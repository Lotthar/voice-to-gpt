import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const imageGen: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('generate_image')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('Describe the image you want to be generated.')
				.setRequired(true))
		.setDescription('Generates the images using OpenAI Dall-E '),
	execute: async(interaction: ChatInputCommandInteraction, generateImage: (prompt: string) => Promise<any>) => {
		const prompt = interaction.options.getString('prompt') ?? null;
		if(prompt === null) {
			await interaction.reply(`No prompt is provided to be able to generate image!`);
			return;
		}
		await interaction.deferReply();
		const { embeds, content } = await generateImage(prompt);
		await interaction.editReply({ embeds, content});
	},
};

export default imageGen;