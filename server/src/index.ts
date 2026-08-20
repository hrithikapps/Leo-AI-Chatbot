import * as http from "node:http";
import * as url from "node:url";
import { addMessage, createConversation, getConversation } from "./conversationService";
import { listFaqs, searchFaqs } from "./faqService";

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

const server = http.createServer((req, res) => {
  // Dev-only CORS: Phase 1 demo loads the SDK from a file:// / static origin and
  // needs to reach this backend cross-origin. No credentials or sensitive data
  // are exposed by this route. Revisit before any non-local deployment.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

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
