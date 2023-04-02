import { Configuration, OpenAIApi } from "openai";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// Set up your API key and model ID
const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

const chatHistory = [{ role: "system", content: `You are a JavaScript developer.` }];

/**
 *
 * 	Use OpenAI API to generate response based on text input
 *
 * @param {*} transcript - text send to OpenAI API
 * @returns - OpenAI response text
 */
export const generateOpenAIAnswer = async (transcript) => {
  // TODO: chat history da se pamti u neki fajl i da ga ako je prazan uvijek popuni
  chatHistory.push({ role: "user", content: transcript });
  let result = "";
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: chatHistory,
      max_tokens: 2000,
    });
    result = response.data.choices[0].message.content.trim();
    chatHistory.push({ role: "assistant", content: result });
  } catch (error) {
    console.error(error);
  } finally {
    return result;
  }
};
