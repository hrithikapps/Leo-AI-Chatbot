import { pool } from "./db";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

function toFaq(row: any): Faq {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
  };
}

export async function listFaqs(): Promise<Faq[]> {
  const result = await pool.query(`select * from faqs order by created_at asc`);
  return result.rows.map(toFaq);
}

export async function searchFaqs(query: string): Promise<Faq[]> {
  const result = await pool.query(
    `select * from faqs where question ilike $1 or answer ilike $1 order by created_at asc`,
    [`%${query}%`]
  );
  return result.rows.map(toFaq);
}
