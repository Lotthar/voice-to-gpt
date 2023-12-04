import { AutocompleteInteraction, ChatInputCommandInteraction,SlashCommandBuilder, TextChannel, VoiceChannel } from "discord.js";

export type ChannelCommonType = TextChannel | VoiceChannel | null;

export const waitingAudioURI = "https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg";

export interface BotCommand {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction, clkb: any) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction, clkb: any) => Promise<void>;
}

export interface BotCommandCallbacks {
    execute: (arg1?: any, arg2?: any, arg3?: any) => Promise<any>
    autocomplete?: (arg1?: any, arg2?: any, arg3?: any) => Promise<any>
}

export const isBotCommand = (object: any) => {
    return 'data' in object &&
           'execute' in object
}