import { createRequire } from "module";

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

export interface AssistantOpenAI {
  assistantId?: string,
  name: string,
  instructions: string,
  model: string
  tools?: Array<AssistantTool>
}

export interface AssistantTool {
  type: "code_interpreter" | "retrieval"
}

export interface AssistantFile {
  name: string,
  file: Buffer
}

export const GPTModels = ["gpt-3.5-turbo", "gpt-4"];
export const GPTAssistantModels = ["gpt-4-1106-preview", "gpt-3.5-turbo-1106"];
export const GPTAssistantOptions = ["name", "instructions", "model"];

export const genericResponse = "The answer is not generated properly!";

const requireModule = createRequire(import.meta.url);
const { Tiktoken } = requireModule("@dqbd/tiktoken/lite");
const { load } = requireModule("@dqbd/tiktoken/load");
const registry = requireModule("@dqbd/tiktoken/registry.json");
const models = requireModule("@dqbd/tiktoken/model_to_encoding.json");

export { Tiktoken, load, registry, models };
