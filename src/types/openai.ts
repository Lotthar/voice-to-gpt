import { EmbedBuilder } from "discord.js";
import { createRequire } from "module";
import { AssistantUpdateParams } from "openai/resources/beta/assistants/assistants.mjs";


export interface OpenAiMessage {
  role: "system" | "assistant" | "user";
  content: string;
}

export interface GptModelData {
  modelName: string;
  model: any;
}
export interface ChannelAssistantData {
  assistantId: string,
  threadId?: string,
}

export type AssistantToolsArray = Array<
| AssistantUpdateParams.AssistantToolsCode
| AssistantUpdateParams.AssistantToolsRetrieval
| AssistantUpdateParams.AssistantToolsFunction>

export interface AssistantOpenAI {
  assistantId?: string,
  name: string,
  instructions?: string,
  model?: string
  tools?: AssistantToolsArray
}

export interface AssistantFile {
  name: string,
  file: Buffer
}

export interface ImageEmbed {
  image: {
      url: string;
  };
}

export interface GeneratedImageResponse {
  embeds: EmbedBuilder[];
  content: string;
  url: string;
}

export const GPTModels = ["gpt-3.5-turbo", "gpt-4"];
export const GPTAssistantModels = ["gpt-4-1106-preview", "gpt-3.5-turbo-1106"];

export const genericResponse = "The answer is not generated properly!";

const requireModule = createRequire(import.meta.url);
const { Tiktoken } = requireModule("@dqbd/tiktoken/lite");
const { load } = requireModule("@dqbd/tiktoken/load");
const registry = requireModule("@dqbd/tiktoken/registry.json");
const models = requireModule("@dqbd/tiktoken/model_to_encoding.json");

export { Tiktoken, load, registry, models };
