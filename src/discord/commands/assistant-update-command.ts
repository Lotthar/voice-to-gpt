import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';
import { AssistantTools, GPTAssistantModels } from '../../types/openai.js';
import { AssistantTool, AssistantUpdateParams } from 'openai/resources/beta/assistants.mjs';

const assistantUpdate: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_update')
        .addStringOption(option =>
			option.setName('name')
				.setDescription('Name of the GPT Assistant to update')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('instructions')
                .setDescription('New instructions for GPT Assistant with chosen name.'))    
		.addStringOption(option =>
			option.setName('model')
				.setDescription('New model version for GPT Assistant with chosen name.')
				.addChoices(
					{ name: 'GPT-3.5(cheaper)', value: GPTAssistantModels[0] },
					{ name: 'GPT-4', value: GPTAssistantModels[1]},
                    { name: 'GPT-4 Omni', value:GPTAssistantModels[2] },
                    { name: 'GPT-4 Omni Mini', value:GPTAssistantModels[3] },
				))
        .addStringOption(option =>
            option.setName('tools')
                .setDescription('Select GPT Assistant additional tools to use')
                .addChoices(
                    { name: 'Code Interpreter', value: "code_interpreter"},
                    { name: 'File Search', value: "file_search" },
                ))     
		.setDescription('Updates selected GPT Assistant with new instructions, model or tools.'),
	autocomplete: async(interaction: AutocompleteInteraction, getExistingAssistants: () => Promise<string[]>) => {
        const existingAssistantChoices = await getExistingAssistants();
        const focusedValue = interaction.options.getFocused();
		const filtered = existingAssistantChoices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
    execute: async(interaction: ChatInputCommandInteraction, updateAssistant: (interaction: ChatInputCommandInteraction, newAssistant: AssistantUpdateParams) => Promise<string>) => {
        await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('name');
        if(name === null) {
            await interaction.reply(`You can't update a GPT Assistant without specifying its name and instructions!`);
            return;
        }
        const instructions = interaction.options.getString('instructions') ?? undefined;
        const model = interaction.options.getString('model') ?? undefined;
        const choosenTool = interaction.options.getString('tools') ?? undefined;
        const tools: Array<AssistantTool> = !choosenTool ? AssistantTools : [{type: choosenTool} as AssistantTool] ;
        await updateAssistant(interaction, {name, instructions, model, tools})
    }
};
export default assistantUpdate;