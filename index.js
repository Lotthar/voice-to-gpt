const { Client, Events, GatewayIntentBits } = require("discord.js");
const speech = require("@google-cloud/speech");
const tts = require("google-tts-api");
const { Configuration, OpenAIApi } = require("openai");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new speech.SpeechClient();

// Set up your API key and model ID
const configuration = new Configuration({
	apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
const chatHistory = [];
const conversationId = uuidv4();

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
	if (message.content === "Hello World!") {
		return sendMessageToProperChannel(
			`Hello, ${message.author.username}`,
			message.channelId
		);
	}
	chatHistory.push(message.content);
	await processMessageContent(message);
});

const processMessageContent = async (message) => {
	let answer = null;
	// TODO!!!!!

	// if (message.content === "!ask") {
	// answer = processAudioStream(message);
	// speakAnswer(message, answer);
	// }
	answer = await generateOpenAIAnswer(message.content);
	sendMessageToProperChannel(answer, message.channelId);
};

const processAudioStream = async (message) => {
	// const connection = await joinChannelAndGetConnection(message);
	// if (!connection || connection === null) return;
	// const receiver = connection.receiver;
	// createListeningStreamFile(receiver, message.author.id);
};

const joinChannelAndGetConnection = async (message) => {
	const connection = joinVoiceChannel({
		channelId: message.member.voice.channel.id,
		guildId: message.guild.id,
		adapterCreator: message.guild.voiceAdapterCreator,
	});
	return connection;
};

const processAudioStreamIntoText = async (fileName) => {
	const file = fs.readFileSync(fileName);
	const audioBytes = file.toString("base64");
	const audio = {
		content: audioBytes,
	};
	const config = {
		encoding: "PCM",
		sampleRateHertz: 48000,
		languageCode: "en-US",
	};
	const request = {
		audio: audio,
		config: config,
	};

	// Detects speech in the audio file
	const [response] = await speechToTextClient.recognize(request);
	return response.results
		.map((result) => result.alternatives[0].transcript)
		.join("\n");
};

const deleteFile = (fileName) => {
	fs.unlink(fileName, (err) => {
		if (err) {
			console.error(`Failed to delete file: ${err}`);
		} else {
			console.log(`File ${fileName} deleted`);
		}
	});
};

const generateOpenAIAnswer = async (transcript) => {
	// Use OpenAI API to generate response
	console.log(`Getting Open AI answer for "${transcript}"`);
	// const prompt = `Q: ${transcript}\nA:`;
	const openAIresponse = await openai.createCompletion({
		model: "text-davinci-003",
		prompt: `Conversation with ${conversationId}\n\n${chatHistory.join(
			"\n"
		)}\n\n${transcript}`,
		max_tokens: 1024,
		temperature: 0,
	});
	return openAIresponse.data.choices[0].text;
};

const speakAnswer = async (answer) => {
	const url = await tts(answer, "en-US");
	dispatcher.on("start", () => {
		console.log("Playing audio");
	});
	dispatcher.on("finish", () => {
		console.log("Finished playing audio");
	});
	const dispatcher = connection.play(url);
};

const sendMessageToProperChannel = async (message, channelId) => {
	const channel = await discordClient.channels.fetch(channelId);
	channel.send(message);
};

discordClient.login(process.env.DISCORD_API_KEY);
