import { genericResponse } from "../types/openai.js";
import {OpenAI} from "openai";
import {
  loadChatHistoryOrCreateNew,
  countApiResponseTokens,
  pushQAtoHistory,
  checkAndReturnValidResponseData,
  getChatGptModel,
  openai
} from "../util/openai-api-util.js";
import { sendMessageToProperChannel } from "../discord/discord-util.js";

export const generateOpenAIAnswer = async (question: string, channelId: string): Promise<string> => {
  if (question === null) {
    await sendMessageToProperChannel(genericResponse, channelId);
    return genericResponse;
  }
  const chatHistory = await loadChatHistoryOrCreateNew(channelId);
  const { modelName, model } = await getChatGptModel(channelId);
  const answer = await getOpenAiResponse(question, modelName, model, chatHistory);
  if (answer === null) {
    await sendMessageToProperChannel(genericResponse, channelId);
    return genericResponse;
  }
  pushQAtoHistory(question, answer, channelId, chatHistory);
  await sendMessageToProperChannel(answer, channelId);
  return answer;
};

const getOpenAiResponse = async (
  question: string,
  modelName: string,
  model: any,
  chatHistory: Array<OpenAI.Chat.ChatCompletionMessageParam>
): Promise<string | null> => {
  try {
    const currentChatHistory:  Array<OpenAI.Chat.ChatCompletionMessageParam> = [...chatHistory, { role: "user", content: question }];
    let numResponseTokens = await countApiResponseTokens(currentChatHistory, model, modelName);
    const { data: chatCompletion, response: raw } = await openai.chat.completions.create({
      model: modelName,
      messages: currentChatHistory,
      max_tokens: numResponseTokens,
    }).withResponse();;
    if (!raw || raw.status !== 200) return genericResponse;
    return checkAndReturnValidResponseData(chatCompletion);
  } catch (error) {
    console.error("Error calling Open AI API: ", error);
    return null;
  }
};
