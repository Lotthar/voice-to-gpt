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

export const generateOpenAIAnswer = async (transcript) => {
  if (transcript === null) return "Nothing was said or it is not understood.";
  await retrieveChatHistoryOrCreateNew(currentChannelId);
  chatHistory.push({ role: "user", content: transcript });
  const result = await getOpenAiResponse();
  if (result === null) return "Error in response!";
  chatHistory.push({ role: "assistant", content: result });
  await saveChatHistory(currentChannelId);
  return result;
};

const getOpenAiResponse = async () => {
  try {
    let numResponseTokens = await countResponseTokens(chatHistory);
    const response = await openai.createChatCompletion({
      model: modelName,
      messages: chatHistory,
      max_tokens: numResponseTokens,
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const botSystemMessageChanged = async (message, channelId) => {
  const command = "!system ";
  if (message.startsWith(command)) {
    let currentSystemMessage = message.replace(command, "");
    await resetHistoryIfNewSystemMessage(currentSystemMessage, channelId);
    sendMessageToProperChannel(
      `You successfully changed bot's system message to: ${currentSystemMessage}`
    );
    return true;
  }
  return false;
};
