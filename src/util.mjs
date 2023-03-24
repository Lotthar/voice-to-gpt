import fs from "fs";

export const deleteFile = (fileName) => {
	fs.unlink(fileName, (err) => {
		if (err) {
			console.error(`Failed to delete file: ${err}`);
		} else {
			console.log(`File ${fileName} deleted`);
		}
	});
};

export const genereteBasicResponseIfNeccessary = (client, message) => {
	if (message.content === "Hello World!") {
		sendMessageToProperChannel(
			client,
			`Hello, ${message.author.username}`,
			message.channelId
		);
		return true;
	}
	return false;
};

export const sendMessageToProperChannel = async (
	client,
	message,
	channelId
) => {
	const channel = await client.channels.fetch(channelId);
	channel.send(message);
};
