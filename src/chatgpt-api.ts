import { ChatGptApiParamOptional, ChatGptResponse, genericResponse } from "./interfaces/openai.js";
import { getChatGptAPI, loadChatGPTRequestParameters, setChatHistory } from "./chatgpt-util.js";

export const generateOpenAIAnswer = async (question: string, channelId: string): Promise<string | null> => {
  if (question === null) return null;
  const { systemMessage, chatHistory, gptModel } = await loadChatGPTRequestParameters(channelId);
  let gptParams: ChatGptApiParamOptional = { timeoutMs: 2 * 60 * 1000 };
  if (systemMessage !== null) gptParams.systemMessage = systemMessage;
  if (chatHistory !== null) gptParams = { ...gptParams, ...chatHistory };
  const { answer, chatHistory: newChatHistory } = await getOpenAiResponse(question, gptModel, gptParams);
  setChatHistory(newChatHistory, channelId);
  return answer;
};

const getOpenAiResponse = async (question: string, model: string, gptParameters: ChatGptApiParamOptional): Promise<ChatGptResponse> => {
  let gptResult;
  try {
    const api = getChatGptAPI(model);
    const paramsAreEmpty = Object.keys(gptParameters).length === 0;
    if (paramsAreEmpty) gptResult = await api.sendMessage(question);
    else gptResult = await api.sendMessage(question, gptParameters);
    console.log(gptParameters.parentMessageId);
    console.log(gptResult.id);
    return { answer: gptResult.text, chatHistory: { parentMessageId: gptResult.id } };
  } catch (error: any) {
    return { answer: genericResponse, chatHistory: { parentMessageId: gptParameters.parentMessageId } };
  }
};
