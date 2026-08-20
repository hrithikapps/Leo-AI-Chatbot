import type { LeoAIChatbotConfig } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Phase 1 placeholder panel content, rendered via iframe srcdoc so the panel
 * runs in an isolated browsing context (CSS/JS isolation) without requiring a
 * separately hosted HTML file. Real chat UI arrives in a later phase.
 */
export function buildPanelSrcDoc(config: LeoAIChatbotConfig): string {
  const userLine = config.user
    ? `${escapeHtml(config.user.name ?? "(no name)")} &lt;${escapeHtml(config.user.email ?? "no-email")}&gt; (id: ${escapeHtml(config.user.id)})`
    : "(no user context provided)";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; color: #1a1a1a; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  p { font-size: 13px; line-height: 1.5; }
  .meta { color: #555; }
</style>
</head>
<body>
  <h1>LEO AI Chatbot</h1>
  <p>Chatbot UI coming soon.</p>
  <p class="meta">Application: ${escapeHtml(config.application)}</p>
  <p class="meta">User: ${userLine}</p>
</body>
</html>`;
}
