import {
  loadChatHistoryOrCreateNew,
  chatHistory,
  countApiResponseTokens,
  MODEL_NAME,
  pushQAtoHistory,
  checkAndReturnValidResponseData,
  genericResponse,
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
} from "./openai-util.js";
import dotenv from "dotenv";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const generateOpenAIAnswer = async (question: string, channelId: string): Promise<string | null> => {
  if (question === null) return null;
  await loadChatHistoryOrCreateNew(channelId);
  const answer = await getOpenAiResponse(question);
  if (answer === null) return null;
  pushQAtoHistory(question, answer, channelId);
  return answer;
};

const getOpenAiResponse = async (question: string): Promise<string> => {
  try {
    const currentChatHistory: ChatCompletionRequestMessage[] = [...chatHistory, { role: "user", content: question }];
    let numResponseTokens = countApiResponseTokens(currentChatHistory);
    const response = await openai.createChatCompletion({
      model: MODEL_NAME,
      messages: currentChatHistory,
      max_tokens: numResponseTokens,
    });
    if (!response || response.status !== 200) return genericResponse;
    return checkAndReturnValidResponseData(response.data);
  } catch (error) {
    console.error("Error calling Open AI API: ", error);
    return genericResponse;
  }
};
