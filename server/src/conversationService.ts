import { pool } from "./db";

export interface Conversation {
  id: string;
  applicationId: string;
  externalUserId: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

function toConversation(row: any): Conversation {
  return {
    id: row.id,
    applicationId: row.application_id,
    externalUserId: row.external_user_id,
    createdAt: row.created_at,
  };
}

function toMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function createConversation(
  applicationId: string,
  externalUserId: string | null
): Promise<Conversation> {
  const result = await pool.query(
    `insert into conversations (application_id, external_user_id) values ($1, $2) returning *`,
    [applicationId, externalUserId]
  );
  return toConversation(result.rows[0]);
}

export async function getConversation(
  id: string
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const convResult = await pool.query(`select * from conversations where id = $1`, [id]);
  if (convResult.rows.length === 0) return null;

  const messagesResult = await pool.query(
    `select * from messages where conversation_id = $1 order by created_at asc`,
    [id]
  );

  return {
    conversation: toConversation(convResult.rows[0]),
    messages: messagesResult.rows.map(toMessage),
  };
}

/**
 * Phase 2: no AIService exists yet, so the "assistant" reply is a fixed,
 * controlled response per docs/PHASE_0_ARCHITECTURE.md §E/§G. Real AI wiring
 * arrives in Phase 4 without changing this route's request/response shape.
 */
function generateControlledReply(userContent: string): string {
  return `You said: "${userContent}". (This is a placeholder response — Phase 2 has no AI yet.)`;
}

export async function addMessage(
  conversationId: string,
  content: string
): Promise<{ message: Message; aiMessage: Message } | null> {
  const convResult = await pool.query(`select id from conversations where id = $1`, [conversationId]);
  if (convResult.rows.length === 0) return null;

  const userResult = await pool.query(
    `insert into messages (conversation_id, role, content) values ($1, 'user', $2) returning *`,
    [conversationId, content]
  );

  const aiResult = await pool.query(
    `insert into messages (conversation_id, role, content) values ($1, 'assistant', $2) returning *`,
    [conversationId, generateControlledReply(content)]
  );

  return {
    message: toMessage(userResult.rows[0]),
    aiMessage: toMessage(aiResult.rows[0]),
  };
}
