import "server-only";

import oracledb from "oracledb";

import {
  chatFollowUpError,
  clock,
  defaultPreferences,
  type BookingStep,
  type ChatContextItem,
  type ChatMessage,
  type ChatProvider,
  type ChatSession,
  type Preferences,
} from "@/lib/careway/model";
import { withTransaction } from "@/server/database/transaction";

type ConversationRow = {
  conversationId: string;
  title: string;
  provider: string;
  bookingStep: string;
  visitType: string | null;
  locationLabel: string | null;
  timePreference: string | null;
  paymentLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
};

type MessageRow = {
  messageId: string;
  role: string;
  content: string;
  provider: string | null;
  modelName: string | null;
  requestStatus: string;
  errorText: string | null;
  createdAt: Date;
};

type ContextRow = {
  referencedId: string;
  contextType: string;
  title: string;
  snapshotText: string | null;
};

export type StoredMessageInput = {
  role: "user" | "assistant";
  text: string;
  provider?: ChatProvider | null;
  model?: string | null;
  status?: "complete" | "failed";
  error?: string | null;
};

export type ConversationWrite = {
  userId: string;
  conversationId: string | null;
  title: string;
  provider: ChatProvider;
  bookingStep: BookingStep;
  preferences: Preferences;
  messages: StoredMessageInput[];
  context: ChatContextItem[];
};

export class ConversationAccessError extends Error {
  constructor() {
    super("Conversation not found");
    this.name = "ConversationAccessError";
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const conversationColumns = `conversation.CONVERSATION_ID AS "conversationId",
       conversation.TITLE AS "title",
       conversation.AI_PROVIDER AS "provider",
       conversation.BOOKING_STEP AS "bookingStep",
       conversation.VISIT_TYPE AS "visitType",
       conversation.LOCATION_LABEL AS "locationLabel",
       conversation.TIME_PREFERENCE AS "timePreference",
       conversation.PAYMENT_LABEL AS "paymentLabel",
       conversation.CREATED_AT AS "createdAt",
       conversation.UPDATED_AT AS "updatedAt"`;

export async function loadUserConversations(userId: string) {
  return withTransaction(async (connection) => {
    const summaries = await listSummaries(connection, userId);
    if (summaries.length === 0) return [];
    const opened = await readConversation(connection, userId, summaries[0].id);
    return summaries.map((summary, index) => (index === 0 && opened ? opened : summary));
  });
}

export async function openConversation(userId: string, conversationId: string) {
  if (!uuidPattern.test(conversationId)) return null;
  return withTransaction((connection) => readConversation(connection, userId, conversationId));
}

export async function recordConversationTurn(input: ConversationWrite) {
  const requestedId = input.conversationId && uuidPattern.test(input.conversationId) ? input.conversationId : null;
  const write = { ...input, conversationId: requestedId };
  return withTransaction(async (connection) => {
    const conversationId = await upsertConversation(connection, write);
    for (const message of write.messages.slice(-50)) {
      await insertMessage(connection, conversationId, message);
    }
    if (!requestedId) {
      for (const item of write.context.slice(0, 20)) {
        await insertContext(connection, write.userId, conversationId, item);
      }
    }
    await touchConversation(connection, write.userId, conversationId);
    const opened = await readConversation(connection, write.userId, conversationId);
    if (!opened) throw new ConversationAccessError();
    return opened;
  });
}

export async function completeAssistantMessage(input: {
  userId: string;
  conversationId: string;
  replaceMessageId: string | null;
  message: StoredMessageInput;
}) {
  if (!uuidPattern.test(input.conversationId)) throw new ConversationAccessError();
  return withTransaction(async (connection) => {
    const owned = await ownsConversation(connection, input.userId, input.conversationId);
    if (!owned) throw new ConversationAccessError();
    const replaced = input.replaceMessageId && uuidPattern.test(input.replaceMessageId)
      ? await updateMessage(connection, input.conversationId, input.replaceMessageId, input.message)
      : false;
    if (!replaced) await insertMessage(connection, input.conversationId, input.message);
    await touchConversation(connection, input.userId, input.conversationId);
    const opened = await readConversation(connection, input.userId, input.conversationId);
    if (!opened) throw new ConversationAccessError();
    return opened;
  });
}

export async function addConversationContext(input: {
  userId: string;
  conversationId: string;
  item: ChatContextItem;
}) {
  if (!uuidPattern.test(input.conversationId)) throw new ConversationAccessError();
  return withTransaction(async (connection) => {
    const inserted = await insertContext(connection, input.userId, input.conversationId, input.item);
    if (!inserted) throw new ConversationAccessError();
    await touchConversation(connection, input.userId, input.conversationId);
    return readConversation(connection, input.userId, input.conversationId);
  });
}

export async function deleteConversation(userId: string, conversationId: string) {
  if (!uuidPattern.test(conversationId)) return false;
  return withTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE CONVERSATIONS
       SET STATUS = 'DELETED', UPDATED_AT = SYSTIMESTAMP
       WHERE CONVERSATION_ID = :conversationId
         AND USER_ID = :userId
         AND STATUS = 'ACTIVE'`,
      { conversationId, userId },
    );
    return (result.rowsAffected ?? 0) > 0;
  });
}

async function listSummaries(connection: oracledb.Connection, userId: string) {
  const result = await connection.execute<ConversationRow>(
    `SELECT ${conversationColumns},
            (SELECT COUNT(*) FROM MESSAGES message WHERE message.CONVERSATION_ID = conversation.CONVERSATION_ID) AS "messageCount"
     FROM CONVERSATIONS conversation
     WHERE conversation.USER_ID = :userId
       AND conversation.STATUS = 'ACTIVE'
     ORDER BY conversation.UPDATED_AT DESC`,
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map((row) => sessionFromRow(row, [], [], Number(row.messageCount) === 0));
}

async function readConversation(connection: oracledb.Connection, userId: string, conversationId: string) {
  const result = await connection.execute<ConversationRow>(
    `SELECT ${conversationColumns},
            (SELECT COUNT(*) FROM MESSAGES message WHERE message.CONVERSATION_ID = conversation.CONVERSATION_ID) AS "messageCount"
     FROM CONVERSATIONS conversation
     WHERE conversation.CONVERSATION_ID = :conversationId
       AND conversation.USER_ID = :userId
       AND conversation.STATUS = 'ACTIVE'`,
    { conversationId, userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0];
  if (!row) return null;
  const [messages, context] = await Promise.all([
    listMessages(connection, conversationId),
    listContext(connection, conversationId),
  ]);
  return sessionFromRow(row, messages, context, true);
}

async function listMessages(connection: oracledb.Connection, conversationId: string) {
  const result = await connection.execute<MessageRow>(
    `SELECT MESSAGE_ID AS "messageId",
            ROLE AS "role",
            CONTENT AS "content",
            AI_PROVIDER AS "provider",
            MODEL_NAME AS "modelName",
            REQUEST_STATUS AS "requestStatus",
            ERROR_TEXT AS "errorText",
            CREATED_AT AS "createdAt"
     FROM MESSAGES
     WHERE CONVERSATION_ID = :conversationId
     ORDER BY POSITION, CREATED_AT`,
    { conversationId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map(messageFromRow);
}

async function listContext(connection: oracledb.Connection, conversationId: string) {
  const result = await connection.execute<ContextRow>(
    `SELECT REFERENCED_ID AS "referencedId",
            CONTEXT_TYPE AS "contextType",
            TITLE AS "title",
            SNAPSHOT_TEXT AS "snapshotText"
     FROM CONVERSATION_CONTEXT
     WHERE CONVERSATION_ID = :conversationId
     ORDER BY CREATED_AT`,
    { conversationId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return (result.rows ?? []).map(contextFromRow);
}

async function upsertConversation(connection: oracledb.Connection, input: ConversationWrite) {
  const conversationId = input.conversationId && uuidPattern.test(input.conversationId)
    ? input.conversationId
    : null;
  const binds = conversationBinds(input);
  if (conversationId) {
    const updated = await connection.execute(
      `UPDATE CONVERSATIONS
       SET TITLE = :title,
           AI_PROVIDER = :provider,
           BOOKING_STEP = :bookingStep,
           VISIT_TYPE = :visitType,
           LOCATION_LABEL = :locationLabel,
           TIME_PREFERENCE = :timePreference,
           PAYMENT_LABEL = :paymentLabel,
           UPDATED_AT = SYSTIMESTAMP
       WHERE CONVERSATION_ID = :conversationId
         AND USER_ID = :userId
         AND STATUS = 'ACTIVE'`,
      { ...binds, conversationId },
    );
    if ((updated.rowsAffected ?? 0) > 0) return conversationId;
    throw new ConversationAccessError();
  }

  const createdId = crypto.randomUUID();
  await connection.execute(
    `INSERT INTO CONVERSATIONS (
       CONVERSATION_ID, USER_ID, TITLE, AI_PROVIDER, STATUS, BOOKING_STEP,
       VISIT_TYPE, LOCATION_LABEL, TIME_PREFERENCE, PAYMENT_LABEL
     ) VALUES (
       :conversationId, :userId, :title, :provider, 'ACTIVE', :bookingStep,
       :visitType, :locationLabel, :timePreference, :paymentLabel
     )`,
    { ...binds, conversationId: createdId },
  );
  return createdId;
}

async function insertMessage(connection: oracledb.Connection, conversationId: string, message: StoredMessageInput) {
  const text = clip(message.text, 4000);
  if (!text) return;
  const position = await nextPosition(connection, conversationId);
  await connection.execute(
    `INSERT INTO MESSAGES (
       MESSAGE_ID, CONVERSATION_ID, POSITION, ROLE, CONTENT, AI_PROVIDER,
       MODEL_NAME, REQUEST_STATUS, ERROR_TEXT
     ) VALUES (
       :messageId, :conversationId, :position, :role, :content, :provider,
       :modelName, :requestStatus, :errorText
     )`,
    {
      messageId: crypto.randomUUID(),
      conversationId,
      position,
      role: message.role === "assistant" ? "ASSISTANT" : "USER",
      content: text,
      provider: message.provider ? providerCode(message.provider) : null,
      modelName: message.model ? clip(message.model, 200) : null,
      requestStatus: message.status === "failed" ? "FAILED" : "COMPLETE",
      errorText: message.error ? clip(message.error, 500) : null,
    },
  );
}

async function updateMessage(
  connection: oracledb.Connection,
  conversationId: string,
  messageId: string,
  message: StoredMessageInput,
) {
  const text = clip(message.text, 4000);
  if (!text) return false;
  const result = await connection.execute(
    `UPDATE MESSAGES
     SET CONTENT = :content,
         AI_PROVIDER = :provider,
         MODEL_NAME = :modelName,
         REQUEST_STATUS = :requestStatus,
         ERROR_TEXT = :errorText
     WHERE MESSAGE_ID = :messageId
       AND CONVERSATION_ID = :conversationId`,
    {
      content: text,
      provider: message.provider ? providerCode(message.provider) : null,
      modelName: message.model ? clip(message.model, 200) : null,
      requestStatus: message.status === "failed" ? "FAILED" : "COMPLETE",
      errorText: message.error ? clip(message.error, 500) : null,
      messageId,
      conversationId,
    },
  );
  return (result.rowsAffected ?? 0) > 0;
}

async function insertContext(
  connection: oracledb.Connection,
  userId: string,
  conversationId: string,
  item: ChatContextItem,
) {
  const referencedId = clip(item.id, 80);
  const title = clip(item.title, 200) || "Context";
  if (!referencedId) return false;
  if (!await ownsConversation(connection, userId, conversationId)) return false;
  const existing = await connection.execute<{ referencedId: string }>(
    `SELECT REFERENCED_ID AS "referencedId"
     FROM CONVERSATION_CONTEXT
     WHERE CONVERSATION_ID = :conversationId
       AND CONTEXT_TYPE = :contextType
       AND REFERENCED_ID = :referencedId`,
    { conversationId, contextType: contextCode(item.kind), referencedId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (existing.rows?.[0]) return true;
  try {
    await connection.execute(
      `INSERT INTO CONVERSATION_CONTEXT (
         CONTEXT_ID, CONVERSATION_ID, CONTEXT_TYPE, REFERENCED_ID, TITLE, SNAPSHOT_TEXT
       ) VALUES (
         :contextId, :conversationId, :contextType, :referencedId, :title, :snapshotText
       )`,
      {
        contextId: crypto.randomUUID(),
        conversationId,
        contextType: contextCode(item.kind),
        referencedId,
        title,
        snapshotText: item.body ? clip(item.body, 2000) : null,
      },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "errorNum" in error && error.errorNum === 1) return true;
    throw error;
  }
  return true;
}

async function ownsConversation(connection: oracledb.Connection, userId: string, conversationId: string) {
  const result = await connection.execute<{ owned: number }>(
    `SELECT 1 AS "owned"
     FROM CONVERSATIONS
     WHERE CONVERSATION_ID = :conversationId
       AND USER_ID = :userId
       AND STATUS = 'ACTIVE'`,
    { conversationId, userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return Boolean(result.rows?.[0]);
}

async function touchConversation(connection: oracledb.Connection, userId: string, conversationId: string) {
  await connection.execute(
    `UPDATE CONVERSATIONS
     SET UPDATED_AT = SYSTIMESTAMP
     WHERE CONVERSATION_ID = :conversationId
       AND USER_ID = :userId
       AND STATUS = 'ACTIVE'`,
    { conversationId, userId },
  );
}

async function nextPosition(connection: oracledb.Connection, conversationId: string) {
  const result = await connection.execute<{ nextPosition: number }>(
    `SELECT NVL(MAX(POSITION), 0) + 1 AS "nextPosition"
     FROM MESSAGES
     WHERE CONVERSATION_ID = :conversationId`,
    { conversationId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return Number(result.rows?.[0]?.nextPosition ?? 1);
}

function conversationBinds(input: ConversationWrite) {
  return {
    userId: input.userId,
    title: clip(input.title, 200) || "New chat",
    provider: providerCode(input.provider),
    bookingStep: stepCode(input.bookingStep),
    visitType: clip(input.preferences.visitType, 50) || null,
    locationLabel: clip(input.preferences.location, 200) || null,
    timePreference: clip(input.preferences.preferredTimes, 80) || null,
    paymentLabel: clip(input.preferences.paymentLabel, 80) || null,
  };
}

function sessionFromRow(
  row: ConversationRow,
  messages: ChatMessage[],
  context: ChatContextItem[],
  messagesLoaded: boolean,
): ChatSession {
  return {
    id: row.conversationId,
    title: row.title,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    messages,
    bookingStep: stepFromCode(row.bookingStep),
    preferences: {
      visitType: row.visitType || defaultPreferences().visitType,
      location: row.locationLabel || defaultPreferences().location,
      preferredTimes: row.timePreference || defaultPreferences().preferredTimes,
      paymentLabel: row.paymentLabel || defaultPreferences().paymentLabel,
    },
    context,
    provider: row.provider === "OPENAI" ? "openai" : "oci",
    pending: false,
    error: messagesLoaded ? chatFollowUpError(messages) : null,
    stored: true,
    messagesLoaded,
    messageCount: messagesLoaded ? messages.length : Number(row.messageCount),
  };
}

function messageFromRow(row: MessageRow): ChatMessage {
  const provider = row.provider === "OPENAI" ? "openai" : row.provider === "OCI" ? "oci" : undefined;
  const failed = row.requestStatus === "FAILED";
  return {
    id: row.messageId,
    role: row.role === "ASSISTANT" ? "assistant" : "user",
    text: row.content,
    time: clock(asDate(row.createdAt)),
    provider,
    model: row.modelName ?? undefined,
    status: failed ? "failed" : "complete",
    error: row.errorText,
  };
}

function contextFromRow(row: ContextRow): ChatContextItem {
  const kind = row.contextType === "APPOINTMENT"
    ? "appointment"
    : row.contextType === "CARE_REQUEST"
      ? "care_request"
      : "conversation";
  return {
    id: row.referencedId,
    kind,
    title: row.title,
    body: row.snapshotText ?? "",
  };
}

function providerCode(provider: ChatProvider) {
  return provider === "openai" ? "OPENAI" : "OCI";
}

function stepCode(step: BookingStep) {
  return step.toUpperCase();
}

function stepFromCode(value: string): BookingStep {
  const step = value.toLowerCase();
  if (step === "visit" || step === "location" || step === "time" || step === "payment" || step === "ready") return step;
  return "idle";
}

function contextCode(kind: ChatContextItem["kind"]) {
  if (kind === "appointment") return "APPOINTMENT";
  if (kind === "care_request") return "CARE_REQUEST";
  return "CONVERSATION";
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function iso(value: Date | string) {
  return asDate(value).toISOString();
}
