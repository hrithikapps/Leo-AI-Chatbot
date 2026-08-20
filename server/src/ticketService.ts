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
  resolvedAt: string | null;
}

export interface LeaderboardEntry {
  assignee: string;
  ticketsResolved: number;
  totalPoints: number;
  avgPoints: number;
}

// Hours an assignee has to resolve a ticket of a given tier before it's
// considered SLA-breached. L1 = first-line/simple issues, L3 = complex/
// escalated issues, so L1 gets the tightest turnaround expectation.
export const SLA_HOURS: Record<TicketTier, number> = {
  L1: 4,
  L2: 24,
  L3: 72,
};

/**
 * Points for resolving one ticket, based on how fast it was closed relative
 * to its tier's SLA. Within SLA: 100 base + up to 50 bonus for speed (100-150).
 * Past SLA: 50 base, decaying to 0 by the time it's taken 2x the SLA window.
 */
export function computeTicketPoints(tier: TicketTier, createdAt: Date, resolvedAt: Date): number {
  const elapsedHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  const slaHours = SLA_HOURS[tier];

  if (elapsedHours <= slaHours) {
    const bonus = Math.round(50 * (1 - elapsedHours / slaHours));
    return 100 + bonus;
  }

  const overRatio = (elapsedHours - slaHours) / slaHours;
  return Math.max(0, Math.round(50 * (1 - overRatio)));
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
    resolvedAt: row.resolved_at,
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
       assignee = coalesce($4, assignee),
       resolved_at = case when $2 = 'closed' then now() else resolved_at end
     where id = $1
     returning *`,
    [id, updates.status ?? null, updates.tier ?? null, updates.assignee ?? null]
  );
  if (result.rows.length === 0) return null;
  return toTicket(result.rows[0]);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const result = await pool.query(
    `select assignee, tier, created_at, resolved_at from tickets
     where status = 'closed' and tier is not null and assignee is not null and resolved_at is not null`
  );

  const byAssignee = new Map<string, { ticketsResolved: number; totalPoints: number }>();
  for (const row of result.rows) {
    const points = computeTicketPoints(row.tier, new Date(row.created_at), new Date(row.resolved_at));
    const entry = byAssignee.get(row.assignee) ?? { ticketsResolved: 0, totalPoints: 0 };
    entry.ticketsResolved += 1;
    entry.totalPoints += points;
    byAssignee.set(row.assignee, entry);
  }

  return Array.from(byAssignee.entries())
    .map(([assignee, { ticketsResolved, totalPoints }]) => ({
      assignee,
      ticketsResolved,
      totalPoints,
      avgPoints: Math.round(totalPoints / ticketsResolved),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
