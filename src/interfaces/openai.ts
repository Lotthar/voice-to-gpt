export interface ChatGptApiParamOptional {
  parentMessageId?: string;
  systemMessage?: string;
  timeoutMs?: number;
}
// `${systemMessage} Current date: ${new Date().toISOString()}\n\n`

export interface ChatHistory {
  parentMessageId?: string;
  conversationId?: string;
}

export interface ChatGptApiParams {
  chatHistory: ChatHistory | null;
  systemMessage: string | null;
  gptModel: string;
}

export interface ChatGptResponse {
  answer: string;
  chatHistory: ChatHistory;
}

export const GPTModels = ["gpt-3.5-turbo", "gpt-4"];

export const genericResponse = "The answer is not generated properly!";
