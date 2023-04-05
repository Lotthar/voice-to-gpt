import { Configuration, OpenAIApi } from "openai";
import { currentChannelId } from "./bot.mjs";
import {
  retrieveChatHistoryOrCreateNew,
  resetHistoryIfNewSystemMessage,
  saveChatHistory,
  chatHistory,
} from "./chathistory-util.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { countResponseTokens, modelName } from "./chathistory-util.mjs";
import dotenv from "dotenv";

dotenv.config();
// Set up your API key and model ID
const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
let currentSystemMessage = null;

export const generateOpenAIAnswer = async (transcript) => {
  if (transcript === null) return "Nothing was said or it is not understood.";
  await retrieveChatHistoryOrCreateNew(currentSystemMessage, currentChannelId);
  resetHistoryIfNewSystemMessage(currentSystemMessage);
  chatHistory.push({ role: "user", content: transcript });
  const result = await getOpenAiResponse();
  if (result === null) return "Error in response!";
  chatHistory.push({ role: "assistant", content: result });
  await saveChatHistory(currentChannelId);
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

export const botSystemMessageChanged = (message) => {
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
