import { AssistantCreateParams } from "openai/resources/beta/assistants/assistants.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "../util/aws-s3-util.js";
import { readJsonStreamToString } from "../util/stream-util.js";
import { openai } from "./openai-api-util.js";
import { sendMessageToProperChannel } from "../discord/discord-util.js";
import { AssistantOpenAI, AssistantToolsArray, ChannelAssistantData, GPTAssistantModels } from "../types/openai.js";
import { ChatInputCommandInteraction, Message } from "discord.js";
import {
  cancelAllRuns,
  createUserMessage,
  extractAndSendAssistantMessage,
  getAssistantPath,
  isThreadInactive,
  passUserInputFilesToAssistant,
  pollForRunUntil,
  retrieveAllAssistants,
  retrieveAssistantByName,
  retrieveAssistantMessages,
} from "./openai-assistant-util.js";

export const generateAssistantAnswer = async (message: Message, messageContent: string) => {
  let assistantData = await getChannelAssistantFromStorage(message.channelId);
  if (assistantData === null) {
    await sendMessageToProperChannel(
      `Please create or select assistant for this channel before trying, use: **/assistant_change**. You can update assistant using **/assistant_update**`,
      message.channelId
    );
    return;
  }
  const currentThreadId = await getCurrentThread(assistantData, message.channelId);
  if(currentThreadId === null) {
    await sendMessageToProperChannel(
      `Looks like there is a problem with getting conversation history for this channel, please reset conversation using **!assistant_clear** command`,
      message.channelId
    );
    return;
  }
  const messageFileIds = await passUserInputFilesToAssistant(message);
  await createUserMessage(currentThreadId, messageContent, messageFileIds);
  const assistantRun = await openai.beta.threads.runs.create(currentThreadId, { assistant_id: assistantData.assistantId });
  const runCompleted = await pollForRunUntil(assistantRun.id, currentThreadId, "completed");
  if(!runCompleted) return;
  const assistantMessages = await retrieveAssistantMessages(currentThreadId, assistantRun.id);
  await extractAndSendAssistantMessage(assistantMessages, message.channelId);
};

export const listAllAssistants = async (): Promise<string> => {
  const assistants = await retrieveAllAssistants();
  let result = "## Availiable Assistants \n\n";
  assistants.forEach((assistant) => {
    result += `* **${assistant.name}(${assistant.model})** - *${assistant.instructions}* \n`;
  });
  return result;
};

export const changeAssistantForChannel = async (name: string, interaction: ChatInputCommandInteraction): Promise<void> => {
  let chosenAssistant = await retrieveAssistantByName(name);
  if (!chosenAssistant) return;
  let assistantData = { assistantId: chosenAssistant.id };
  await saveChannelAssistantInStorage(assistantData, interaction.channelId);
  const currentAssistant = await getChannelAssistantFromStorage(interaction.channelId);
  if (!!currentAssistant && !!currentAssistant.threadId) await openai.beta.threads.del(currentAssistant.threadId);
  await interaction.reply(`Selected GPT Assistant for current channel with name: **${chosenAssistant.name}**, model: **${chosenAssistant.model}** and instructions: *${chosenAssistant.instructions}* !`);
};

export const createAssistant = async (interaction: ChatInputCommandInteraction, newAssistant: AssistantOpenAI) => {
  try {
    const createParams: AssistantCreateParams = {
      name: newAssistant.name,
      instructions: newAssistant.instructions,
      model: newAssistant.model ?? GPTAssistantModels[1],
      tools: newAssistant.tools,
    };
    const createadAssistant = await openai.beta.assistants.create(createParams);
    await interaction.reply(`You **created** a new GPT Assistant named: **${createadAssistant.name}**, model: **${createadAssistant.model}**, tools: **${JSON.stringify(createadAssistant.tools.map(t => t.type))}**, instructions: *${createadAssistant.instructions}*`);
  } catch (error) {
    console.error(`Error creating assistant for channel: ${interaction.channelId}`, error);
    await interaction.reply({content: `Error creating assistant!`, ephemeral: true});
  }
  
};

export const updateAssistant = async (interaction: ChatInputCommandInteraction, newAssistant: AssistantOpenAI) => {
  try {
    let updateParams: Record<string,string | AssistantToolsArray> = {};
    if (!newAssistant.name) return;
    if (!!newAssistant.instructions) updateParams.instructions = newAssistant.instructions;
    if (!!newAssistant.tools) updateParams.tools = newAssistant.tools;
    const currentAssistant = await retrieveAssistantByName(newAssistant.name);
    if(!currentAssistant) {
      await interaction.reply(`There is no GPT Assistant with name: **${newAssistant.name}**!`);
      return;
    }
    if (!!newAssistant.model) updateParams.model = newAssistant.model;
    else updateParams.model = currentAssistant.model;
    const updatedAssistant = await openai.beta.assistants.update(currentAssistant.id, updateParams);
    await interaction.reply(`You **updated** GPT Assistant wuth name: **${updatedAssistant.name}** model: **${updatedAssistant.model}**, tools: **${JSON.stringify(updatedAssistant.tools.map(t => t.type))}** and instructions: *${updatedAssistant.instructions}*`);
  } catch (error) {
    console.error(`Error updating assistant for channel: ${interaction.channelId}`, error);
    await interaction.reply(`Error updating assistant!`);
  }
};

export const deleteAssistantByName = async (name: string, interaction: ChatInputCommandInteraction): Promise<void> => {
  try {
    let chosenAssistant = await retrieveAssistantByName(name);
    if (!chosenAssistant) return;
    await openai.beta.assistants.del(chosenAssistant.id);
    await interaction.reply(`GPT Assistant with the name: **${chosenAssistant.name}** successfully **deleted**!`);
  } catch (error) {
    console.log(error);
    await interaction.reply(`Error deleting assistant which name starts with: **${name}**`);
  }
};

export const resetAssistantThread = async (interaction: ChatInputCommandInteraction) => {
  let assistantData = await getChannelAssistantFromStorage(interaction.channelId);
  if (assistantData === null) return false;
  await resetCurrentThread(assistantData, interaction.channelId);
  await interaction.reply(`You have **cleared** your conversation so far with GPT Assistant, please star over!`);
  return true;
};

export const stopAssistantThreadRuns = async (interaction: ChatInputCommandInteraction) => {
  let assistantData = await getChannelAssistantFromStorage(interaction.channelId);
  if (assistantData === null) {
    return true;
  }
  if(assistantData.threadId === null) {
    await interaction.reply(`Current assistant has no tasks to be stoped!`);
    return true;
  }
  await cancelAllRuns(assistantData.threadId!);
  await interaction.reply(`You have **stopped** all GPT Assistant's tasks!`);
  return true;
};



export const saveChannelAssistantInStorage = async (assistantData: ChannelAssistantData, channelId: string): Promise<void> => {
  try {
    const filePath = getAssistantPath(channelId);
    const jsonString = JSON.stringify(assistantData);
    await uploadFileToS3(filePath, jsonString);
    console.log(`GPT Assistant data has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving GPT Assistant data to JSON file for channel: ${channelId}:`, error);
  }
};

export const getChannelAssistantFromStorage = async (channelId: string): Promise<ChannelAssistantData | null> => {
  try {
    const assistantPath = getAssistantPath(channelId);
    const assistantsJsonStream = await downloadFileFromS3(assistantPath);
    const assistantJsonString = await readJsonStreamToString(assistantsJsonStream);
    return JSON.parse(assistantJsonString);
  } catch (error) {
    console.error(`Error reading GPT Assistants data from JSON file for channel: ${channelId}:`, error);
    return null;
  }
};

const getCurrentThread = async (assistantData: ChannelAssistantData, channelId: string) => {
  try {
    if (!assistantData.threadId || (await isThreadInactive(assistantData.threadId))) {
      const thread = await openai.beta.threads.create();
      assistantData.threadId = thread.id;
      await saveChannelAssistantInStorage(assistantData, channelId);
    }
    console.log(`Working with threadId: ${assistantData.threadId} for channel: ${channelId}`);
    return assistantData.threadId;
  } catch (error) {
    console.error(`Error while getting current thread for channel: ${channelId}`, error);
    return null;
  }
};

const resetCurrentThread = async (assistantData: ChannelAssistantData, channelId: string) => {
  try {
    const newThread = await openai.beta.threads.create();
    if (!!assistantData.threadId) await openai.beta.threads.del(assistantData.threadId);
    assistantData.threadId = newThread.id;
    await saveChannelAssistantInStorage(assistantData, channelId);
    return assistantData.threadId;
  } catch (error) {
    console.log(`Error reseting thread for channel: ${channelId}`, error);
    await sendMessageToProperChannel("Error reseting current conversation!", channelId);
  }
};
