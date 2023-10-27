import { Message } from "discord.js";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const model = "andreasjansson/blip-2:4b32258c42e9efd4288bb9910bc532a69727f9acd26aa08e175713a0a857a608";

export const modifyMessageWithImageInput = async (message: Message, messageContent: string) => {
  let imageContent = "";
  if (message.attachments.size > 0) {
    for (let attachment of Array.from(message.attachments.values())) {
      if (attachment.contentType?.startsWith("image/")) {
        const textFromImage = await convertImageToTextDescription(attachment.url);
        imageContent += `Given: ${textFromImage}\n`;
      }
    }
    messageContent = `${imageContent}\n${messageContent}`;
  }
  return messageContent;
};

const convertImageToTextDescription = async (imageUrl: string) => {
  const input = {
    image: imageUrl,
  };
  try {
    const output = await replicate.run(model, { input });
    return output;
  } catch {
    console.error("Error retrieving text from image");
    return "";
  }
};
