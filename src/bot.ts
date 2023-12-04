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
  botIsMentioned,
  getMessageContentWithoutMention,
  addVoiceConnectionReadyEvent,
  sendMessageWithTypingAndClbk,
} from "./discord/discord-util.js";
import { VoiceConnection } from "@discordjs/voice";
import { handleAutocompleteInteraction, handleChatInputInteraction, registerCommandsInDiscord } from "./discord/discord-commands.js";
import { BotCommand } from "./types/discord.js";
import dotenv from "dotenv";
import { generateAssistantAnswer } from "./openai/openai-assistant-api.js";
import { generateOpenAIAnswer } from "./openai/openai-api.js";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Bot is Ready! Logged in as ${client.user.tag}`);
});

export const discordCommands = new Collection<string, BotCommand>();
await registerCommandsInDiscord(discordCommands);

discordClient.on(Events.MessageCreate, async (message: Message) => {
  try {
    if (message.author.bot) return;
    // Only answer to messages in the channel when the bot is specifically mentioned!
    if (botIsMentioned(message)) {
      let messageContent = getMessageContentWithoutMention(message);
      if (messageContent.startsWith("!basic")) {
        messageContent = messageContent.substring("!basic".length, messageContent.length);
        await sendMessageWithTypingAndClbk(message, () => generateOpenAIAnswer(messageContent, message.channelId));
      } else {
        await sendMessageWithTypingAndClbk(message, () => generateAssistantAnswer(message, messageContent));
      }
    }
  } catch (error) {
    console.error(`Error in MessageCreate event in channel: ${message.channelId}`, error);
  }
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
    return;
  }
});

discordClient.login(process.env.DISCORD_API_KEY);
