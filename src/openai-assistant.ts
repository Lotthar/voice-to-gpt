import { Assistant } from "openai/resources/beta/assistants/assistants.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString } from "./stream-util.js";
import { openai } from "./openai-util.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { GPTAssistantModels } from "./interfaces/openai.js";
import { Message } from "discord.js";

const assistantOptions = ["name", "instructions", "model"];

export const generateAssistantAnswer = async (message: Message) => {
  return "Test answer";
};

export const assistantChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!assistant_change";
  if (!message.startsWith(command)) return false;
  const { name, instructions, model } = parseAsssitantConfigInput(message, assistantOptions);
  let asssitant = await getCurrentAssistantForChannel(channelId);
  if (asssitant === null) {
    await createAssistant(channelId, name, instructions, determineModel(model));
  } else {
    await updateAssistant(channelId, asssitant.id, name,instructions,determineModel(model))
  }
  return true;
};

export const getCurrentAssistantForChannel = async (channelId: string): Promise<Assistant | null> => {
  try {
    const assistantPath = getAssistantPath(channelId);
    const assistantsJsonStream = await downloadFileFromS3(assistantPath);
    const assistantJsonString = await readJsonStreamToString(assistantsJsonStream);
    return JSON.parse(assistantJsonString);
  } catch (error) {
    console.error(`Error reading GPT Assistants from JSON file for channel: ${channelId}:`, error);
    return null;
  }
};

export const createAssistant = async (channelId: string, name: string, instructions: string, model: string) => {
  try {
    const assistant = await openai.beta.assistants.create({
      name: `${name}(voice-to-gpt)`,
      instructions: instructions,
      tools: [{ type: "code_interpreter" }, { type: "retrieval" }],
      model: model,
    });
    await saveAssistantInStorage(assistant, channelId);
    await sendMessageToProperChannel(
      `You **created** a new GPT Assistant named: **${assistant.name}**, model: **${assistant.model}**, instructions: **${assistant.instructions}**`,
      channelId
    );
  } catch (error) {
    console.error("Error creating assistant", error);
    await sendMessageToProperChannel(`Error updating assistant!`, channelId);
  }
};

export const updateAssistant = async (channelId: string, asssitantId: string, name: string | null, instructions: string, model: string | null) => {
  try {
    let updateParams: Record<string,string> = {};
    if(name !== null) updateParams.name = name;
    if(model !== null) updateParams.model = model;
    updateParams.instructions = instructions;

    const assistant = await openai.beta.assistants.update(asssitantId, updateParams);
    await saveAssistantInStorage(assistant, channelId);
    await sendMessageToProperChannel(
      `You **updated** GPT Assistant for this channel! Current name: **${assistant.name}**, model: **${assistant.model}**, instructions: **${assistant.instructions}**`,
      channelId
    );
  } catch (error) {
    console.error("Error updating assistant", error);
    await sendMessageToProperChannel(`Error updating assistant!`, channelId);
  }
};

export const saveAssistantInStorage = async (assistant: Assistant, channelId: string): Promise<void> => {
  try {
    const filePath = getAssistantPath(channelId);
    const jsonString = JSON.stringify(assistant);
    await uploadFileToS3(filePath, jsonString);
    console.log(`GPT Assistant has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving GPT Assistant to JSON file for channel: ${channelId}:`, error);
  }
};

function parseAsssitantConfigInput(input: string, configParamLabels: string[]) {
  input = input.trim();
  const params: Record<string, string> = {};
  configParamLabels.forEach((label) => {
    const regex = new RegExp(`${label}\\s*=\\s*"([^"]*)"`, "gi");
    let match;
    while ((match = regex.exec(input)) !== null) {
      const value = match[1];
      params[label] = value;
    }
  });
  return params;
}

const determineModel = (modelName: string): string => {
  let model = GPTAssistantModels.find((model) => model.startsWith(modelName));
  return !!model ? model : GPTAssistantModels[0];
};

const getAssistantPath = (channelId: string): string => `assistants/${channelId}-assistant.json`;
