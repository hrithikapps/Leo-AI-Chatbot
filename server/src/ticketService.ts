import { pool } from "./db";

export interface Ticket {
  id: string;
  applicationId: string;
  externalUserId: string | null;
  subject: string;
  description: string;
  status: "open" | "closed";
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
