import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString, readTextStreamToString } from "./stream-util.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { currentChannelId } from "./bot.js";
import { Tiktoken, load, registry, models, ChatCompletionRequestMessageRoleEnum } from "./interfaces/openai.js";
import { Configuration, OpenAIApi, ChatCompletionRequestMessage, CreateChatCompletionResponse } from "openai";

export const MODEL_NAME: string = "gpt-4";
export const MODEL_MAX_TOKENS: number = 8192;
export const model = await load(registry[models[MODEL_NAME]]);
export let chatHistory: ChatCompletionRequestMessage[] = [];
export const genericResponse = "The answer is not generated properly!";

export const resetHistoryIfNewSystemMessage = async (systemMessage: string) => {
  const currentSystemMessage = await getCurrentSystemMessage();
  if (currentSystemMessage === null || chatHistory?.length === 0 || chatHistory[0].content !== systemMessage) {
    chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: systemMessage }];
    await setCurrentSystemMessage(systemMessage);
    await saveChatHistory();
    console.log(`Chat history has been reset for channel: ${currentChannelId}. New system message: ${systemMessage}`);
  }
};

export const loadChatHistoryOrCreateNew = async (): Promise<void> => {
  chatHistory = await readHistoryFromStorage();
  if (chatHistory !== null) return;
  const currentSysMessage = await getCurrentSystemMessage();
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: currentSysMessage }];
  await saveChatHistory();
};

export const pushQAtoHistory = async (question: string, answer: string): Promise<void> => {
  chatHistory.push({ role: ChatCompletionRequestMessageRoleEnum.User, content: question });
  chatHistory.push({ role: ChatCompletionRequestMessageRoleEnum.Assistant, content: answer });
  await saveChatHistory();
};

export const saveChatHistory = async (): Promise<void> => {
  try {
    const filePath = getHistoryPath();
    const jsonString = JSON.stringify(chatHistory);
    await uploadFileToS3(filePath, jsonString);
    console.log(`Chat history has been saved for channel: ${currentChannelId}`);
  } catch (error) {
    console.error(`Error saving history to JSON file for channel: ${currentChannelId}:`, error);
  }
};

export const readHistoryFromStorage = async (): Promise<ChatCompletionRequestMessage[]> => {
  try {
    const historyFilePath = getHistoryPath();
    const historyJsonStream = await downloadFileFromS3(historyFilePath);
    const historyJsonString = await readJsonStreamToString(historyJsonStream);
    return JSON.parse(historyJsonString);
  } catch (error) {
    console.error(`Error reading history from JSON file for channel: ${currentChannelId}:`, error);
    return [];
  }
};

const setCurrentSystemMessage = async (message: string): Promise<void | null> => {
  try {
    const sysMessagePath = getSystemMessagePath();
    await uploadFileToS3(sysMessagePath, message);
    console.log(`System message is successfully saved for channel: ${currentChannelId}`);
  } catch (error) {
    console.error(`Error setting current system message for channel: ${currentChannelId}:`, error);
    return null;
  }
};

const getCurrentSystemMessage = async (): Promise<string | null> => {
  try {
    const systemMsgPath = getSystemMessagePath();
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    const systemMsg = await readTextStreamToString(systemMsgS3Stream);
    return systemMsg;
  } catch (error) {
    console.error(`Error getting current system message for channel: ${currentChannelId}:`, error);
    return null;
  }
};

export const botSystemMessageChanged = async (message: string): Promise<boolean> => {
  const command = "!system ";
  if (!message.startsWith(command)) return false;
  const currentSystemMessage = message.replace(command, "");
  await resetHistoryIfNewSystemMessage(currentSystemMessage);
  await sendMessageToProperChannel(`You changed system message to: **${currentSystemMessage}**`);
  return true;
};

export const countApiResponseTokens = (currentChatHistory: ChatCompletionRequestMessage[]): number => {
  const totalTokens = currentChatHistory.map((message) => countTokens(message.content)).reduce((total, tokenValue) => total + tokenValue);
  const responseTokens = MODEL_MAX_TOKENS - totalTokens - 200;
  if (responseTokens > 2000) return responseTokens;
  chatHistory.splice(1, 2);
  return countApiResponseTokens(currentChatHistory.splice(1, 2));
};

const countTokens = (text: string): number => {
  const modelEncoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = modelEncoder.encode(text);
  modelEncoder.free();
  return tokens.length;
};

export const checkAndReturnValidResponseData = (response: CreateChatCompletionResponse): string => {
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content)
    return response.choices[0].message.content.trim();
  return genericResponse;
};

const getHistoryPath = (): string => `history/${currentChannelId}-history.json`;

const getSystemMessagePath = (): string => `history/${currentChannelId}-systemmsg`;

export { Configuration, OpenAIApi, ChatCompletionRequestMessage };
