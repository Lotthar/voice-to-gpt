import { Client, Collection, Events, GatewayIntentBits, Interaction, Message, VoiceState } from "discord.js";

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
import { commandBotCallbacks, registerCommandsInDiscord } from "./discord/discord-commands.js";
import { BotCommand } from "./types/discord.js";
import dotenv from "dotenv";
import { generateAssistantAnswer } from "./openai/openai-assistant-api.js";
import { generateOpenAIAnswer } from "./openai/openai-api.js";
import { resetHistoryIfNewSystemMessage } from "./util/openai-api-util.js";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Bot is Ready! Logged in as ${client.user.tag}`);
});

export const discordCommands = new Collection<string,BotCommand>();
await registerCommandsInDiscord(discordCommands);

discordClient.on(Events.MessageCreate, async (message: Message) => {
  try {
    if (message.author.bot) return;
    // Only answer to messages in the channel when the bot is specifically mentioned!
    if (botIsMentioned(message)) {
      let messageContent = getMessageContentWithoutMention(message);
      if(messageContent.startsWith("!assistant")) {
        messageContent = messageContent.substring("!assistant".length, messageContent.length);
        await sendMessageWithTypingAndClbk(message, () => generateAssistantAnswer(message, messageContent));
      } else {
        await sendMessageWithTypingAndClbk(message, () => generateOpenAIAnswer(messageContent, message.channelId));
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
	if (!interaction.isChatInputCommand()) return;
	const command = discordCommands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}
	try {
    const commandClbk = commandBotCallbacks.get(interaction.commandName);
		await command.execute(interaction, commandClbk);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

discordClient.login(process.env.DISCORD_API_KEY);

