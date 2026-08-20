import type { Ticket } from "./ticketService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export async function sendTicketAssignedEmail(to: string, ticket: Ticket): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[leo-ai-chatbot-server] RESEND_API_KEY not set, skipping assignment email");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "LEO AI Chatbot <onboarding@resend.dev>",
      to: [to],
      subject: `[Ticket assigned${ticket.tier ? ` - ${ticket.tier}` : ""}] ${ticket.subject}`,
      text: `You've been assigned a support ticket.\n\nSubject: ${ticket.subject}\n\n${ticket.description}\n\nApplication: ${ticket.applicationId}\nTicket ID: ${ticket.id}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}
