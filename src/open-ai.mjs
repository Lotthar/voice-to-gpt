import { Configuration, OpenAIApi } from "openai";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// Set up your API key and model ID
const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);
const conversationId = uuidv4();
const chatHistory = [];

/**
 *
 * 	Use OpenAI API to generate response based on text input
 *
 * @param {*} transcript - text send to OpenAI API
 * @returns - OpenAI response text
 */
export const generateOpenAIAnswer = async (transcript) => {
  console.log(`Getting Open AI answer for "${transcript}"`);
  chatHistory.push(transcript);
  const openAIresponse = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Conversation with ${conversationId}\n\n${chatHistory.join("\n")}\n\n${transcript}`,
    max_tokens: 1024,
    temperature: 0,
  });
  let result = openAIresponse.data.choices[0].text;
  console.log(`OpenAI answer: ${result}`);
  return result;
};
