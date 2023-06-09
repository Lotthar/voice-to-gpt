import { createRequire } from "module";
import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";

export interface OpenAiMessage {
  role: "system" | "assistant" | "user";
  content: string;
}

export interface GptModelData {
  modelName: string;
  model: any;
}

export const GPTModels = ["gpt-3.5-turbo", "gpt-4"];

export const genericResponse = "The answer is not generated properly!";

const requireModule = createRequire(import.meta.url);
const { Tiktoken } = requireModule("@dqbd/tiktoken/lite");
const { load } = requireModule("@dqbd/tiktoken/load");
const registry = requireModule("@dqbd/tiktoken/registry.json");
const models = requireModule("@dqbd/tiktoken/model_to_encoding.json");

export { Tiktoken, load, registry, models, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum };
