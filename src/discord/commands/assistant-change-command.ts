import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const assistantDelete: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_change')
        .addStringOption(option =>
			option.setName('name')
				.setDescription('Name of the GPT Assistant')
                .setAutocomplete(true)
                .setRequired(true))
			
		.setDescription('Selects the GPT Assistant to be used for this channel'),
	autocomplete: async(interaction: AutocompleteInteraction, getExistingAssistants: () => Promise<string[]>) => {
        const existingAssistantChoices = await getExistingAssistants();
        const focusedValue = interaction.options.getFocused();
		const filtered = existingAssistantChoices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
    execute: async(interaction: ChatInputCommandInteraction, changeAssistantForChannel: (name: string, interaction: ChatInputCommandInteraction) => Promise<string>) => {
        await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString('name');
        if(name === null) {
            await interaction.reply(`You can't select a GPT Assistant without specifying its name!`);
            return;
        }
        await changeAssistantForChannel(name, interaction);
    }
};

export default assistantDelete;