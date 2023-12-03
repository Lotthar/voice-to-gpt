import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString, readTextStreamToString } from "./stream-util.js";
import { sendMessageToProperChannel } from "../discord/discord-util.js";
import {
  Tiktoken,
  load,
  registry,
  models,
  genericResponse,
  GPTModels,
  GptModelData,
} from "../types/openai.js";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});


export const resetHistoryIfNewSystemMessage = async (systemMessage: string, channelId: string) => {
  const chatHistory: Array<OpenAI.Chat.ChatCompletionMessageParam> = [{ role: "system", content: systemMessage }];
  await setCurrentSystemMessage(systemMessage, channelId);
  await saveChatHistory(chatHistory, channelId);
  console.log(`Chat history has been reset for channel: ${channelId}. New system message: ${systemMessage}`);
};

export const loadChatHistoryOrCreateNew = async (channelId: string): Promise<Array<OpenAI.Chat.ChatCompletionMessageParam>> => {
  let chatHistory = await readHistoryFromStorage(channelId);
  if (chatHistory !== null) return chatHistory;
  const currentSysMessage = await getCurrentSystemMessage(channelId);
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: "system", content: currentSysMessage }];
  await saveChatHistory(chatHistory, channelId);
  return chatHistory;
};

export const pushQAtoHistory = async (
  question: string,
  answer: string,
  channelId: string,
  chatHistory: Array<OpenAI.Chat.ChatCompletionMessageParam>
): Promise<void> => {

  chatHistory.push({ role: "user", content: question });
  chatHistory.push({ role: "assistant", content: answer });
  await saveChatHistory(chatHistory, channelId);
};

export const saveChatHistory = async (chatHistory: Array<OpenAI.Chat.ChatCompletionMessageParam>, channelId: string): Promise<void> => {
  try {
    const filePath = getHistoryPath(channelId);
    const jsonString = JSON.stringify(chatHistory);
    await uploadFileToS3(filePath, jsonString);
    console.log(`Chat history has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving history to JSON file for channel: ${channelId}:`, error);
  }
};

export const readHistoryFromStorage = async (channelId: string): Promise<Array<OpenAI.Chat.ChatCompletionMessageParam>> => {
  try {
    const historyFilePath = getHistoryPath(channelId);
    const historyJsonStream = await downloadFileFromS3(historyFilePath);
    const historyJsonString = await readJsonStreamToString(historyJsonStream);
    return JSON.parse(historyJsonString);
  } catch (error) {
    console.error(`Error reading history from JSON file for channel: ${channelId}:`, error);
    return [];
  }
};

const setCurrentSystemMessage = async (message: string, channelId: string): Promise<void | null> => {
  try {
    const sysMessagePath = getSystemMessagePath(channelId);
    await uploadFileToS3(sysMessagePath, message);
    console.log(`System message is successfully saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error setting current system message for channel: ${channelId}:`, error);
    return null;
  }
};

const getCurrentSystemMessage = async (channelId: string): Promise<string | null> => {
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

export const getChatGptModel = async (channelId: string): Promise<GptModelData> => {
  let gptModel, model;
  try {
    const gptModelPath = getChatGptModelPath(channelId);
    const gptModelStream = await downloadFileFromS3(gptModelPath);
    gptModel = await readTextStreamToString(gptModelStream);
    model = await load(registry[models[gptModel]]);
    return { modelName: gptModel, model };
  } catch (error) {
    console.error(`Error getting current ChatGPT model for channel: ${channelId}:`, error);
    gptModel = GPTModels[0];
    model = await load(registry[models[gptModel]]);
    await setChatGptModel(gptModel, channelId);
    return { modelName: gptModel, model };
  }
};

export const botChatGptModelChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!model ";
  if (!message.startsWith(command)) return false;
  const currentModelId = message.replace(command, "");
  await determineAndSetModel(currentModelId, channelId);
  return true;
};

const determineAndSetModel = async (modelId: string, channelId: string): Promise<void> => {
  let model = GPTModels.find((model) => model.startsWith(modelId));
  model = !!model ? model : GPTModels[0];
  setChatGptModel(model, channelId);
  await sendMessageToProperChannel(`You changed current GPT model to: **${model}**`, channelId);
};

export const countApiResponseTokens = async (currentChatHistory: Array<OpenAI.Chat.ChatCompletionMessageParam>, model: any, modelName: string): Promise<number> => {
  const totalTokens = currentChatHistory.map((message) => countTokens(message, model)).reduce((total, tokenValue) => total + tokenValue);
  const maxTokens = modelName.startsWith("gpt-4") ? 8192 : 4096;
  const responseTokens = maxTokens - (totalTokens + 2) - 50;
  if (responseTokens >= 2000) return responseTokens;
  currentChatHistory.splice(1, 2);
  return countApiResponseTokens(currentChatHistory, model, modelName);
};

const countTokens = (message: OpenAI.Chat.ChatCompletionMessageParam, model: any): number => {
  const modelEncoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = modelEncoder.encode(message.content);
  modelEncoder.free();
  return 4 + tokens.length;
};

export const checkAndReturnValidResponseData = (response: OpenAI.Chat.ChatCompletion): string => {
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content)
    return response.choices[0].message.content.trim();
  return genericResponse;
};

const getHistoryPath = (channelId: string): string => `history/${channelId}-history.json`;

const getSystemMessagePath = (channelId: string): string => `history/${channelId}-systemmsg`;

const getChatGptModelPath = (channelId: string): string => `models/${channelId}-model`;
