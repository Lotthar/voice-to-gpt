import { downloadFileFromS3, uploadFileToS3 } from ".+";
import { readJsonStream, readTextStream } from ".+";
import { sendMessageToProperChannel } from ".+";
import { currentChannelId } from ".+";
import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
const { Tiktoken } = requireModule("@dqbd/tiktoken/lite");
const { load } = requireModule("@dqbd/tiktoken/load");
const registry = requireModule("@dqbd/tiktoken/registry.json");
const models = requireModule("@dqbd/tiktoken/model_to_encoding.json");

export const modelName = "gpt-3.5-turbo";
export const model = await load(registry[models[modelName]]);
export let chatHistory = [];

export const resetHistoryIfNewSystemMessage = async (systemMessage) => {
  const currentSystemMessage = await getCurrentSystemMessage();
  if (
    currentSystemMessage === null ||
    chatHistory.length === 0 ||
    chatHistory[0].content !== systemMessage
  ) {
    chatHistory = [{ role: "system", content: systemMessage }];
    await setCurrentSystemMessage(systemMessage);
    await saveChatHistory();
    console.log(`Chat history has been reset. New system message: ${systemMessage}`);
  }
};

export const retrieveChatHistoryOrCreateNew = async () => {
  if (chatHistory.length > 0) return;
  chatHistory = await readHistoryFromFile();
  if (chatHistory !== null) return;
  const currentSysMessage = await getCurrentSystemMessage();
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: "system", content: currentSysMessage }];
};

export const pushQAtoHistory = async (question, answer) => {
  chatHistory.push({ role: "user", content: question });
  chatHistory.push({ role: "assistant", content: answer });
  await saveChatHistory();
};

export const saveChatHistory = async () => {
  try {
    const filePath = getHistoryPath();
    const jsonString = JSON.stringify(chatHistory, null, 2);
    await uploadFileToS3(filePath, jsonString);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readHistoryFromFile = async () => {
  try {
    const filePath = getHistoryPath();
    const jsonStream = await downloadFileFromS3(filePath);
    return await readJsonStream(jsonStream);
  } catch (error) {
    console.error("Error reading array from JSON file:", error);
    return null;
  }
};

const setCurrentSystemMessage = async (message) => {
  try {
    const sysMessagePath = getSystemMessagePath();
    await uploadFileToS3(sysMessagePath, message);
  } catch (error) {
    console.error("Error setting current system message:", error);
    return null;
  }
};

const getCurrentSystemMessage = async () => {
  try {
    const systemMsgPath = getSystemMessagePath();
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    return await readTextStream(systemMsgS3Stream);
  } catch (error) {
    console.error("Error getting current system message:", error);
    return null;
  }
};

export const botSystemMessageChanged = async (message) => {
  const command = "!system ";
  if (!message.startsWith(command)) return false;
  let currentSystemMessage = message.replace(command, "");
  await resetHistoryIfNewSystemMessage(currentSystemMessage);
  await sendMessageToProperChannel(`You changed system message to: **${currentSystemMessage}**`);
  return true;
};

export const countApiResponseTokens = (currentChatHistory) => {
  let totalTokens = currentChatHistory
    .map((message) => countTokens(message.content))
    .reduce((total, tokenValue) => total + tokenValue);
  const responseTokens = 4096 - totalTokens - 200;
  if (responseTokens > 2000) return responseTokens;
  chatHistory.splice(1, 2);
  countApiResponseTokens(currentChatHistory.splice(1, 2));
};

const countTokens = (text) => {
  const modelEncoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = modelEncoder.encode(text);
  modelEncoder.free();
  return tokens.length;
};

const getHistoryPath = () => `history/${currentChannelId}-history.json`;

const getSystemMessagePath = () => `history/${currentChannelId}-systemmsg`;
