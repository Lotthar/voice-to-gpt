import { openai } from "./openai-api-util.js";
import { sendInteractionMessageInParts } from "../discord/discord-util.js";
import { AssistantFileType, AssistantTools, ChannelAssistantData, GPTAssistantModels } from "../types/openai.js";
import { ChatInputCommandInteraction } from "discord.js";
import {
  cancelAllRuns,
  createAssistantRun,
  createUserMessage,
  extractAndSendAssistantMessage,
  getAssistantSavedConversationData,
  getChannelAssistantFromStorage,
  passUserInputFilesToAssistant,
  retrieveAllAssistants,
  retrieveAssistantByName,
  retrieveAssistantMessages,
  saveChannelAssistantInStorage,
} from "./openai-assistant-util.js";
import { AssistantCreateParams, AssistantTool, AssistantUpdateParams } from "openai/resources/beta/assistants.mjs";

export const generateAssistantAnswer = async (interaction: ChatInputCommandInteraction, question: string, files: Map<string, AssistantFileType>) => {
  const assistantSavedData = await getAssistantSavedConversationData(interaction);
  if (assistantSavedData === null) return;
  const { currentThreadId, assistantData } = assistantSavedData;
  const assistantFileTypesById = await passUserInputFilesToAssistant(files, interaction);
  await createUserMessage(currentThreadId, question, assistantFileTypesById);
  try {
    const assistantRun = await createAssistantRun(currentThreadId, assistantData.assistantId, "completed");
    const assistantMessages = await retrieveAssistantMessages(currentThreadId, assistantRun.id);
    await extractAndSendAssistantMessage(assistantMessages, interaction);
  } catch (error) {
    console.error(error);
    await sendInteractionMessageInParts("Something went wrong while generating Assistant answer, please try again!", interaction, false);
  }
};

export const listAllAssistants = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const assistants = await retrieveAllAssistants();
  let result = "## Availiable Assistants \n\n";
  assistants.forEach((assistant) => {
    result += `* **${assistant.name}(${assistant.model})** - *${assistant.instructions}* \n`;
  });
  await sendInteractionMessageInParts(result, interaction, true);
};

export const changeAssistantForChannel = async (name: string, interaction: ChatInputCommandInteraction): Promise<void> => {
  let chosenAssistant = await retrieveAssistantByName(name);
  if (!chosenAssistant) return;
  let assistantData = { assistantId: chosenAssistant.id };
  await saveChannelAssistantInStorage(assistantData, interaction.channelId);
  const currentAssistant = await getChannelAssistantFromStorage(interaction.channelId);
  if (!!currentAssistant && !!currentAssistant.threadId) await openai.beta.threads.del(currentAssistant.threadId);
  await sendInteractionMessageInParts(
    `Selected GPT Assistant for current channel with name: **${chosenAssistant.name}**, model: **${chosenAssistant.model}** and instructions: *${chosenAssistant.instructions}* !`,
    interaction,
    true
  );
};

export const createAssistant = async (interaction: ChatInputCommandInteraction, newAssistant: AssistantCreateParams) => {
  try {
    const createParams = {
      name: newAssistant.name,
      instructions: newAssistant.instructions,
      model: newAssistant.model ?? GPTAssistantModels[1],
      tools: AssistantTools,
    };
    const createadAssistant = await openai.beta.assistants.create(createParams);
    await sendInteractionMessageInParts(
      `You **created** a new GPT Assistant named: **${createadAssistant.name}**, model: **${createadAssistant.model}**, tools: **${JSON.stringify(
        createadAssistant.tools.map((t) => t.type)
      )}**, instructions: *${createadAssistant.instructions}*`,
      interaction,
      true
    );
  } catch (error) {
    console.error(`Error creating assistant for channel: ${interaction.channelId}`, error);
    await sendInteractionMessageInParts("Error creating assistant!", interaction, true);
  }
};

export const updateAssistant = async (interaction: ChatInputCommandInteraction, newAssistant: AssistantUpdateParams) => {
  try {
    let updateParams: Record<string, string | AssistantTool[]> = {};
    if (!newAssistant.name) return;
    if (!!newAssistant.instructions) updateParams.instructions = newAssistant.instructions;
    if (!!newAssistant.tools) updateParams.tools = newAssistant.tools;
    const currentAssistant = await retrieveAssistantByName(newAssistant.name);
    if (!currentAssistant) {
      await sendInteractionMessageInParts(`There is no GPT Assistant with name: **${newAssistant.name}**!`, interaction, true);
      return;
    }
    if (!!newAssistant.model) updateParams.model = newAssistant.model;
    else updateParams.model = currentAssistant.model;
    const updatedAssistant = await openai.beta.assistants.update(currentAssistant.id, updateParams);
    await sendInteractionMessageInParts(
      `You **updated** GPT Assistant wuth name: **${updatedAssistant.name}** model: **${updatedAssistant.model}**, tools: **${JSON.stringify(
        updatedAssistant.tools.map((t) => t.type)
      )}** and instructions: *${updatedAssistant.instructions}*`,
      interaction,
      true
    );
  } catch (error) {
    console.error(`Error updating assistant for channel: ${interaction.channelId}`, error);
    await sendInteractionMessageInParts(`Error updating assistant!`, interaction, true);
  }
};

export const deleteAssistantByName = async (name: string, interaction: ChatInputCommandInteraction): Promise<void> => {
  try {
    let chosenAssistant = await retrieveAssistantByName(name);
    if (!chosenAssistant) return;
    await openai.beta.assistants.del(chosenAssistant.id);
    await sendInteractionMessageInParts(`GPT Assistant with the name: **${chosenAssistant.name}** successfully **deleted**!`, interaction, true);
  } catch (error) {
    console.log(error);
    await sendInteractionMessageInParts(`Error deleting assistant which name starts with: **${name}**`, interaction, true);
  }
};

export const resetAssistantThread = async (interaction: ChatInputCommandInteraction) => {
  let assistantData = await getChannelAssistantFromStorage(interaction.channelId);
  if (assistantData === null) return false;
  await resetCurrentThread(assistantData, interaction);
  await sendInteractionMessageInParts(`You have **cleared** your conversation so far with GPT Assistant, please star over!`, interaction, true);
  return true;
};

export const stopAssistantThreadRuns = async (interaction: ChatInputCommandInteraction) => {
  let assistantData = await getChannelAssistantFromStorage(interaction.channelId);
  if (assistantData === null) {
    return true;
  }
  if (assistantData.threadId === null) {
    await interaction.reply(`Current assistant has no tasks to be stoped!`);
    return true;
  }
  await cancelAllRuns(assistantData.threadId!);
  await interaction.reply(`You have **stopped** all GPT Assistant's tasks!`);
  return true;
};

const resetCurrentThread = async (assistantData: ChannelAssistantData, interaction: ChatInputCommandInteraction) => {
  try {
    const newThread = await openai.beta.threads.create();
    if (!!assistantData.threadId) await openai.beta.threads.del(assistantData.threadId);
    assistantData.threadId = newThread.id;
    await saveChannelAssistantInStorage(assistantData, interaction.channelId);
    return assistantData.threadId;
  } catch (error) {
    console.log(`Error reseting thread for channel: ${interaction.channelId}`, error);
    await sendInteractionMessageInParts("Error reseting current conversation!", interaction, true);
  }
};
