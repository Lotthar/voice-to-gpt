import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../../types/discord.js';
const command: BotCommand = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Provides information about the user.'),
	execute: async(interaction: CommandInteraction) => {
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		await interaction.reply(`This command was run by ${interaction.user.username}`);
	},
};

export default command;