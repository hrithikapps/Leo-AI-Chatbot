import * as http from "node:http";
import * as url from "node:url";
import { addMessage, createConversation, getConversation } from "./conversationService";
import { listFaqs, searchFaqs } from "./faqService";
import { createTicket, getLeaderboard, getTicket, listTickets, updateTicket } from "./ticketService";
import { isValidEmail, sendTicketAssignedEmail } from "./emailService";

const PORT = Number(process.env.PORT ?? 4000);

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const UUID_SEGMENT = "[0-9a-f-]+";
const conversationByIdRoute = new RegExp(`^/conversations/(${UUID_SEGMENT})$`);
const messagesRoute = new RegExp(`^/conversations/(${UUID_SEGMENT})/messages$`);
const ticketByIdRoute = new RegExp(`^/tickets/(${UUID_SEGMENT})$`);

function isAdminAuthorized(req: http.IncomingMessage): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${adminKey}`;
}

const server = http.createServer((req, res) => {
  // Dev-only CORS: Phase 1 demo loads the SDK from a file:// / static origin and
  // needs to reach this backend cross-origin. No credentials or sensitive data
  // are exposed by this route. Revisit before any non-local deployment.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && req.url === "/conversations") {
    readJsonBody(req)
      .then(async (body) => {
        if (!body.applicationId || typeof body.applicationId !== "string") {
          sendJson(res, 400, { error: "applicationId is required" });
          return;
        }
        const conversation = await createConversation(body.applicationId, body.externalUserId ?? null);
        sendJson(res, 201, { conversationId: conversation.id });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }

  const messagesMatch = req.url?.match(messagesRoute);
  if (req.method === "POST" && messagesMatch) {
    const conversationId = messagesMatch[1];
    readJsonBody(req)
      .then(async (body) => {
        if (body.role !== "user" || typeof body.content !== "string" || !body.content) {
          sendJson(res, 400, { error: "role must be 'user' and content is required" });
          return;
        }
        const result = await addMessage(conversationId, body.content);
        if (!result) {
          sendJson(res, 404, { error: "conversation not found" });
          return;
        }
        sendJson(res, 201, result);
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/faq")) {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname === "/faq") {
      const query = typeof parsed.query.q === "string" ? parsed.query.q.trim() : "";
      (query ? searchFaqs(query) : listFaqs())
        .then((faqs) => sendJson(res, 200, { faqs }))
        .catch((err) => sendJson(res, 500, { error: err.message }));
      return;
    }
  }

  if (req.method === "POST" && req.url === "/tickets") {
    readJsonBody(req)
      .then(async (body) => {
        if (!body.applicationId || typeof body.applicationId !== "string") {
          sendJson(res, 400, { error: "applicationId is required" });
          return;
        }
        if (!body.subject || typeof body.subject !== "string") {
          sendJson(res, 400, { error: "subject is required" });
          return;
        }
        if (!body.description || typeof body.description !== "string") {
          sendJson(res, 400, { error: "description is required" });
          return;
        }
        const ticket = await createTicket(
          body.applicationId,
          body.externalUserId ?? null,
          body.subject,
          body.description
        );
        sendJson(res, 201, { ticket });
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }

  if (req.method === "GET" && req.url === "/tickets") {
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    listTickets()
      .then((tickets) => sendJson(res, 200, { tickets }))
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  const ticketMatch = req.url?.match(ticketByIdRoute);
  if (req.method === "GET" && ticketMatch) {
    getTicket(ticketMatch[1])
      .then((ticket) => {
        if (!ticket) {
          sendJson(res, 404, { error: "ticket not found" });
          return;
        }
        sendJson(res, 200, { ticket });
      })
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  if (req.method === "PATCH" && ticketMatch) {
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    readJsonBody(req)
      .then(async (body) => {
        const validStatus = ["open", "in_progress", "closed"];
        const validTier = ["L1", "L2", "L3"];
        if (body.status !== undefined && !validStatus.includes(body.status)) {
          sendJson(res, 400, { error: "status must be one of: " + validStatus.join(", ") });
          return;
        }
        if (body.tier !== undefined && !validTier.includes(body.tier)) {
          sendJson(res, 400, { error: "tier must be one of: " + validTier.join(", ") });
          return;
        }

        const before = await getTicket(ticketMatch[1]);
        const ticket = await updateTicket(ticketMatch[1], {
          status: body.status,
          tier: body.tier,
          assignee: typeof body.assignee === "string" ? body.assignee : undefined,
        });
        if (!ticket) {
          sendJson(res, 404, { error: "ticket not found" });
          return;
        }
        sendJson(res, 200, { ticket });

        const newAssignee = typeof body.assignee === "string" ? body.assignee : null;
        if (newAssignee && newAssignee !== before?.assignee && isValidEmail(newAssignee)) {
          sendTicketAssignedEmail(newAssignee, ticket).catch((err) => {
            console.error("[leo-ai-chatbot-server] assignment email failed:", err);
          });
        }
      })
      .catch((err) => sendJson(res, 400, { error: err.message }));
    return;
  }

  if (req.method === "GET" && req.url === "/leaderboard") {
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    getLeaderboard()
      .then((leaderboard) => sendJson(res, 200, { leaderboard }))
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  const conversationMatch = req.url?.match(conversationByIdRoute);
  if (req.method === "GET" && conversationMatch) {
    const conversationId = conversationMatch[1];
    getConversation(conversationId)
      .then((result) => {
        if (!result) {
          sendJson(res, 404, { error: "conversation not found" });
          return;
        }
        sendJson(res, 200, result);
      })
      .catch((err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`[leo-ai-chatbot-server] listening on http://localhost:${PORT}`);
});
