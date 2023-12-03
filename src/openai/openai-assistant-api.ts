import { AssistantCreateParams } from "openai/resources/beta/assistants/assistants.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "../util/aws-s3-util.js";
import { readJsonStreamToString } from "../util/stream-util.js";
import { openai } from "../util/openai-api-util.js";
import { sendMessageToProperChannel } from "../discord/discord-util.js";
import { AssistantOpenAI, ChannelAssistantData, GPTAssistantOptions } from "../types/openai.js";
import { Message } from "discord.js";
import {
  cancelAllRuns,
  createUserMessage,
  determineModel,
  extractAndSendAssistantMessage,
  getAssistantPath,
  isThreadInactive,
  parseAssitantConfigInput,
  passUserInputFilesToAssistant,
  pollForRunUntil,
  retrieveAllAssistants,
  retrieveAssistantMessages,
} from "../util/openai-assistant-util.js";

export const generateAssistantAnswer = async (message: Message, messageContent: string) => {
  let assistantData = await getChannelAssistantFromStorage(message.channelId);
  if (assistantData === null) {
    await sendMessageToProperChannel(
      `Please create or select assistant for this channel before trying, use: **!assistant_change name="Asistant name" instructions="Asistant instructions" model="here put 'gpt-3' or 'gpt4'"** . You can update assistant parameters with the same way!`,
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

export const listAllAssistants = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_list";
  if (!message.startsWith(command)) return false;
  const assistants = await retrieveAllAssistants();
  let result = "## All Assistants \n\n";
  assistants.forEach((assistant) => {
    result += `* **${assistant.name}(${assistant.model})** - *${assistant.instructions}* \n`;
  });
  await sendMessageToProperChannel(result, channelId);
  return true;
};

export const assistantCreated = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_create";
  if (!message.startsWith(command)) return false;
  const { name, instructions, model } = parseAssitantConfigInput(message, GPTAssistantOptions);
  await createAssistant(channelId, { instructions, name: name, model: determineModel(model) });
  return true;
};

export const assistantUpdated = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_update";
  if (!message.startsWith(command)) return false;
  const { name, instructions, model } = parseAssitantConfigInput(message, GPTAssistantOptions);
  const existingAssistant = await retrieveAssistantByName(name, channelId);
  if (!existingAssistant) {
    await sendMessageToProperChannel(
      `Assistant with name starting: **${name}** doesn't exist, please create one first (**!assistant_create** command)if it doesn't exist!`,
      channelId
    );
    return true;
  }
  await updateAssistant(channelId, { instructions, assistantId: existingAssistant.id, name: existingAssistant.name!, model: determineModel(model) });
  return true;
};

export const deleteAssistant = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_delete";
  if (!message.startsWith(command)) return false;
  const { name } = parseAssitantConfigInput(message, GPTAssistantOptions);
  try {
    let chosenAssistant = await retrieveAssistantByName(name, channelId);
    if (!chosenAssistant) return true;
    await openai.beta.assistants.del(chosenAssistant.id);
    await sendMessageToProperChannel(`Assistant with the name: **${chosenAssistant.name}** successfully *deleted*!`,channelId);
  } catch (error) {
    console.log(error);
    await sendMessageToProperChannel(`Error deleting assistant which name starts with: **${name}**`,channelId);
  }
  return true;
};

export const assistantForChannelChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_change";
  if (!message.startsWith(command)) return false;
  const { name } = parseAssitantConfigInput(message, GPTAssistantOptions);
  let chosenAssistant = await retrieveAssistantByName(name, channelId);
  if (!chosenAssistant) {
    await sendMessageToProperChannel(`Assistant with name starting with: **'${name}'** doesn't exist!`, channelId);
    return true;
  }
  let assistantData = { assistantId: chosenAssistant.id };
  await saveChannelAssistantInStorage(assistantData, channelId);
  const currentAssistant = await getChannelAssistantFromStorage(channelId);
  if (!!currentAssistant && !!currentAssistant.threadId) await openai.beta.threads.del(currentAssistant.threadId);
  await sendMessageToProperChannel(
    `Selected Assistant with name: **'${chosenAssistant.name}'** and instructions: **'${chosenAssistant.instructions}'** !`,
    channelId
  );
  return true;
};

const retrieveAssistantByName = async (name: string, channelId: string) => {
  const allAssistants = await retrieveAllAssistants();
  let chosenAssistant = allAssistants.find((assistant) => assistant.name?.toLocaleLowerCase()?.startsWith(name.toLocaleLowerCase()));
  if (!!chosenAssistant) return chosenAssistant;
};

export const assistantRunsStop = async (message: string, channelId: string) => {
  const command = "_stop";
  if (!message.startsWith(command)) return false;
  let assistantData = await getChannelAssistantFromStorage(channelId);
  if (assistantData === null) {
    return true;
  }
  if(assistantData.threadId === null) {
    await sendMessageToProperChannel(`Current assistant has no tasks to be stoped!`,channelId);
    return true;
  }
  await cancelAllRuns(assistantData.threadId!);
  await sendMessageToProperChannel(`**You have stoped all tasks!**`, channelId);
  return true;
};


export const assistantThreadReset = async (message: string, channelId: string) => {
  const command = "_clear";
  if (!message.startsWith(command)) return false;
  let assistantData = await getChannelAssistantFromStorage(channelId);
  if (assistantData === null) return false;
  await resetCurrentThread(assistantData, channelId);
  await sendMessageToProperChannel(`**You have cleared your conversation so far, please star over!**`, channelId);
  return true;
};

export const createAssistant = async (channelId: string, { name, model, instructions }: AssistantOpenAI) => {
  try {
    const createParams: AssistantCreateParams = {
      name: `${!name ? channelId : name}`,
      instructions: instructions,
      tools: [{ type: "code_interpreter" }, { type: "retrieval" }], // retrieval is currently causing bugs for almost all types of files so using code interpreter for now
      model: model,
    };
    const assistant = await openai.beta.assistants.create(createParams);
    await sendMessageToProperChannel(
      `You **created** a new GPT Assistant named: **${assistant.name}**, model: **${assistant.model}**, instructions: *${assistant.instructions}*`,
      channelId
    );
  } catch (error) {
    console.error(`Error creating assistant for channel: ${channelId}`, error);
    await sendMessageToProperChannel(`Error creating assistant!`, channelId);
  }
  
};

export const updateAssistant = async (channelId: string, { name, model, instructions, assistantId }: AssistantOpenAI) => {
  try {
    let updateParams: Record<string, string> = {};
    if (!!name) updateParams.name = name;
    if (!!model) updateParams.model = model;
    updateParams.instructions = instructions;
    const assistant = await openai.beta.assistants.update(assistantId!, updateParams);
    await sendMessageToProperChannel(
      `You **updated** GPT Assistant for this channel! Current name: **${assistant.name}**, model: **${assistant.model}**, instructions: *${assistant.instructions}*`,
      channelId
    );
  } catch (error) {
    console.error(`Error updating assistant for channel: ${channelId}`, error);
    await sendMessageToProperChannel(`Error updating assistant!`, channelId);
  }
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
