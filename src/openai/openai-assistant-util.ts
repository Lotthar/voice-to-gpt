import fetch from "node-fetch";
import { openai } from "./openai-api-util.js";
import { sendMessageToProperChannel, sendMessageToProperChannelWithFile } from "../discord/discord-util.js";
import { AssistantFile } from "../types/openai.js";
import { Attachment, Message } from "discord.js";
import { ResponseLike } from "openai/uploads.mjs";
import { MessageContentText, ThreadMessage } from "openai/resources/beta/threads/messages/messages.mjs";

export const createUserMessage = async (threadId: string, content: string, fileIds: string[]) => {
  const newMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
    file_ids: fileIds,
  });
  return newMessage;
};

export const retrieveAssistantMessages = async (threadId: string, runId: string) => {
  const threadMessages = await openai.beta.threads.messages.list(threadId, {
    order: "desc",
    limit: 10,
  });
  const result: ThreadMessage[] = [];
  threadMessages.data
    .filter(tm => tm.role === "assistant" && tm.run_id === runId)
    .forEach(tm => result.push(tm))
  
  return result.reverse();
};

export const cancelAllRuns = async (threadId: string) => {
  const allRuns = await retrieveThreadRuns(threadId);
  for(let run of allRuns) {
    try {
      if(run.status === "queued" || run.status === "in_progress") {
        await openai.beta.threads.runs.cancel(threadId, run.id)
      }
    }catch(error) {
      console.log(`Error canceling the run ${run.id}`, error);
    }
  }
}

export const retrieveThreadRuns = async (threadId: string) => {
  try {
    const runs = await openai.beta.threads.runs.list(threadId, {
      order: "desc",
      limit: 10,
    });
    return runs.data;
  } catch (error) {
    console.log(error);
    return [];
  }
}

export const retrieveAssistantByName = async (name: string) => {
  const assistants = await retrieveAllAssistants();
  return assistants.find(assistant => assistant.name === name);
}

export const retrieveAllAssitantsNames = async () => {
  const assistants = await retrieveAllAssistants();
  return assistants.filter(assistant => assistant.name !== null)
                   .map(assistant => assistant.name!);
}

export const retrieveAllAssistants = async () => {
  try {
    const assistants = await openai.beta.assistants.list({
      limit: 20,
      order: "desc"
    });
    return assistants.data;
  } catch (error) {
    console.log(error);
    return [];
  }
}

export const passUserInputFilesToAssistant = async (message: Message) => {
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

export const extractAssistantFilesFrom = async (annotations: (MessageContentText.Text.FileCitation | MessageContentText.Text.FilePath)[]) => {
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

export const extractAndSendAssistantMessage = async (messages: ThreadMessage[], channelId: string) => {
  let textMessage = null,
    annotations = null,
    assisstantFiles = null;
  for (let message of messages) {
    for (let content of message.content) {
      if (content.type === "text") {
        textMessage = content.text.value;
        annotations = content.text.annotations;
        assisstantFiles = await extractAssistantFilesFrom(annotations);
        await sendMessageToProperChannelWithFile(textMessage, assisstantFiles, channelId);
      }
    }
  }
};

const fetchFileFromUrl = async (attachment: Attachment) => {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error("Can't properly fetch the attachment by url");
  return response;
};

export const pollForRunUntil = async (runId: string, threadId: string, desiredStatus: string, intervalMs = 2000, maxAttempts = 150) => {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      const run = await openai.beta.threads.runs.retrieve(threadId, runId);
      if (run.status === 'cancelling' || run.status === 'cancelled') {
        return false;
      }
      if(run.status === desiredStatus) return true;
    
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error("Poll for Assistant run failed:", error);
    }
  }
  console.error(`Max attempts reached, desired status '${desiredStatus}' not found for Assistant run with id: ${runId}.`);
  return false;
};

export const isThreadInactive = async (threadId: string) => {
  try {
    await openai.beta.threads.retrieve(threadId);
    return false;
  } catch (error) {
    console.log(error);
    return true;
  }
};

export const getAssistantPath = (channelId: string): string => `assistants/${channelId}-assistant.json`;
