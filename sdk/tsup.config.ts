import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "leo-ai-chatbot": "src/index.ts" },
  format: ["iife"],
  globalName: "LeoAIChatbot",
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2018",
  outExtension: () => ({ js: ".js" }),
});
