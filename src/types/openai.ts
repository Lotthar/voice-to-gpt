import { EmbedBuilder } from "discord.js";
import { createRequire } from "module";
import { CodeInterpreterTool } from "openai/resources/beta/assistants.mjs";
import { MessageCreateParams } from "openai/resources/beta/threads/messages.mjs";

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

// export type AssistantToolsArray = Array<
// | AssistantUpdateParams.AssistantToolsCode
// | AssistantUpdateParams.AssistantToolsRetrieval
// | AssistantUpdateParams.AssistantToolsFunction>

export interface AssistantFile {
  name: string,
  file: Buffer
}

export type AssistantFileType = "image" | "file";

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

export const AssistantTools: (CodeInterpreterTool | MessageCreateParams.Attachment.FileSearch)[] = [{ type: "code_interpreter" }, { type: "file_search" }];

export const GPTModels = ["gpt-3.5-turbo", "gpt-4"];
export const GPTAssistantModels = ["gpt-3.5-turbo-1106", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"];

export const genericResponse = "The answer is not generated properly!";



const requireModule = createRequire(import.meta.url);
const { Tiktoken } = requireModule("@dqbd/tiktoken/lite");
const { load } = requireModule("@dqbd/tiktoken/load");
const registry = requireModule("@dqbd/tiktoken/registry.json");
const models = requireModule("@dqbd/tiktoken/model_to_encoding.json");

export { Tiktoken, load, registry, models };
