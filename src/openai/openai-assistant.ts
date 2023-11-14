import fs, { ReadStream } from "node:fs";
import fetch from "node-fetch";
import { Assistant, AssistantCreateParams } from "openai/resources/beta/assistants/assistants.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "../util/aws-s3-util.js";
import { readJsonStreamToString } from "../util/stream-util.js";
import { openai } from "./openai-util.js";
import { sendMessageToProperChannel } from "../util/discord-util.js";
import { ChannelAssistantData, GPTAssistantModels, genericResponse } from "../interfaces/openai.js";
import { Attachment, Message } from "discord.js";

import { MessageContentImageFile, MessageContentText, ThreadMessage } from "openai/resources/beta/threads/messages/messages.mjs";
import { ResponseLike } from "openai/uploads.mjs";

const assistantOptions = ["name", "instructions", "model"];

export const generateAssistantAnswer = async (message: Message, messageContent: string) => {
  let assistantData = await getCurrentAssistantForChannel(message.channelId);
  if (assistantData === null)
    return `Please create assistant for this channel before trying, use: **!assistant_changed name="Asistant name" instructions="Asistant instructions" model="here put 'gpt-3' or 'gpt4'"** to create or update assistant parameters`;

  const threadId = await getCurrentThread(assistantData, message.channelId);
  const messageFileIds = await addInputFilesForAssistantMessage(message);
  await createUserMessage(threadId,messageContent,messageFileIds);

  const run = await createAssistantRun(assistantData.assistantId, threadId);
  await pollForRunStatus(run.id, threadId, "completed");

  const assistantMessage = await retrieveAssistantMessage(threadId);
  console.log("Assistant message", assistantMessage);
  await deleteAssistantFiles(messageFileIds);
  return extractAssistantMessage(assistantMessage);
};

const resetCurrentThread = async(assistantData: ChannelAssistantData, channelId: string) => {
  const newThread = await openai.beta.threads.create();
  if(!!assistantData.threadId) await openai.beta.threads.del(assistantData.threadId);
  assistantData.threadId = newThread.id;
  await saveAssistantInStorage(assistantData, channelId);
  return assistantData.threadId
}

const getCurrentThread = async (assistantData: ChannelAssistantData, channelId: string) => {
  if (!assistantData.threadId) {
    const thread = await openai.beta.threads.create();
    assistantData.threadId = thread.id;
    await saveAssistantInStorage(assistantData, channelId);
  } 
  return assistantData.threadId;
}

const extractAssistantMessage = (message: ThreadMessage) => {
  const content: MessageContentText | MessageContentImageFile = message.content[0];
  if (content.type === "text") {
    return content.text.value;
  } else {
    return "";
  }
}

const createUserMessage = async (threadId: string, content: string, fileIds: string[]) => {
  const newMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
    file_ids: fileIds
  });
  console.log("New Message", newMessage);
  return newMessage;
}

const addInputFilesForAssistantMessage = async (message: Message) => {
  const inputFiles = await getInputMessageFilesArray(message);
  const assistantFileIds: string[] = [];
  for (let inputFile of inputFiles) {
    const assistantFile = await createAssistantFile(inputFile);
    assistantFileIds.push(assistantFile.id);
  }
  return assistantFileIds;
};

const retrieveAssistantMessage = async (threadId: string) => {
  const threadMessages = await openai.beta.threads.messages.list(threadId, {
    order: "desc",
    limit: 1,
  });
  console.log("Thread messages", threadMessages);
  return threadMessages.data[0];
};

const createAssistantRun = async (assistantId: string, threadId: string) => {
  const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
  return run;
};
const retrieveAssistantRun = async (runId: string, threadId: string) => {
  const run = await openai.beta.threads.runs.retrieve(threadId, runId);
  return run;
};

const createAssistantFile = async (file: ResponseLike) => {
  const assistantFile = await openai.files.create({
    file: file,
    purpose: "assistants",
  });
  return assistantFile;
};

const retrieveAssistantFile = async (fileId: string, messageId: string, threadId: string) => {
  const file = await openai.beta.threads.messages.files.retrieve(threadId, messageId, fileId);
  return file;
};
const deleteAssistantFiles = async (fileIds: string[]) => {
  for(let fileId of fileIds) {
    await deleteAssistantFile(fileId);
  }
}

const deleteAssistantFile = async (fileId: string) => {
  const file = await openai.files.del(fileId);
  return file;
};



export const assistantChanged = async (message: string, channelId: string): Promise<boolean> => {
  const command = "!assistant_change";
  if (!message.startsWith(command)) return false;
  const { name, instructions, model } = parseAsssitantConfigInput(message, assistantOptions);
  let assistantData = await getCurrentAssistantForChannel(channelId);
  if (assistantData === null || !assistantData.assistantId) {
    await createAssistant(channelId, name, instructions, determineModel(model));
  } else {
    await updateAssistant(channelId, assistantData, name, instructions, determineModel(model));
  }
  return true;
};

export const createAssistant = async (channelId: string, name: string | undefined, instructions: string, model: string) => {
  try {
    const createParams: AssistantCreateParams = {
      name: `${!name ? channelId : name}(voice-to-gpt)`,
      instructions: instructions,
      tools: [{ type: "code_interpreter" }, { type: "retrieval" }],
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
      } catch(error) {
        await sendMessageToProperChannel(`File ${attachment.name} was not processed properly and is not taken into consideration`, message.channelId);
        continue;
      }
    }
  }
  console.log(files);
  return files;
};

const fetchFileFromUrl = async (attachment: Attachment) => {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error();
  console.log(response);
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

const pollForRunStatus = async (runId: string, threadId: string, desiredStatus: string, intervalMs = 1500, maxAttempts = 60) => {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      const run = await retrieveAssistantRun(runId, threadId);
      if (run.status === desiredStatus) return run.id;

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error("Poll for Assistant run failed:", error);
    }
  }
  throw new Error(`Max attempts reached, desired status '${desiredStatus}' not found for Assistant run with id: ${runId}.`);
};

const determineModel = (modelName: string): string => {
  let model = GPTAssistantModels.find((model) => model.startsWith(modelName));
  return !!model ? model : GPTAssistantModels[0];
};

const getAssistantPath = (channelId: string): string => `assistants/${channelId}-assistant.json`;
