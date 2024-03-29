import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { AssistantOpenAI, AssistantToolsArray, GPTAssistantModels } from '../../types/openai.js';

const assistantCreate: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_create')
        .addStringOption(option =>
			option.setName('name')
				.setDescription('Name of the new GPT Assistant')
				.setRequired(true))
        .addStringOption(option =>
            option.setName('instructions')
                .setDescription('Instructions for the new GPT Assistant to take')
                .setRequired(true))    
		.addStringOption(option =>
			option.setName('model')
				.setDescription('Select a GPT model version')
				.setRequired(true)
				.addChoices(
					{ name: 'GPT-3.5(cheaper)', value: GPTAssistantModels[0]},
					{ name: 'GPT-4', value:GPTAssistantModels[1] },
				))
        .addStringOption(option =>
            option.setName('tools')
                .setDescription('Select GPT Assistant additional tools to use')
                .addChoices(
                    { name: 'Code Interpreter', value: "code_interpreter"},
                    { name: 'File Retrieveal', value: "retrieval" },
                ))
		.setDescription('Creates a new GPT Assistant with name, instructions, model and tools.'),
	execute: async(interaction: ChatInputCommandInteraction, assistantCreate: (interaction: ChatInputCommandInteraction, assistant: AssistantOpenAI) => Promise<void>) => {
		const name = interaction.options.getString('name');
        const instructions = interaction.options.getString('instructions');
        if(name === null || instructions === null) {
            await interaction.reply(`You can't create a GPT Assistant without any name or instructions!`);
            return;
        }
        const model = interaction.options.getString('model') ??  GPTAssistantModels[0];
        const choosenTool = interaction.options.getString('tools') ?? undefined;
        const tools = !choosenTool ? [{type: "code_interpreter"}, {type: "retrieval"}] as AssistantToolsArray: [{type: choosenTool}] as AssistantToolsArray;
		await assistantCreate(interaction, { name, instructions, model, tools });
	},
};
export default assistantCreate;