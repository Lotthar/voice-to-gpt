import fs from "fs/promises";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Tiktoken } = require("@dqbd/tiktoken/lite");
const { load } = require("@dqbd/tiktoken/load");
const registry = require("@dqbd/tiktoken/registry.json");
const models = require("@dqbd/tiktoken/model_to_encoding.json");

export const modelName = "gpt-3.5-turbo";
const model = await load(registry[models[modelName]]);

export const saveArrayToJsonFile = async (array, filePath) => {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    await fs.writeFile(filePath, jsonString, "utf-8");
    console.log(`Successfully saved array to ${filePath}`);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readArrayFromJsonFile = async (filePath) => {
  try {
    const jsonString = await fs.readFile(filePath, "utf-8");
    const array = JSON.parse(jsonString);
    console.log(`Successfully read array from ${filePath}`);
    return array;
  } catch (error) {
    console.log("Error reading array from JSON file:", error);
    return null;
  }
};

export const countResponseTokens = async (historyArray) => {
  let totalTokens = 0;
  let tokenCount = null;
  for (const message of historyArray) {
    tokenCount = await countTokens(message.content);
    totalTokens += tokenCount;
  }

  const responseTokens = 4096 - totalTokens - 100;
  if (responseTokens < 2000) {
    countResponseTokens(historyArray.splice(1, 2));
  }
  if (responseTokens <= 0) {
    throw new Error("Prompt too long. Please shorten your input.");
  }
  return responseTokens;
};

const countTokens = async (text) => {
  const encoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
  const tokens = encoder.encode(text);
  encoder.free();
  return tokens.length;
};
