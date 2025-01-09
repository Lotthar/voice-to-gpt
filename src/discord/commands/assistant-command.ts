import { Attachment, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { AssistantFileType } from '../../types/openai.js';

const assistantCommand: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant')
        .addStringOption(option =>
			option.setName('question')
				.setDescription('Question that you want to ask GPT Assistant')
				.setRequired(true))
		.setDescription('Generate answer from OpenAI Assistant')
        .addAttachmentOption(option =>
			option.setName('file1')
				.setDescription('Optional file to provide to the Assistant')
				.setRequired(false))
        .addAttachmentOption(option =>
            option.setName('file2')
                .setDescription('Optional file to provide to the Assistant')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('file3')
                .setDescription('Optional file to provide to the Assistant')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('file4')
                .setDescription('Optional file to provide to the Assistant')
                .setRequired(false))
		.setDescription('Generate answer from OpenAI Assistant'),
	execute: async(interaction: ChatInputCommandInteraction, generateAssistantAnswer: (interaction: ChatInputCommandInteraction, question: string, files: Map<string, AssistantFileType>) => Promise<void>) => {
        await interaction.deferReply({ ephemeral: false });
        const question = interaction.options.getString('question')!;
        const fileAttachments = new Map<string, AssistantFileType>();
        const fileSize = 4;
        let fileType: AssistantFileType;
        for(let i = 1; i <= fileSize; i++) {
            const file = interaction.options.getAttachment(`file${i}`);
            if(file !== null) {
                fileType = file.contentType?.includes("image") ? "image" : "file";
                fileAttachments.set(file.url, fileType);
            }
        }
        await generateAssistantAnswer(interaction, question, fileAttachments);
    },
};

export default assistantCommand;