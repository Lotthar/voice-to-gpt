import { Configuration, OpenAIApi } from "openai";
import { currentChannelId } from "./index.mjs";
import { saveArrayToJsonFile, readArrayFromJsonFile } from "./chathistory-util.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { countResponseTokens, modelName } from "./chathistory-util.mjs";
import dotenv from "dotenv";

dotenv.config();
// Set up your API key and model ID
const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
let chatHistory = [];
let currentSystemMessage = null;

/**
 *
 * 	Use OpenAI API to generate response based on text input
 *
 * @param {*} transcript - text send to OpenAI API
 * @returns - OpenAI response text
 */
export const generateOpenAIAnswer = async (transcript) => {
  await retrieveChatHistoryOrCreateNew();
  resetHistoryIfNewSystemMessage();
  chatHistory.push({ role: "user", content: transcript });
  const result = await getOpenAiResponse();
  if (result === null) return "Error in response!";
  chatHistory.push({ role: "assistant", content: result });
  await saveChatHistory();
  return result;
};

const getOpenAiResponse = async () => {
  let result = null;
  let numResponseTokens = await countResponseTokens(chatHistory);
  try {
    const response = await openai.createChatCompletion({
      model: modelName,
      messages: chatHistory,
      max_tokens: numResponseTokens,
    });
    result = response.data.choices[0].message.content.trim();
  } catch (error) {
    console.log(error);
  } finally {
    return result;
  }
};

export const setBotSystemMessageIfChanged = (message) => {
  const command = "!system ";
  if (message.startsWith(command)) {
    currentSystemMessage = message.replace(command, "");
    sendMessageToProperChannel(
      `You successfully changed bot's system message to: ${currentSystemMessage}`
    );
    return true;
  }
  return false;
};

const resetHistoryIfNewSystemMessage = () => {
  if (currentSystemMessage !== null && chatHistory[0].content !== currentSystemMessage) {
    chatHistory = [{ role: "system", content: currentSystemMessage }];
    console.log(`Chat history has been reset. New system message: ${currentSystemMessage}`);
  }
};

const retrieveChatHistoryOrCreateNew = async () => {
  const jsonFilePath = `./history/${currentChannelId}-history.json`;
  if (chatHistory.length > 0) return;
  chatHistory = await readArrayFromJsonFile(jsonFilePath);
  if (chatHistory !== null) return;
  chatHistory = [{ role: "system", content: currentSystemMessage }];
  await saveChatHistory(jsonFilePath);
};

const saveChatHistory = async (jsonFilePath) => {
  if (!jsonFilePath) jsonFilePath = `./history/${currentChannelId}-history.json`;
  await saveArrayToJsonFile(chatHistory, jsonFilePath);
};
