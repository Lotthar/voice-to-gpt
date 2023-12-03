import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../types/discord.js';

const assistantList: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('assistant_list')
		.setDescription('Lists all available GPT Assistants.'),
	execute: async(interaction: ChatInputCommandInteraction, listAssistants: () => Promise<string>) => {
		const assistants = await listAssistants();
        const maxLength = 2000;
		if (assistants.length <= maxLength) {
            await interaction.reply({content: assistants, ephemeral: true });
            return;
        }
        const messageParts: string[] = [];
        for (let currentIndex: number = 0; currentIndex < assistants.length; currentIndex += maxLength) {
            const part = assistants.slice(currentIndex, currentIndex + maxLength);
            messageParts.push(part);
        }
        // reply with first part
        await interaction.reply({content: messageParts[0], ephemeral: true });
        for (let index = 1; index < messageParts.length; index++) {
            await interaction.followUp({content: messageParts[index], ephemeral: true });
        }
	},
};

export default assistantList;