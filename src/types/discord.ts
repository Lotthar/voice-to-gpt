import { CommandInteraction, SlashCommandBuilder, TextChannel, VoiceChannel } from "discord.js";

export type ChannelCommonType = TextChannel | VoiceChannel | null;

export const waitingAudioURI = "https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg";

export interface BotCommand {
    data: SlashCommandBuilder,
    execute: (interaction: CommandInteraction) => Promise<void>
}