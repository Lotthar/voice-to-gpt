import { genericResponse } from "./interfaces/openai.js";
import {
  loadChatHistoryOrCreateNew,
  countApiResponseTokens,
  pushQAtoHistory,
  checkAndReturnValidResponseData,
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  getChatGptModel,
} from "./openai-util.js";
import dotenv from "dotenv";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const generateOpenAIAnswer = async (question: string, channelId: string): Promise<string> => {
  if (question === null) return genericResponse;
  const chatHistory = await loadChatHistoryOrCreateNew(channelId);
  const { modelName, model } = await getChatGptModel(channelId);
  const answer = await getOpenAiResponse(question, modelName, model, chatHistory);
  if (answer === null) return genericResponse;
  pushQAtoHistory(question, answer, channelId, chatHistory);
  return answer;
};

const getOpenAiResponse = async (
  question: string,
  modelName: string,
  model: any,
  chatHistory: Array<ChatCompletionRequestMessage>
): Promise<string | null> => {
  try {
    const currentChatHistory: ChatCompletionRequestMessage[] = [...chatHistory, { role: "user", content: question }];
    let numResponseTokens = await countApiResponseTokens(currentChatHistory, model, modelName);
    const response = await openai.createChatCompletion({
      model: modelName,
      messages: currentChatHistory,
      max_tokens: numResponseTokens,
    });
    if (!response || response.status !== 200) return genericResponse;
    return checkAndReturnValidResponseData(response.data);
  } catch (error) {
    console.error("Error calling Open AI API: ", error);
    return null;
  }
};
