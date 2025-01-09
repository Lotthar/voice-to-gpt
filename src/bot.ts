import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  VoiceState,
} from "discord.js";

import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  getConnection,
  addVoiceConnectionReadyEvent,
} from "./discord/discord-util.js";
import { VoiceConnection } from "@discordjs/voice";
import { handleAutocompleteInteraction, handleChatInputInteraction, registerCommandsInDiscord } from "./discord/discord-commands.js";
import { BotCommand } from "./types/discord.js";
import dotenv from "dotenv";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

export const discordCommands = new Collection<string, BotCommand>();

discordClient.once(Events.ClientReady, async (client: Client<true>) => {
  await registerCommandsInDiscord(discordCommands);
  console.log(`Bot is Ready! Logged in as ${client.user.tag}`);
});


discordClient.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  let currentChannelId = null;
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    const invalidChannel = await checkIfInvalidVoiceChannel(oldState, newState);
    if (invalidChannel || invalidChannel === null) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    if (!voiceChannelConnection) {
      voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
      addVoiceConnectionReadyEvent(voiceChannelConnection, currentChannelId!);
    }
  } catch (error) {
    console.error(`Error in VoiceStateUpdate event in channel: ${currentChannelId}`, error);
  }
});

discordClient.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleChatInputInteraction(interaction, discordCommands);
    return;
  }
  if(interaction.isAutocomplete()) {
    await handleAutocompleteInteraction(interaction,discordCommands);
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
