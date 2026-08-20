import * as fs from "node:fs";
import * as path from "node:path";
import { pool } from "./db";

async function migrate(): Promise<void> {
  const sql = fs.readFileSync(path.join(__dirname, "..", "src", "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("[leo-ai-chatbot-server] schema applied");
  await pool.end();
}

migrate().catch((err) => {
  console.error("[leo-ai-chatbot-server] migration failed:", err);
  process.exit(1);
});
