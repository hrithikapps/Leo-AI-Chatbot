import { pool } from "./db";

export type TicketStatus = "open" | "in_progress" | "closed";
export type TicketTier = "L1" | "L2" | "L3";

export interface Ticket {
  id: string;
  applicationId: string;
  externalUserId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  tier: TicketTier | null;
  assignee: string | null;
  createdAt: string;
}

function toTicket(row: any): Ticket {
  return {
    id: row.id,
    applicationId: row.application_id,
    externalUserId: row.external_user_id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    tier: row.tier,
    assignee: row.assignee,
    createdAt: row.created_at,
  };
}

export async function createTicket(
  applicationId: string,
  externalUserId: string | null,
  subject: string,
  description: string
): Promise<Ticket> {
  const result = await pool.query(
    `insert into tickets (application_id, external_user_id, subject, description) values ($1, $2, $3, $4) returning *`,
    [applicationId, externalUserId, subject, description]
  );
  return toTicket(result.rows[0]);
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const result = await pool.query(`select * from tickets where id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return toTicket(result.rows[0]);
}

export async function listTickets(): Promise<Ticket[]> {
  const result = await pool.query(`select * from tickets order by created_at desc`);
  return result.rows.map(toTicket);
}

export async function updateTicket(
  id: string,
  updates: { status?: TicketStatus; tier?: TicketTier; assignee?: string }
): Promise<Ticket | null> {
  const result = await pool.query(
    `update tickets set
       status = coalesce($2, status),
       tier = coalesce($3, tier),
       assignee = coalesce($4, assignee)
     where id = $1
     returning *`,
    [id, updates.status ?? null, updates.tier ?? null, updates.assignee ?? null]
  );
  if (result.rows.length === 0) return null;
  return toTicket(result.rows[0]);
}
