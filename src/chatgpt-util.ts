import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString, readTextStreamToString } from "./stream-util.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { ChatGptApiParams, ChatHistory, GPTModels } from "./interfaces/openai.js";
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";

import dotenv from "dotenv";
dotenv.config();

export const getChatGptAPI = (model: string) => {
  return new ChatGPTAPI({
    apiKey: process.env.OPEN_API_KEY,
    maxResponseTokens: model === "gpt-4" ? 8192 : 4096,
    debug: false,
    completionParams: {
      model: model,
      temperature: 0.4,
    },
  });
};

export const getChatGptUnofficalAPI = async (model: string) => {
  return new ChatGPTUnofficialProxyAPI({
    accessToken: process.env.OPENAI_TOKEN,
    model: model,
    debug: false,
  });
};

export const loadChatGPTRequestParameters = async (channelId: string): Promise<ChatGptApiParams> => {
  const chatHistoryPromise = getChatHistory(channelId);
  const sysMessagePromise = getSystemMessage(channelId);
  const gptModelPromise = getChatGptModel(channelId);
  let [chatHistory, systemMessage, gptModel] = await Promise.all([chatHistoryPromise, sysMessagePromise, gptModelPromise]);
  if (chatHistory !== null) chatHistory.name = channelId;
  return { chatHistory, systemMessage, gptModel };
};

export const setChatHistory = async (chatHistory: ChatHistory, channelId: string): Promise<void> => {
  try {
    const chatHistoryPath = getHistoryPath(channelId);
    const chatHistoryJSON = JSON.stringify(chatHistory);
    await uploadFileToS3(chatHistoryPath, chatHistoryJSON);
    console.log(`Chat history data has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving history data to JSON file for channel: ${channelId}:`, error);
  }
};

export const getChatHistory = async (channelId: string): Promise<ChatHistory | null> => {
  try {
    const chatHistoryIdFilePath = getHistoryPath(channelId);
    const chatHistoryIdJsonStream = await downloadFileFromS3(chatHistoryIdFilePath);
    const chatHistoryJsonString = await readJsonStreamToString(chatHistoryIdJsonStream);
    let chatHistory: ChatHistory = JSON.parse(chatHistoryJsonString);
    return chatHistory;
  } catch (error) {
    console.error(`Error reading history data from JSON file for channel: ${channelId}:`, error);
    return null;
  }
};

const setSystemMessage = async (message: string, channelId: string): Promise<void> => {
  try {
    const sysMessagePath = getSystemMessagePath(channelId);
    await uploadFileToS3(sysMessagePath, message);
    console.log(`System message is successfully saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error setting current system message for channel: ${channelId}:`, error);
  }
};

const getSystemMessage = async (channelId: string): Promise<string | null> => {
  try {
    const systemMsgPath = getSystemMessagePath(channelId);
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    const systemMsg = await readTextStreamToString(systemMsgS3Stream);
    return systemMsg;
  } catch (error) {
    console.error(`Error getting current system message for channel: ${channelId}:`, error);
    return null;
  }
};

const setChatGptModel = async (model: string, channelId: string): Promise<void> => {
  try {
    const gptModelPath = getChatGptModelPath(channelId);
    await uploadFileToS3(gptModelPath, model);
    console.log(`ChatGPT model is successfully saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error setting current ChatGPT model for channel: ${channelId}:`, error);
  }
};

const getChatGptModel = async (channelId: string): Promise<string> => {
  try {
    const gptModelPath = getChatGptModelPath(channelId);
    const gptModelStream = await downloadFileFromS3(gptModelPath);
    const gptModel = await readTextStreamToString(gptModelStream);
    return gptModel;
  } catch (error) {
    console.error(`Error getting current ChatGPT model for channel: ${channelId}:`, error);
    return GPTModels[0];
  }
};

export const botSystemMessageChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!system ";
  if (!message.startsWith(command)) return false;
  const currentSystemMessage = message.replace(command, "");
  setSystemMessage(`${currentSystemMessage} Current date: ${new Date().toISOString()}\n\n`, channelId);
  await sendMessageToProperChannel(`You changed system message to: **${currentSystemMessage}**`, channelId);
  return true;
};

export const botChatGptModelChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!model ";
  if (!message.startsWith(command)) return false;
  const currentModelId = message.replace(command, "");
  await determineAndSetModel(currentModelId, channelId);
  return true;
};

const determineAndSetModel = async (modelId: string, channelId: string): Promise<void> => {
  let model = GPTModels.find((model) => model.indexOf(modelId) > -1);
  model = !!model ? model : GPTModels[0];
  setChatGptModel(model, channelId);
  await sendMessageToProperChannel(`You changed current GPT model to: **${model}**`, channelId);
};

const getHistoryPath = (channelId: string): string => `history/${channelId}-history`;

const getSystemMessagePath = (channelId: string): string => `system/${channelId}-systemmsg`;

const getChatGptModelPath = (channelId: string): string => `models/${channelId}-model`;
