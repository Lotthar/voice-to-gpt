import fs from "fs/promises";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Tiktoken } = require("@dqbd/tiktoken/lite");
const { load } = require("@dqbd/tiktoken/load");
const registry = require("@dqbd/tiktoken/registry.json");
const models = require("@dqbd/tiktoken/model_to_encoding.json");

export const modelName = "gpt-3.5-turbo";
export let chatHistory = [];
const model = await load(registry[models[modelName]]);

export const resetHistoryIfNewSystemMessage = (systemMessage) => {
  if (systemMessage !== null && chatHistory[0].content !== systemMessage) {
    chatHistory = [{ role: "system", content: systemMessage }];
    console.log(`Chat history has been reset. New system message: ${systemMessage}`);
  }
};

export const retrieveChatHistoryOrCreateNew = async (systemMessage, channelId) => {
  const jsonFilePath = `./history/${channelId}-history.json`;
  // if we alraedy hava an array loaded in memory, skip reading from file
  if (chatHistory.length > 0) return;
  chatHistory = await readArrayFromJsonFile(jsonFilePath);
  // if there is already history saved, we skip creating new one
  if (chatHistory !== null) return;
  // We create new history and if there is a system message set up we add it to history
  if (systemMessage === null) chatHistory = [];
  else chatHistory = [{ role: "system", content: systemMessage }];
  // save new history
  await saveChatHistory(channelId, jsonFilePath);
};

export const saveChatHistory = async (channelId, jsonFilePath) => {
  if (!jsonFilePath) jsonFilePath = `./history/${channelId}-history.json`;
  await saveArrayToJsonFile(chatHistory, jsonFilePath);
};

export const saveArrayToJsonFile = async (array, filePath) => {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    await fs.writeFile(filePath, jsonString, "utf-8");
    console.log(`Successfully saved array to ${filePath}`);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readArrayFromJsonFile = async (filePath) => {
  try {
    const jsonString = await fs.readFile(filePath, "utf-8");
    const array = JSON.parse(jsonString);
    console.log(`Successfully read array from ${filePath}`);
    return array;
  } catch (error) {
    console.log("Error reading array from JSON file:", error);
    return null;
  }
};

export const countResponseTokens = async () => {
  let totalTokens = 0;
  let tokenCount = null;
  for (const message of chatHistory) {
    tokenCount = await countTokens(message.content);
    totalTokens += tokenCount;
  }

  const responseTokens = 4096 - totalTokens - 100;
  if (responseTokens < 2000) {
    countResponseTokens(chatHistory.splice(1, 2));
  }
  if (responseTokens <= 0) {
    throw new Error("Prompt too long. Please shorten your input.");
  }
  return responseTokens;
};

const countTokens = async (text) => {
  const encoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = encoder.encode(text);
  encoder.free();
  return tokens.length;
};
