import fetch from "node-fetch";
import { AssistantCreateParams } from "openai/resources/beta/assistants/assistants.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "../util/aws-s3-util.js";
import { readJsonStreamToString } from "../util/stream-util.js";
import { openai } from "./openai-util.js";
import { sendMessageToProperChannel, sendMessageToProperChannelWithFile } from "../util/discord-util.js";
import { AssistantFile, ChannelAssistantData, GPTAssistantModels, GPTAssistantOptions, genericResponse } from "../interfaces/openai.js";
import { Attachment, Message } from "discord.js";
import { MessageContentText, ThreadMessage } from "openai/resources/beta/threads/messages/messages.mjs";
import { ResponseLike } from "openai/uploads.mjs";


export const generateAssistantAnswer = async (message: Message, messageContent: string) => {
  let assistantData = await getCurrentAssistantForChannel(message.channelId);
  if (assistantData === null) {
    await sendMessageToProperChannel(`Please create assistant for this channel before trying, use: **!assistant_change name="Asistant name" instructions="Asistant instructions" model="here put 'gpt-3' or 'gpt4'"** . You can update assistant parameters with the same way!`, message.channelId);
    return;
  }
  const threadId = await getCurrentThread(assistantData, message.channelId);
  const messageFileIds = await passUserInputFilesToAssistant(message);
  await createUserMessage(threadId, messageContent, messageFileIds);
  const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantData.assistantId });
  await pollForRunUntil(run.id, threadId, "completed");

  const assistantMessages = await retrieveAssistantMessages(threadId, run.id);
  await extractAndSendAssistantMessage(assistantMessages, message.channelId);
};

const resetCurrentThread = async (assistantData: ChannelAssistantData, channelId: string) => {
  const newThread = await openai.beta.threads.create();
  if (!!assistantData.threadId) await openai.beta.threads.del(assistantData.threadId);
  assistantData.threadId = newThread.id;
  await saveAssistantInStorage(assistantData, channelId);
  return assistantData.threadId;
};

const getCurrentThread = async (assistantData: ChannelAssistantData, channelId: string) => {
  if (!assistantData.threadId || (await isThreadInactive(assistantData.threadId))) {
    const thread = await openai.beta.threads.create();
    assistantData.threadId = thread.id;
    await saveAssistantInStorage(assistantData, channelId);
  }
  console.log(`Working with threadId: ${assistantData.threadId}`);
  return assistantData.threadId;
};

const extractAndSendAssistantMessage = async (messages: ThreadMessage[], channelId: string) => {
  let textMessage = null, annotations = null, assisstantFiles = null;
  if(messages.length > 0) {
    for(let message of messages) {
      for (let content of message.content) {
        if (content.type === "text") {
          textMessage = content.text.value;
          annotations = content.text.annotations;
          assisstantFiles = await extractAssistantFilesFrom(annotations);
          await sendMessageToProperChannelWithFile(textMessage, assisstantFiles, channelId);
        }
      }
    }
  }
    
};

const extractAssistantFilesFrom = async (annotations: (MessageContentText.Text.FileCitation | MessageContentText.Text.FilePath)[]) => {
  const files: Array<AssistantFile> = [];
  for (let annotation of annotations) {
    if (annotation.type === "file_path") {
      const fileResponse = await openai.files.content(annotation.file_path.file_id);
      const fileData = await fileResponse.arrayBuffer();
      const fileDataBuffer = Buffer.from(fileData);
      const fileName = annotation.text.split("/").slice(-1)[0];
      files.push({ name: fileName, file: fileDataBuffer });
    }
  }
  return files;
};

const createUserMessage = async (threadId: string, content: string, fileIds: string[]) => {
  const newMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
    file_ids: fileIds,
  });
  return newMessage;
};

const passUserInputFilesToAssistant = async (message: Message) => {
  const inputFiles = await getInputMessageFilesArray(message);
  const assistantFileIds: string[] = [];
  for (let inputFile of inputFiles) {
    const assistantFile = await openai.files.create({
      file: inputFile,
      purpose: "assistants",
    });
    assistantFileIds.push(assistantFile.id);
  }
  return assistantFileIds;
};

const retrieveAssistantMessages = async (threadId: string, runId: string) => {
  const threadMessages = await openai.beta.threads.messages.list(threadId, {
    order: "desc",
    limit: 10,
  });
  const result = [];
  for(let threadMessage of threadMessages.data) {
    if(threadMessage.role === "assistant" && threadMessage.run_id === runId) 
      result.push(threadMessage);
  }
  return result.reverse();
};

export const assistantChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "_change";
  if (!message.startsWith(command)) return false;
  const { name, instructions, model } = parseAsssitantConfigInput(message, GPTAssistantOptions);
  let assistantData = await getCurrentAssistantForChannel(channelId);
  if (assistantData === null || !assistantData.assistantId) {
    await createAssistant(channelId, name, instructions, determineModel(model));
  } else {
    await updateAssistant(channelId, assistantData, name, instructions, determineModel(model));
  }
  return true;
};

export const assistantThreadReset = async (message: string, channelId: string) => {
  const command = "_clear";
  if (!message.startsWith(command)) return false;
  let assistantData = await getCurrentAssistantForChannel(channelId);
  if(assistantData === null) return false;
  await resetCurrentThread(assistantData,channelId);
  await sendMessageToProperChannel(
    `**You have cleared your conversation so far, please star over!**`,
    channelId
  );
  return true;
}

export const createAssistant = async (channelId: string, name: string | undefined, instructions: string, model: string) => {
  try {
    const createParams: AssistantCreateParams = {
      name: `${!name ? channelId : name}(voice-to-gpt)`,
      instructions: instructions,
      // tools: [{ type: "code_interpreter" }, { type: "retrieval" }], - retrieval is currently causing bugs for almost all types of files so using code interpreter for now
       tools: [{ type: "code_interpreter" }],
      model: model,
    };
    const assistant = await openai.beta.assistants.create(createParams);
    await saveAssistantInStorage({ assistantId: assistant.id }, channelId);
    await sendMessageToProperChannel(
      `You **created** a new GPT Assistant named: **${assistant.name}**, model: **${assistant.model}**, instructions: **${assistant.instructions}**`,
      channelId
    );
  } catch (error) {
    console.error("Error creating assistant", error);
    await sendMessageToProperChannel(`Error updating assistant!`, channelId);
  }
};

export const updateAssistant = async (
  channelId: string,
  assistantData: ChannelAssistantData,
  name: string | undefined,
  instructions: string,
  model: string | undefined
) => {
  try {
    let updateParams: Record<string, string> = {};
    if (!!name) updateParams.name = name;
    if (!!model) updateParams.model = model;
    updateParams.instructions = instructions;
    const assistant = await openai.beta.assistants.update(assistantData.assistantId, updateParams);
    await saveAssistantInStorage(assistantData, channelId);
    await sendMessageToProperChannel(
      `You **updated** GPT Assistant for this channel! Current name: **${assistant.name}**, model: **${assistant.model}**, instructions: **${assistant.instructions}**`,
      channelId
    );
  } catch (error) {
    console.error("Error updating assistant", error);
    await sendMessageToProperChannel(`Error updating assistant!`, channelId);
  }
};

export const getCurrentAssistantForChannel = async (channelId: string): Promise<ChannelAssistantData | null> => {
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

export const saveAssistantInStorage = async (assistantData: ChannelAssistantData, channelId: string): Promise<void> => {
  try {
    const filePath = getAssistantPath(channelId);
    const jsonString = JSON.stringify(assistantData);
    await uploadFileToS3(filePath, jsonString);
    console.log(`GPT Assistant data has been saved for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error saving GPT Assistant data to JSON file for channel: ${channelId}:`, error);
  }
};

export const getInputMessageFilesArray = async (message: Message) => {
  const files: ResponseLike[] = [];
  if (message.attachments.size > 0) {
    for (let attachment of Array.from(message.attachments.values())) {
      try {
        const fetchResponse = await fetchFileFromUrl(attachment);
        files.push(fetchResponse);
      } catch (error) {
        await sendMessageToProperChannel(`File ${attachment.name} was not processed properly and is not taken into consideration`, message.channelId);
        continue;
      }
    }
  }
  return files;
};

const fetchFileFromUrl = async (attachment: Attachment) => {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error();
  return response;
};

const parseAsssitantConfigInput = (input: string, configParamLabels: string[]) => {
  input = input.trim();
  const params: Record<string, string> = {};
  configParamLabels.forEach((label) => {
    const regex = new RegExp(`${label}\\s*=\\s*"([^"]*)"`, "gi");
    let match;
    while ((match = regex.exec(input)) !== null) {
      const value = match[1];
      params[label] = value;
    }
  });
  return params;
};

const pollForRunUntil = async (runId: string, threadId: string, desiredStatus: string, intervalMs = 2000, maxAttempts = 60) => {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);
      if (run.status === desiredStatus) return run.id;

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error("Poll for Assistant run failed:", error);
    }
  }
  throw new Error(`Max attempts reached, desired status '${desiredStatus}' not found for Assistant run with id: ${runId}.`);
};


const isThreadInactive = async (threadId: string) => {
  try {
    await openai.beta.threads.retrieve(threadId);
    return false;
  } catch (error) {
    console.log(error);
    return true;
  }
};

const determineModel = (modelName: string): string => {
  let model = GPTAssistantModels.find((model) => model.startsWith(modelName));
  return !!model ? model : GPTAssistantModels[0];
};

const getAssistantPath = (channelId: string): string => `assistants/${channelId}-assistant.json`;
