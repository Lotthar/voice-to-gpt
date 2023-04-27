import {
  loadChatHistoryOrCreateNew,
  chatHistory,
  countApiResponseTokens,
  modelName,
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

export const generateOpenAIAnswer = async (question: string) => {
  if (question === null) return null;
  await loadChatHistoryOrCreateNew();
  const answer = await getOpenAiResponse(question);
  if (answer === null) return null;
  pushQAtoHistory(question, answer);
  return answer;
};

const getOpenAiResponse = async (question: string): Promise<string> => {
  try {
    const currentChatHistory: ChatCompletionRequestMessage[] = [...chatHistory, { role: "user", content: question }];
    let numResponseTokens = countApiResponseTokens(currentChatHistory);
    const response = await openai.createChatCompletion({
      model: modelName,
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
