import fs from "fs/promises";
import { createRequire } from "module";
import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.mjs";
const require = createRequire(import.meta.url);
const { Tiktoken } = require("@dqbd/tiktoken/lite");
const { load } = require("@dqbd/tiktoken/load");
const registry = require("@dqbd/tiktoken/registry.json");
const models = require("@dqbd/tiktoken/model_to_encoding.json");

export const modelName = "gpt-3.5-turbo";
export let chatHistory = [];
const model = await load(registry[models[modelName]]);

export const resetHistoryIfNewSystemMessage = async (systemMessage, channelId) => {
  const currentSystemMessage = await getCurrentSystemMessage(channelId);
  if (
    currentSystemMessage === null ||
    chatHistory.length === 0 ||
    chatHistory[0].content !== systemMessage
  ) {
    chatHistory = [{ role: "system", content: systemMessage }];
    await setCurrentSystemMessage(systemMessage, channelId);
    await saveChatHistory(channelId);
    console.log(`Chat history has been reset. New system message: ${systemMessage}`);
  }
};

export const retrieveChatHistoryOrCreateNew = async (channelId) => {
  const jsonFilePath = getHistoryPath(channelId);
  // if we alraedy hava an array loaded in memory, skip reading from file
  if (chatHistory.length > 0) return;
  chatHistory = await readArrayFromJsonFile(jsonFilePath);
  if (chatHistory !== null) return;
  // We create new history and if there is a system message set up we add it to history
  const currentSysMessage = await getCurrentSystemMessage(channelId);
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: "system", content: currentSysMessage }];
};

export const saveChatHistory = async (channelId, jsonFilePath) => {
  if (!jsonFilePath) jsonFilePath = getHistoryPath(channelId);
  await saveArrayToJsonFile(chatHistory, jsonFilePath);
};

export const saveArrayToJsonFile = async (array, filePath) => {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    await uploadFileToS3(filePath, jsonString);
    console.log(`Successfully saved array to ${filePath}`);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readArrayFromJsonFile = async (filePath) => {
  try {
    const jsonStream = await downloadFileFromS3(filePath);
    let jsonArray = await readJsonStream(jsonStream);
    console.log(`Successfully read array from ${filePath}`);
    return jsonArray;
  } catch (error) {
    console.log("Error reading array from JSON file:", error);
    return null;
  }
};

const setCurrentSystemMessage = async (message, channelId) => {
  try {
    const sysMessagePath = getSystemMessagePath(channelId);
    await uploadFileToS3(sysMessagePath, message);
  } catch (error) {
    console.log("Error setting current system message:", error);
    return null;
  }
};

const getCurrentSystemMessage = async (channelId) => {
  try {
    const systemMsgPath = getSystemMessagePath(channelId);
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    return await readSystemMessageStream(systemMsgS3Stream);
  } catch (error) {
    console.log("Error getting current system message:", error);
    return null;
  }
};

const readJsonStream = async (stream) => {
  return new Promise((resolve, reject) => {
    let jsonString = "";
    stream
      .on("data", (chunk) => (jsonString += chunk.toString()))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(JSON.parse(jsonString)));
  });
};

const readSystemMessageStream = async (stream) => {
  return new Promise((resolve, reject) => {
    let message = "";
    stream
      .on("data", (chunk) => (message += chunk.toString()))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(message));
  });
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

const getHistoryPath = (channelId) => `history/${channelId}-history.json`;

const getSystemMessagePath = (channelId) => `history/${channelId}-systemmsg`;
