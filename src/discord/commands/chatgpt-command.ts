import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const chatgpt: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('chatgpt')
        .addStringOption(option =>
			option.setName('question')
				.setDescription('Question that you want to ask ChatGPT')
				.setRequired(true))
		.setDescription('Generate answer from OpenAI ChatGPT'),
	execute: async(interaction: ChatInputCommandInteraction, generateOpenAIAnswer: (question: string, interaction: ChatInputCommandInteraction) => Promise<void>) => {
        await interaction.deferReply();
		const question = interaction.options.getString('question')!;
        await generateOpenAIAnswer(question, interaction);
    },
};

export default chatgpt;