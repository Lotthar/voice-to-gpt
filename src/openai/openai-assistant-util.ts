import fetch from "node-fetch";
import { openai } from "./openai-api-util.js";
import { sendInteractionMessageInParts, sendInteractionMessageWithFiles } from "../discord/discord-util.js";
import { AssistantFile, AssistantFileType, AssistantTools, ChannelAssistantData } from "../types/openai.js";
import { ChatInputCommandInteraction } from "discord.js";
import { ResponseLike } from "openai/uploads.mjs";
import { downloadFileFromS3, uploadFileToS3 } from "../util/aws-s3-util.js";
import { readJsonStreamToString } from "../util/stream-util.js";
import { Annotation, Message, MessageContentPartParam, MessageCreateParams } from "openai/resources/beta/threads/messages.mjs";

export const createUserMessage = async (threadId: string, content: string, fileTypesByid: Map<string, string>) => {
  const { contents, attachments } = createMessageContentAndAttachments(content, fileTypesByid); 
  const newMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: contents,
    attachments: attachments,
  });
  return newMessage;
};

const createMessageContentAndAttachments = (textContent: string, fileTypesByid: Map<string, string>) => {
  const contents: MessageContentPartParam[] = [];
  const attachments: MessageCreateParams.Attachment[] = [];
  fileTypesByid.forEach((fileType: string, fileId: string) => {
    if (fileType === "image") {
      contents.push({ type: "image_file", image_file: { file_id: fileId } });
    } else {
      attachments.push({ file_id: fileId, tools: AssistantTools });
    }
  });
  contents.push({type: "text", text: textContent})
  return { contents, attachments };
};

export const createAssistantRun = async (threadId: string, assistantId: string, status: string) => {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
    tools: AssistantTools,
  });
  if (run.status === status) {
    return run;
  }
  if (run.status === "cancelling" || run.status === "cancelled") {
    throw new Error(`Assistant run is in canceliing state or cancelled!`);
  }
  throw new Error(`Assistant run is not in desired status: "${status}", something was wrong!`);
};

export const retrieveAssistantMessages = async (threadId: string, runId: string) => {
  const threadMessages = await openai.beta.threads.messages.list(threadId, {
    order: "desc",
    limit: 10,
  });
  return threadMessages.data.reverse().filter((tm) => tm.role === "assistant" && tm.run_id === runId);
};

export const getAssistantSavedConversationData = async (interaction: ChatInputCommandInteraction) => {
  let assistantData = await getChannelAssistantFromStorage(interaction.channelId);
  if (assistantData === null) {
    await sendInteractionMessageInParts(
      `Please create or select assistant for this channel before trying, use: **/assistant_change**. You can update assistant using **/assistant_update**`,
      interaction,
      true
    );
    return null;
  }
  const currentThreadId = await getCurrentThread(assistantData, interaction.channelId);
  if (currentThreadId === null) {
    await sendInteractionMessageInParts(
      `Looks like there is a problem with getting conversation history for this channel, please reset conversation using **!assistant_clear** command`,
      interaction,
      true
    );
    return null;
  }
  return { assistantData, currentThreadId };
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

export const cancelAllRuns = async (threadId: string) => {
  const allRuns = await retrieveThreadRuns(threadId);
  for (let run of allRuns) {
    try {
      if (run.status === "queued" || run.status === "in_progress") {
        await openai.beta.threads.runs.cancel(threadId, run.id);
      }
    } catch (error) {
      console.log(`Error canceling the run ${run.id}`, error);
    }
  }
};

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
};

export const retrieveAssistantByName = async (name: string) => {
  const assistants = await retrieveAllAssistants();
  return assistants.find((assistant) => assistant.name === name);
};

export const retrieveAllAssitantsNames = async () => {
  const assistants = await retrieveAllAssistants();
  return assistants.filter((assistant) => assistant.name !== null).map((assistant) => assistant.name!);
};

export const retrieveAllAssistants = async () => {
  try {
    const assistants = await openai.beta.assistants.list({
      limit: 20,
      order: "desc",
    });
    return assistants.data;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const passUserInputFilesToAssistant = async (fileTypesByUrl: Map<string, AssistantFileType>, interaction: ChatInputCommandInteraction) => {
  const filesByUrl = await getInteractionFilesArray(fileTypesByUrl, interaction);
  const assistantFileTypesById: Map<string, string> = new Map();
  for (let inputFileUrl of fileTypesByUrl.keys()) {
    const assistantFile = await openai.files.create({
      file: filesByUrl.get(inputFileUrl)!,
      purpose: fileTypesByUrl.get(inputFileUrl)! === "image" ? "vision" : "assistants",
    });
    assistantFileTypesById.set(assistantFile.id, fileTypesByUrl.get(inputFileUrl)!);
  }
  return assistantFileTypesById;
};

export const getInteractionFilesArray = async (fileTypesByUrl: Map<string, AssistantFileType>, interaction: ChatInputCommandInteraction) => {
  const filesByUrl: Map<string, ResponseLike> = new Map();
  for (let url of fileTypesByUrl.keys()) {
    try {
      const fetchResponse = await fetchFileFromUrl(url);
      filesByUrl.set(url, fetchResponse);
    } catch (error) {
      await sendInteractionMessageInParts(`File ${url} was not processed properly and is not taken into consideration`, interaction, true);
      continue;
    }
  }
  return filesByUrl;
};

export const extractAssistantFilesFrom = async (annotations: Annotation[]) => {
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

export const extractAndSendAssistantMessage = async (messages: Message[], interaction: ChatInputCommandInteraction) => {
  let textMessage = null,
    annotations = null,
    assisstantFiles = null;
  for (let message of messages) {
    for (let content of message.content) {
      if (content.type === "text") {
        textMessage = content.text.value;
        annotations = content.text.annotations;
        assisstantFiles = await extractAssistantFilesFrom(annotations);
        await sendInteractionMessageWithFiles(textMessage, assisstantFiles, interaction);
      }
    }
  }
};

const fetchFileFromUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Can't properly fetch the attachment by url");
  return response;
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
