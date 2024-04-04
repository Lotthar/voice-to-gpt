import { AttachmentBuilder, ChatInputCommandInteraction } from "discord.js";
import { openai } from "./openai-api-util.js";
import fetch from 'node-fetch';
import { ImagesResponse } from "openai/resources/images.mjs";

export const generateImage = async (prompt: string,  interaction: ChatInputCommandInteraction) => {
    if(prompt === null) {
        await interaction.reply(`No prompt is provided to be able to generate image!`);
        return;
    }
    await interaction.deferReply();
    const response: ImagesResponse = await openai.images.generate({ 
      model: "dall-e-3",
      prompt: prompt,
      quality: "hd",
      n: 1, 
      size: "1024x1024" 
    });
    const imageFiles  = await getImagesFromResponse(response);
    const imageEmbeds = getImageEmbeds(response);
    await interaction.editReply({files: imageFiles, embeds: imageEmbeds, content: `**Your Prompt**: "${prompt}" \n**Revised prompt**: "${response.data.map(d => d.revised_prompt)[0]}"`})
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