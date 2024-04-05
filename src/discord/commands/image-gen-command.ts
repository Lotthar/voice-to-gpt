import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, Message, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { regenerateImage } from '../../openai/openai-image-gen.js';

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
		try {
			await interaction.deferReply();
			const { embeds, content, url } = await generateImage(prompt);
			const response = await interaction.editReply({ embeds, content, components: [getButtonRow()] });
			await generateImageButtons(response, url);
		} catch (error) {
			 console.log(error);
			 await interaction.reply("Error in generating image using OpenAI");
		}
	},
};

const generateImageButtons = async(imgResponse: Message<boolean>, imgUrl: string) => {
	const imageResponseCollector = imgResponse.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
	imageResponseCollector.on('collect', async interaction => {
		await regenerateImageInteraction(interaction, imgUrl);
	});
}

const regenerateImageInteraction = async(interaction: ButtonInteraction,url: string) => {
	await interaction.deferReply();
	const { embeds: imageEmbeds, url: imageUrl, content: imageContent } = await regenerateImage(url);
	const response = await interaction.editReply({embeds: imageEmbeds, content: imageContent, components: [getButtonRow()]});
	await generateImageButtons(response, imageUrl);
}

const getButtonRow = () => {
	const btmRegenerate = new ButtonBuilder()
	.setCustomId('variation')
	.setLabel('Regenerate Image')
	.setStyle(ButtonStyle.Primary);
	return new ActionRowBuilder<ButtonBuilder>().addComponents(btmRegenerate);
}

export default imageGen;