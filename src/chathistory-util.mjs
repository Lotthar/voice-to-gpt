import { downloadFileFromS3, uploadFileToS3 } from "./aws-s3-util.mjs";
import { readJsonStream, readTextStream } from "./stream-util.mjs";

export let chatHistory = [];

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
  chatHistory = await readHistoryFromJsonFile(jsonFilePath);
  if (chatHistory !== null) return;
  // We create new history and if there is a system message set up we add it to history
  const currentSysMessage = await getCurrentSystemMessage(channelId);
  if (currentSysMessage === null) chatHistory = [];
  else chatHistory = [{ role: "system", content: currentSysMessage }];
};

export const saveChatHistory = async (channelId, jsonFilePath) => {
  if (!jsonFilePath) jsonFilePath = getHistoryPath(channelId);
  await saveHistoryToJsonFile(chatHistory, jsonFilePath);
};

export const pushQAtoHistory = async (question, answer, channelId) => {
  chatHistory.push({ role: "user", content: question });
  chatHistory.push({ role: "assistant", content: answer });
  await saveChatHistory(channelId);
};

export const saveHistoryToJsonFile = async (array, filePath) => {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    await uploadFileToS3(filePath, jsonString);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readHistoryFromJsonFile = async (filePath) => {
  try {
    const jsonStream = await downloadFileFromS3(filePath);
    return await readJsonStream(jsonStream);
  } catch (error) {
    console.error("Error reading array from JSON file:", error);
    return null;
  }
};

const setCurrentSystemMessage = async (message, channelId) => {
  try {
    const sysMessagePath = getSystemMessagePath(channelId);
    await uploadFileToS3(sysMessagePath, message);
  } catch (error) {
    console.error("Error setting current system message:", error);
    return null;
  }
};

const getCurrentSystemMessage = async (channelId) => {
  try {
    const systemMsgPath = getSystemMessagePath(channelId);
    const systemMsgS3Stream = await downloadFileFromS3(systemMsgPath);
    return await readTextStream(systemMsgS3Stream);
  } catch (error) {
    console.error("Error getting current system message:", error);
    return null;
  }
};

const getHistoryPath = (channelId) => `history/${channelId}-history.json`;

const getSystemMessagePath = (channelId) => `history/${channelId}-systemmsg`;
