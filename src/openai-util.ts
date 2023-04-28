import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.js";
import { readJsonStreamToString, readTextStreamToString } from "./stream-util.js";
import { sendMessageToProperChannel } from "./discord-util.js";
import { currentChannelId } from "./bot.js";
import { Tiktoken, load, registry, models, ChatCompletionRequestMessageRoleEnum } from "./interfaces/openai.js";
import { Configuration, OpenAIApi, ChatCompletionRequestMessage, CreateChatCompletionResponse } from "openai";

export const modelName: string = "gpt-3.5-turbo";
export const model = await load(registry[models[modelName]]);
export let chatHistory: ChatCompletionRequestMessage[] = [];
export const genericResponse = "The answer is not generated properly!";

export const resetHistoryIfNewSystemMessage = async (systemMessage: string) => {
  const currentSystemMessage = await getCurrentSystemMessage();
  if (currentSystemMessage === null || chatHistory?.length === 0 || chatHistory[0].content !== systemMessage) {
    chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: systemMessage }];
    await setCurrentSystemMessage(systemMessage);
    await saveChatHistory();
    console.log(`Chat history has been reset. New system message: ${systemMessage}`);
  }
};

export const loadChatHistoryOrCreateNew = async (): Promise<void> => {
  if (chatHistory.length > 0) return;
  chatHistory = await readHistoryFromStorage();
  if (chatHistory !== null) return;
  const currentSysMessage = await getCurrentSystemMessage();
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: ChatCompletionRequestMessageRoleEnum.System, content: currentSysMessage }];
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
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readHistoryFromStorage = async (): Promise<ChatCompletionRequestMessage[]> => {
  try {
    const historyFilePath = getHistoryPath();
    const historyJsonStream = await downloadFileFromS3(historyFilePath);
    const historyJsonString = await readJsonStreamToString(historyJsonStream);
    return JSON.parse(historyJsonString);
  } catch (error) {
    console.error("Error reading array from JSON file:", error);
    return [];
  }
};

const setCurrentSystemMessage = async (message: string): Promise<void | null> => {
  try {
    const sysMessagePath = getSystemMessagePath();
    await uploadFileToS3(sysMessagePath, message);
  } catch (error) {
    console.error("Error setting current system message:", error);
    return null;
  }
};

const getCurrentSystemMessage = async (): Promise<string | null> => {
  try {
    const systemMsgPath = getSystemMessagePath();
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    return await readTextStreamToString(systemMsgS3Stream);
  } catch (error) {
    console.error("Error getting current system message:", error);
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
  const responseTokens = 4096 - totalTokens - 200;
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
