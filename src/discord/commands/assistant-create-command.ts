import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { AssistantOpenAI } from '../../types/openai.js';

const assistantCreate: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_create')
        .addStringOption(option =>
			option.setName('name')
				.setDescription('Name of the new GPT Assistant')
				.setRequired(true))
        .addStringOption(option =>
            option.setName('instructions')
                .setDescription('Instructions for the new GPT Assistant')
                .setRequired(true))    
		.addStringOption(option =>
			option.setName('model')
				.setDescription('Select a model')
				.setRequired(true)
				.addChoices(
					{ name: 'GPT-3.5-Turbo', value: "gpt-3.5-turbo-1106"},
					{ name: 'GPT-4', value: "gpt-4-1106-preview" },
				))

        .addStringOption(option =>
            option.setName('tools')
                .setDescription('Select GPT Assistant additional tools to use')
                .addChoices(
                    { name: 'Code Interpreter', value: "code_interpreter"},
                    { name: 'File Retrieveal', value: "retrieval" },
                ))
		.setDescription('Selects a new GPT model version for bot to use.'),
	execute: async(interaction: ChatInputCommandInteraction, assistantCreate: (interaction: ChatInputCommandInteraction, assistant: AssistantOpenAI) => Promise<void>) => {
		const name = interaction.options.getString('name') ?? `VoiceToGPT(${interaction.channelId})`;
        const instructions = interaction.options.getString('instructions') ?? ""
        const model = interaction.options.getString('model') ?? "gpt-3.5-turbo-1106";
		await assistantCreate(interaction, { name, instructions, model });
	},
};
export default assistantCreate;