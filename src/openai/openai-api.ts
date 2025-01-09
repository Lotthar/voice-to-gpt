import { genericResponse } from "../types/openai.js";
import {OpenAI} from "openai";
import {
  loadChatHistoryOrCreateNew,
  countApiResponseTokens,
  pushQAtoHistory,
  checkAndReturnValidResponseData,
  getChatGptModel,
  openai
} from "./openai-api-util.js";
import { sendInteractionMessageInParts, sendMessageToProperChannel } from "../discord/discord-util.js";
import { ChatInputCommandInteraction } from "discord.js";

export const generateOpenAIAnswer = async (question: string, interaction: ChatInputCommandInteraction): Promise<void> => {
  const chatHistory = await loadChatHistoryOrCreateNew(interaction.channelId);
  const { modelName, model } = await getChatGptModel(interaction.channelId);
  const answer = await getOpenAiResponse(question, modelName, model, chatHistory);
  if (answer === null) {
    await sendInteractionMessageInParts("There answer was an error and answer didn't generate!", interaction, false);
    return;
  }
  pushQAtoHistory(question, answer, interaction.channelId, chatHistory);
  await sendInteractionMessageInParts(answer, interaction, false);
};

export const generateOpenAIAnswerFromTranscript = async (question: string, channelId: string): Promise<string> => {
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
