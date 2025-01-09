import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, Message, ModalBuilder, ModalSubmitInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { editImage, regenerateImage } from '../../openai/openai-image-gen.js';
import { GeneratedImageResponse } from '../../types/openai.js';
import { ImageGenerateParams } from 'openai/resources/images.mjs';
const imageGen: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('dalle_generate_image')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('Describe the image you want to be generated.')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('size')
				.setDescription('Select the size of the image to be generated')
				.addChoices(
					{ name: "1024x1024", value:  "1024x1024" },
					{ name: "256x256", value: "256x256"},
					{ name: "512x512", value: "512x512" },
					{ name: "1792x1024", value: "1792x1024" },
					{ name:  "1024x1792" , value: "1024x1792" },
				)) 
		.addStringOption(option =>
			option.setName('quality')
				.setDescription('Select image quality')
				.addChoices(
					{ name: "HD", value:  "hd" },
					{ name: "Standard", value: "standard"},
				))        
		.addStringOption(option =>
			option.setName('style')
				.setDescription('Select image style')
				.addChoices(
					{ name: "Vivid", value:  "vivid" },
					{ name: "Natural", value: "natural"},
				))    
		.setDescription('Generates the images using OpenAI Dall-E '),
	execute: async(interaction: ChatInputCommandInteraction, generateImage: (prompt: string, size: ImageGenerateParams["size"], quality: ImageGenerateParams["quality"], style: ImageGenerateParams["style"]) => Promise<GeneratedImageResponse>) => {
		await interaction.deferReply();
		const prompt = interaction.options.getString('prompt') ?? null;
		if(prompt === null) {
			await interaction.editReply(`No prompt is provided to be able to generate image!`);
			return;
		}
		const size = (interaction.options.getString('size') ?? "1024x1024") as ImageGenerateParams["size"];
		const quality = (interaction.options.getString('quality') ?? "hd") as ImageGenerateParams["quality"];
		const style = (interaction.options.getString('style') ?? "vivid") as ImageGenerateParams["style"];
		try {
			const { embeds, content, url: newImageUrl } = await generateImage(prompt, size, quality, style);
			const response = await interaction.editReply({ embeds, content, components: [getImageButtonsRow()] });
			await generateImageButtons(response, newImageUrl);
		} catch (error) {
			 console.log(error);
			 await interaction.editReply("Error in generating image using OpenAI");
		}
	},
};

const generateImageButtons = async(imgResponse: Message<boolean>, imgUrl: string) => {
	const imageResponseCollector = imgResponse.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
	imageResponseCollector.on('collect', async interaction => {
		try {
			if(interaction.customId === "edit") {
				await editImageInteraction(interaction, imgUrl);
				return;
			}
			if(interaction.customId === "regenerate") {
				await regenerateImageInteraction(interaction, imgUrl);
				return;
			}
		} catch(error) {
			console.log(error);
		}
	});
}

const regenerateImageInteraction = async(interaction: ButtonInteraction,url: string) => {
	await interaction.deferReply();
	const { embeds, content, url: newImageUrl } = await regenerateImage(url);
	const response = await interaction.editReply({embeds, content, components: [getImageButtonsRow()]});
	await generateImageButtons(response, newImageUrl);
}

const editImageInteraction = async(interaction: ButtonInteraction, url: string) => {
	const modal = getEditImageModal();
	interaction.showModal(modal);
	const filter = (interaction: ModalSubmitInteraction) => interaction.customId === 'editModal';
	const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 3_600_000 });
	const prompt = modalInteraction.fields.getTextInputValue("editPrompt");
	const maskUrl = modalInteraction.fields.getTextInputValue("maskUrl");
	await modalInteraction.deferReply();
	const { embeds, content, url: newImageUrl } = await editImage(url, prompt, maskUrl);
	const response = await modalInteraction.editReply({embeds, content, components: [getImageButtonsRow()]});
	await generateImageButtons(response, newImageUrl);
}

const getImageButtonsRow = () => {
	const regenerateBtn = getButton("regenerate", "Regenerate Image");
	// TODO: need to fix editImage issue with double "fetch" call in "editImage" method in openai-image-gen.ts
	// const editBtn = getButton("edit", "Edit Image");
	return getButtonActionRow(regenerateBtn);
}

const getButtonActionRow = (...buttons: ButtonBuilder[]) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

const getButton = (id: string, label: string) => {
	return new ButtonBuilder()
	.setCustomId(id)
	.setLabel(label)
	.setStyle(ButtonStyle.Primary);
}

const getEditImageModal = () => {
	const modal = new ModalBuilder()
			.setCustomId('editModal')
			.setTitle('Edit Generated Image');

	const editPromptInput = new TextInputBuilder()
			.setCustomId('editPrompt')
			.setRequired(true)
			.setLabel("Input prompt for image edit")
			.setStyle(TextInputStyle.Paragraph);

	const imageMaskUrl = new TextInputBuilder()
			.setCustomId('maskUrl')
			.setLabel("Mask Image URL")
			.setRequired(true)
			.setPlaceholder("https://imgur.com/...")
			.setStyle(TextInputStyle.Short);

	const editInputRow =  new ActionRowBuilder<TextInputBuilder>().addComponents(editPromptInput);
	const maskInputRow = new ActionRowBuilder<TextInputBuilder>().addComponents(imageMaskUrl);
	modal.addComponents(editInputRow, maskInputRow);
	return modal;
}

export default imageGen;