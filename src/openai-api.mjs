import { Configuration, OpenAIApi } from "openai";
import { currentChannelId } from "./bot.mjs";
import {
  retrieveChatHistoryOrCreateNew,
  resetHistoryIfNewSystemMessage,
  chatHistory,
} from "./chathistory-util.mjs";
import { sendMessageToProperChannel } from "./discord-util.mjs";
import { createRequire } from "module";
import { pushQAtoHistory } from "./chathistory-util.mjs";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);
const { Tiktoken } = require("@dqbd/tiktoken/lite");
const { load } = require("@dqbd/tiktoken/load");
const registry = require("@dqbd/tiktoken/registry.json");
const models = require("@dqbd/tiktoken/model_to_encoding.json");

const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
const modelName = "gpt-3.5-turbo";
const model = await load(registry[models[modelName]]);

export const generateOpenAIAnswer = async (question) => {
  if (question === null) return "Nothing was said or it is not understood.";
  await retrieveChatHistoryOrCreateNew(currentChannelId);
  const answer = await getOpenAiResponse(question);
  if (answer === null) return "Error in response!";
  pushQAtoHistory(question, answer, currentChannelId);
  return answer;
};

const getOpenAiResponse = async (question) => {
  try {
    let currentChatHistory = [...chatHistory, { role: "user", content: question }];
    let numResponseTokens = countApiResponseTokens(currentChatHistory);
    const response = await openai.createChatCompletion({
      model: modelName,
      messages: currentChatHistory,
      max_tokens: numResponseTokens,
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error calling Open AI API: ", error);
    return null;
  }
};

export const botSystemMessageChanged = async (message, channelId) => {
  const command = "!system ";
  if (message.startsWith(command)) {
    let currentSystemMessage = message.replace(command, "");
    await resetHistoryIfNewSystemMessage(currentSystemMessage, channelId);
    sendMessageToProperChannel(`You changed system message to: ${currentSystemMessage}`);
    return true;
  }
  return false;
};

const countApiResponseTokens = (currentChatHistory) => {
  let totalTokens = currentChatHistory
    .map((message) => countTokens(message.content))
    .reduce((total, tokenValue) => total + tokenValue);
  const responseTokens = 4096 - totalTokens - 100;
  if (responseTokens > 2000) return responseTokens;
  chatHistory.splice(1, 1);
  countApiResponseTokens(currentChatHistory.splice(1, 1));
};

const countTokens = (text) => {
  const modelEncoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = modelEncoder.encode(text);
  modelEncoder.free();
  return tokens.length;
};
