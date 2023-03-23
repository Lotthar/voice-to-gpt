import { Client, Events, GatewayIntentBits } from "discord.js";
import { generateOpenAIAnswer } from "./open-ai";
import {
	sendMessageToProperChannel,
	genereteBasicResponseIfNeccessary,
} from "./util";
require("dotenv").config();

// Set up Discord client for bot
const discordClient = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

discordClient.once(Events.ClientReady, (client) => {
	console.log(`Ready! Logged in as ${client.user.tag}`);
});

discordClient.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;
	console.log(`Message recieved: ${message}`);
	genereteBasicResponseIfNeccessary(message);
	const answer = await generateOpenAIAnswer(message.content);
	sendMessageToProperChannel(discordClient, answer, message.channelId);
});

discordClient.login(process.env.DISCORD_API_KEY);
