import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "leo-ai-chatbot": "src/index.ts" },
  format: ["iife", "esm", "cjs"],
  globalName: "LeoAIChatbot",
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2018",
  outExtension({ format }) {
    if (format === "cjs") return { js: ".cjs" };
    if (format === "esm") return { js: ".mjs" };
    return { js: ".js" }; // iife — kept as leo-ai-chatbot.js for <script src> / CDN use
  },
});
