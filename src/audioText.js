import { fs } from "node:fs";
import { SpeechClient } from "@google-cloud/speech";
import tts from "google-tts-api";

// Set up Google Cloud Speech-to-Text API
const speechToTextClient = new SpeechClient();

const processAudioStream = async (message) => {
	// const connection = await joinChannelAndGetConnection(message);
	// if (!connection || connection === null) return;
	// const receiver = connection.receiver;
	// createListeningStreamFile(receiver, message.author.id);
};

export const processAudioStreamIntoText = async (fileName) => {
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

const joinVoiceChannelAndGetConnection = async (message) => {
	const connection = joinVoiceChannel({
		channelId: message.member.voice.channel.id,
		guildId: message.guild.id,
		adapterCreator: message.guild.voiceAdapterCreator,
	});
	return connection;
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
