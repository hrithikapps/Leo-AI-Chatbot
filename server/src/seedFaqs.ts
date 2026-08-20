import * as fs from "node:fs";
import * as path from "node:path";
import { pool } from "./db";

interface FaqEntry {
  question: string;
  answer: string;
  category?: string;
}

async function seed(): Promise<void> {
  const dataPath = path.join(__dirname, "..", "faq-data.json");
  const entries: FaqEntry[] = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  await pool.query("delete from faqs");

  for (const entry of entries) {
    await pool.query(`insert into faqs (question, answer, category) values ($1, $2, $3)`, [
      entry.question,
      entry.answer,
      entry.category ?? null,
    ]);
  }

  console.log(`[leo-ai-chatbot-server] seeded ${entries.length} FAQ(s) from faq-data.json`);
  await pool.end();
}

seed().catch((err) => {
  console.error("[leo-ai-chatbot-server] FAQ seed failed:", err);
  process.exit(1);
});
