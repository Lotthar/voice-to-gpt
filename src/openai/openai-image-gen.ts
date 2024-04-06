import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { openai } from "./openai-api-util.js";
import fetch from 'node-fetch';
import { ImagesResponse } from "openai/resources/images.mjs";
import { GeneratedImageResponse } from "../types/openai.js";
import { ImageGenerateParams } from "openai/resources/index.mjs";

export const generateImage = async (prompt: string, size: ImageGenerateParams["size"], quality: ImageGenerateParams["quality"], style: ImageGenerateParams["style"]) => {
    const response: ImagesResponse = await openai.images.generate({ 
      model: "dall-e-3",
      prompt: prompt,
      quality: quality,
      n: 1, 
      style: style,
      size: size
    });
    const embeds = getImageEmbeds(response);
    const content = `**Your Prompt**: "${prompt}" \n**Revised prompt**: "${response.data[0].revised_prompt}"`;
    return { embeds, content, url: response.data[0].url! } as unknown as GeneratedImageResponse;
}

export const regenerateImage = async (url: string) => {
    const existingImage = await fetch(url);
    const response: ImagesResponse = await openai.images.createVariation({ 
      model: "dall-e-2",
      image: existingImage,
      n: 1, 
      size: "1024x1024" 
    });
    const embeds = getImageEmbeds(response);
    return { embeds, content: "Regenerated Image", url: response.data[0].url! } as unknown as GeneratedImageResponse;
}

export const editImage = async (url: string, prompt: string, maskUrl: string) => {
    const existingImage = await fetch(url);
    const response: ImagesResponse = await openai.images.edit({
        model: "dall-e-2",
        prompt: prompt,
        image: existingImage,
        // mask: maskImage.data,
        n: 1, 
        size: "1024x1024" 
    })
    console.log(response);
    const imageEmbeds = getImageEmbeds(response);
    const imageContent = `**Your Prompt**: "${prompt}" \n**Revised prompt**: "${response.data[0].revised_prompt}"`;
    return { embeds: imageEmbeds, content: imageContent, url: response.data[0].url! } as unknown as GeneratedImageResponse;
}

const getImageEmbeds = (response: ImagesResponse) => {
    return response.data.map(imageData => new EmbedBuilder().setImage(imageData.url!))
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