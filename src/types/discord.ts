import { AutocompleteInteraction, ChatInputCommandInteraction,SlashCommandBuilder, TextChannel, VoiceChannel } from "discord.js";

export type ChannelCommonType = TextChannel | VoiceChannel | null;

export const waitingAudioURI = "https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg";

export interface BotCommand {
    data: SlashCommandBuilder;
    execute?: (interaction: ChatInputCommandInteraction, clkb: any) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction, clkb: any) => Promise<void>;
}

export const isBotCommand = (object: any) => {
    return 'data' in object &&
           'execute' in object
}