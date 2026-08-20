export const BACKEND_URL = "https://leo-ai-chatbot-production.up.railway.app";

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

export class UnauthorizedError extends Error {}

async function adminFetch(adminKey: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${adminKey}`,
    },
  });
  if (res.status === 401) throw new UnauthorizedError("Invalid admin key");
  return res;
}

export async function listTickets(adminKey: string): Promise<Ticket[]> {
  const res = await adminFetch(adminKey, "/tickets");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  return data.tickets;
}

export async function updateTicket(
  adminKey: string,
  id: string,
  updates: { status?: TicketStatus; tier?: TicketTier; assignee?: string }
): Promise<Ticket> {
  const res = await adminFetch(adminKey, `/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  return data.ticket;
}
