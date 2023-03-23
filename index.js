const { Client, Events, GatewayIntentBits } = require("discord.js");
const speech = require("@google-cloud/speech");
const openai = require("openai");
require("dotenv").config();

// Set up Google Cloud Speech-to-Text API
const speechClient = new speech.SpeechClient();

// Set up OpenAI API
openai.apiKey = process.env.OPENAI_API_KEY;

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
	console.log(`Message recieved: ${message}`);
	if (message.author.bot) return;

	if (message.content === "!hello") {
		message.reply("Hello!");
	}
	await processMessageContent(message);
});

const processMessageContent = async (message) => {
	if (message.content === "!ask") {
		const voiceChannel = message.member.voice.channel;
		if (voiceChannel) {
			await processAudioStream(message, voiceChannel);
		} else {
			message.reply("You need to join a voice channel first!");
		}
	}
};

const processAudioStream = (async = async (message, voiceChannel) => {
	// Listen for voice messages and transcribe them
	const audioStream = getAudioStream(message, voiceChannel);
	const answerMessage = await processVoiceMessage(message, voiceChannel);
	sendMessageToProperChannel(answerMessage, message.channelId);
	audioStream.pipe(recognizeStream);
});

const getAudioStream = async (message, voiceChannel) => {
	const connection = await voiceChannel.join();
	const receiver = connection.receiver;
	return receiver.createStream(message.member.user, {
		mode: "pcm",
	});
};

const processVoiceMessage = async (message, voiceChannel) => {
	const requestConfig = {
		encoding: "LINEAR16",
		sampleRateHertz: 16000,
		languageCode: "en-US",
	};
	speechClient
		.streamingRecognize(requestConfig)
		.on("error", console.error)
		.on("data", async (response) => {
			const transcript = response.results[0].alternatives[0].transcript;
			return await generateOpenAIAnswer(transcript);
		});
};

const sendMessageToProperChannel = async (message, channelId) => {
	const channel = await discordClient.channels.fetch(channelId);
	channel.send(message);
};

const generateOpenAIAnswer = async (transcript) => {
	// Use OpenAI API to generate response
	const prompt = `Q: ${transcript}\nA:`;
	const openAIresponse = await openai.complete({
		engine: "text-davinci-002",
		prompt: prompt,
		maxTokens: 1024,
	});
	return openAIresponse.choices[0].text;
};

discordClient.login(process.env.DISCORD_API_KEY);
