import { Configuration, OpenAIApi } from "openai";
import {
  retrieveChatHistoryOrCreateNew,
  chatHistory,
  countApiResponseTokens,
  modelName,
} from "./openai-util.mjs";
import { pushQAtoHistory } from "./openai-util.mjs";
import dotenv from "dotenv";
import { currentVoice } from "./fy-tts-api.mjs";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const generateOpenAIAnswer = async (question) => {
  if (question === null) return null;
  await retrieveChatHistoryOrCreateNew();
  const answer = await getOpenAiResponse(question);
  if (answer === null) return null;
  pushQAtoHistory(question, answer);
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
