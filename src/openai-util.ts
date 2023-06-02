import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString, readTextStreamToString } from "./stream-util.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { Tiktoken, load, registry, models, ChatCompletionRequestMessageRoleEnum } from "./interfaces/openai.js";
import { Configuration, OpenAIApi, ChatCompletionRequestMessage, CreateChatCompletionResponse } from "openai";

export const MODEL_NAME: string = "gpt-4";
export const MODEL_MAX_TOKENS: number = 8192;
export const model = await load(registry[models[MODEL_NAME]]);
export const genericResponse = "The answer is not generated properly!";

export const resetHistoryIfNewSystemMessage = async (systemMessage: string, channelId: string) => {
  let chatHistory = await readHistoryFromStorage(channelId);
  const currentSystemMessage = await getCurrentSystemMessage(channelId);
  if (currentSystemMessage === null || chatHistory?.length === 0 || chatHistory[0].content !== systemMessage) {
    chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: systemMessage }];
    await setCurrentSystemMessage(systemMessage, channelId);
    await saveChatHistory(chatHistory, channelId);
    console.log(`Chat history has been reset for channel: ${channelId}. New system message: ${systemMessage}`);
  }
};

export const loadChatHistoryOrCreateNew = async (channelId: string): Promise<Array<ChatCompletionRequestMessage>> => {
  let chatHistory = await readHistoryFromStorage(channelId);
  if (chatHistory !== null) return chatHistory;
  const currentSysMessage = await getCurrentSystemMessage(channelId);
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: currentSysMessage }];
  await saveChatHistory(chatHistory, channelId);
  return chatHistory;
};

export const pushQAtoHistory = async (
  question: string,
  answer: string,
  channelId: string,
  chatHistory: Array<ChatCompletionRequestMessage>
): Promise<void> => {
  chatHistory.push({ role: ChatCompletionRequestMessageRoleEnum.User, content: question });
  chatHistory.push({ role: ChatCompletionRequestMessageRoleEnum.Assistant, content: answer });
  await saveChatHistory(chatHistory, channelId);
};

export const saveChatHistory = async (chatHistory: Array<ChatCompletionRequestMessage>, channelId: string): Promise<void> => {
  try {
    const filePath = getHistoryPath(channelId);
    const jsonString = JSON.stringify(chatHistory);
    await uploadFileToS3(filePath, jsonString);
    console.log(`Chat history has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving history to JSON file for channel: ${channelId}:`, error);
  }
};

export const readHistoryFromStorage = async (channelId: string): Promise<ChatCompletionRequestMessage[]> => {
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

export const botSystemMessageChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!system ";
  if (!message.startsWith(command)) return false;
  const currentSystemMessage = message.replace(command, "");
  await resetHistoryIfNewSystemMessage(currentSystemMessage, channelId);
  await sendMessageToProperChannel(`You changed system message to: **${currentSystemMessage}**`, channelId);
  return true;
};

export const countApiResponseTokens = (currentChatHistory: ChatCompletionRequestMessage[]): number => {
  const totalTokens = currentChatHistory.map((message) => countTokens(message)).reduce((total, tokenValue) => total + tokenValue);
  const responseTokens = MODEL_MAX_TOKENS - (totalTokens + 2)- 50;
  if (responseTokens > 2000) return responseTokens;
  return countApiResponseTokens(currentChatHistory.splice(1, 2));
};

const countTokens = (message: ChatCompletionRequestMessage): number => {
  const modelEncoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = modelEncoder.encode(message.content);
  modelEncoder.free();
  return 4 + tokens.length;
};

export const checkAndReturnValidResponseData = (response: CreateChatCompletionResponse): string => {
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content)
    return response.choices[0].message.content.trim();
  return genericResponse;
};

const getHistoryPath = (channelId: string): string => `history/${channelId}-history.json`;

const getSystemMessagePath = (channelId: string): string => `history/${channelId}-systemmsg`;

export { Configuration, OpenAIApi, ChatCompletionRequestMessage };
