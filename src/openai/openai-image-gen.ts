import { AttachmentBuilder, ChatInputCommandInteraction } from "discord.js";
import { openai } from "./openai-api-util.js";
import fetch from 'node-fetch';
import { ImagesResponse } from "openai/resources/images.mjs";
import { GeneratedImageResponse } from "../types/openai.js";

export const generateImage = async (prompt: string) => {
    const response: ImagesResponse = await openai.images.generate({ 
      model: "dall-e-3",
      prompt: prompt,
      quality: "hd",
      n: 1, 
      size: "1024x1024" 
    });
    const imageEmbeds = getImageEmbeds(response);
    const imageContent = `**Your Prompt**: "${prompt}" \n**Revised prompt**: "${response.data.map(d => d.revised_prompt)[0]}"`;
    return { embeds: imageEmbeds, content: imageContent } as unknown as GeneratedImageResponse;
}

const getImageEmbeds = (response: ImagesResponse) => {
    return response.data.map(imageData => {
        const embed = { 
            image: {
                url: imageData.url!
            }
        }
        return embed;
    })
}
  
const getImagesFromResponse = async (response: ImagesResponse) => {
    let attachments = [];
    let attachment;
    for(let data of response.data) {
        let imgFile = await getBufferFromUrl(data.url!);
        attachment = new AttachmentBuilder(imgFile, { name:  `GeneratedImage_${Date.now().toLocaleString()}`});
        attachments.push(attachment);
    }
    return attachments;
}

const getBufferFromUrl = async (url: string) => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}