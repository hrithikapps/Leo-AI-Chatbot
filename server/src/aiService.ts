import type { Message } from "./conversationService";

export interface AIService {
  generateReply(history: Message[], newMessage: string): Promise<string>;
}

class StubAIService implements AIService {
  async generateReply(_history: Message[], newMessage: string): Promise<string> {
    return `You said: "${newMessage}". (No AI provider configured yet — set AI_PROVIDER=groq and GROQ_API_KEY.)`;
  }
}

class GroqAIService implements AIService {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async generateReply(history: Message[], newMessage: string): Promise<string> {
    const messages = [
      { role: "system", content: "You are the LEO AI assistant for Mojro applications. Be concise and helpful." },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: newMessage },
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API error ${res.status}: ${text}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq API returned no message content");
    return content;
  }
}

function buildAIService(): AIService {
  if (process.env.AI_PROVIDER === "groq" && process.env.GROQ_API_KEY) {
    return new GroqAIService(process.env.GROQ_API_KEY, process.env.GROQ_MODEL ?? "qwen/qwen3-32b");
  }
  return new StubAIService();
}

export const aiService: AIService = buildAIService();
