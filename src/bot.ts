import { Client, Events, GatewayIntentBits, Message, VoiceState } from "discord.js";
import { generateOpenAIAnswer } from "./openai-api.js";
import { botSystemMessageChanged, genericResponse } from "./openai-util.js";
import {
  joinVoiceChannelAndGetConnection,
  checkIfInvalidVoiceChannel,
  sendMessageToProperChannel,
  getConnection,
  botIsMentioned,
  getMessageContentWithoutMention,
  addVoiceConnectionReadyEvent,
} from "./discord-util.js";
import { loadCurrentVoiceLangugageIfNone, botSpeakingLanguageChanged } from "./lang-util.js";
import { botTTSVoiceChanged, loadVoiceIfNone } from "./voice-util.js";
import dotenv from "dotenv";
import { VoiceConnection } from "@discordjs/voice";

dotenv.config();

let voiceChannelConnection: VoiceConnection | undefined;
export let currentChannelId: string | null = null;

// Set up Discord client for bot
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

discordClient.once(Events.ClientReady, (client: Client<true>) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

discordClient.on(Events.MessageCreate, async (message: Message) => {
  try {
    if (message.author.bot) return;
    // Only answer to messages in the channel when the bot is specifically mentioned!
    if (botIsMentioned(message)) {
      currentChannelId = message.channelId;
      let messageContent = getMessageContentWithoutMention(message);
      message.channel.sendTyping();
      const botSettingsChanged: boolean = await configuringBotSettings(messageContent);
      if (botSettingsChanged) return;
      let answer: string | null = await generateOpenAIAnswer(messageContent);
      if (answer === null) answer = genericResponse;
      await sendMessageToProperChannel(answer);
    }
  } catch (error) {
    console.error("Error in MessageCreate event: ", error);
  }
});

discordClient.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  try {
    currentChannelId = newState.channelId ? newState.channelId : oldState.channelId;
    if (await checkIfInvalidVoiceChannel(oldState, newState)) return;
    voiceChannelConnection = getConnection(newState.guild.id);
    await loadCurrentVoiceLangugageIfNone();
    await loadVoiceIfNone();
    if (!voiceChannelConnection) voiceChannelConnection = joinVoiceChannelAndGetConnection(newState);
    addVoiceConnectionReadyEvent(voiceChannelConnection);
  } catch (error) {
    console.error("Error in VoiceStateUpdate event: ", error);
  }
});

const configuringBotSettings = async (settingCommand: string): Promise<boolean> => {
  const botSpeakingLangChanged = await botSpeakingLanguageChanged(settingCommand);
  if (botSpeakingLangChanged) return true;
  const systemMsgChanged = await botSystemMessageChanged(settingCommand);
  if (systemMsgChanged) return true;
  const botVoiceChanged = await botTTSVoiceChanged(settingCommand);
  if (botVoiceChanged) return true;
  return false;
};

discordClient.login(process.env.DISCORD_API_KEY);
