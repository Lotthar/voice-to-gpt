import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const assistantDelete: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_delete')
        .addStringOption(option =>
			option.setName('name')
				.setDescription('Name of the GPT Assistant to delete')
                .setAutocomplete(true)
                .setRequired(true))
			
		.setDescription('Deletes selected GPT Assistant.'),
	autocomplete: async(interaction: AutocompleteInteraction, getExistingAssistants: () => Promise<string[]>) => {
        const existingAssistantChoices = await getExistingAssistants();
        const focusedValue = interaction.options.getFocused();
		const filtered = existingAssistantChoices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
    execute: async(interaction: ChatInputCommandInteraction, deleteAssistant: (name: string, interaction: ChatInputCommandInteraction) => Promise<string>) => {
        const name = interaction.options.getString('name');
        if(name === null) {
            await interaction.reply(`You can't delete a GPT Assistant without specifying its name and instructions!`);
            return;
        }
        await deleteAssistant(name, interaction);
    }
};

export default assistantDelete;