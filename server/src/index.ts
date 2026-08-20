import * as http from "node:http";

const PORT = Number(process.env.PORT ?? 4000);

const server = http.createServer((req, res) => {
  // Dev-only CORS: Phase 1 demo loads the SDK from a file:// / static origin and
  // needs to reach this backend cross-origin. No credentials or sensitive data
  // are exposed by this route. Revisit before any non-local deployment.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`[leo-ai-chatbot-server] listening on http://localhost:${PORT}`);
});
