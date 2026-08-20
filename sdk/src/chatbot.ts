import type { LeoAIChatbotConfig } from "./types";
import { buildPanelSrcDoc } from "./panel";

const ROOT_ID = "leo-ai-chatbot-root";

interface State {
  config: LeoAIChatbotConfig;
  rootEl: HTMLElement;
  launcherEl: HTMLButtonElement;
  panelEl: HTMLIFrameElement;
  isOpen: boolean;
  onMessage: (event: MessageEvent) => void;
}

let state: State | null = null;

function resolveContainer(container: LeoAIChatbotConfig["container"]): HTMLElement {
  if (!container) return document.body;
  if (typeof container === "string") {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) {
      throw new Error(`LeoAIChatbot.init: container selector "${container}" did not match any element`);
    }
    return el;
  }
  return container;
}

function checkBackendHealth(backendUrl: string): void {
  fetch(`${backendUrl.replace(/\/$/, "")}/health`)
    .then((res) => {
      if (!res.ok) throw new Error(`status ${res.status}`);
      console.log("[LeoAIChatbot] backend health check ok:", backendUrl);
    })
    .catch((err) => {
      console.warn("[LeoAIChatbot] backend health check failed:", backendUrl, err);
    });
}

export function init(config: LeoAIChatbotConfig): void {
  if (!config || !config.backendUrl || !config.application) {
    throw new Error("LeoAIChatbot.init: backendUrl and application are required");
  }

  if (state) {
    destroy();
  }

  const mountPoint = resolveContainer(config.container);
  const usesOwnLauncher = !config.container;

  const rootEl = document.createElement("div");
  rootEl.id = ROOT_ID;
  if (usesOwnLauncher) {
    rootEl.style.position = "fixed";
    rootEl.style.bottom = "16px";
    rootEl.style.right = "16px";
    rootEl.style.zIndex = "999999";
    rootEl.style.fontFamily = "system-ui, sans-serif";
  }

  const launcherEl = document.createElement("button");
  launcherEl.type = "button";
  launcherEl.textContent = "Chat";
  launcherEl.setAttribute("aria-label", "Open LEO AI Chatbot");
  launcherEl.style.cursor = "pointer";
  launcherEl.style.borderRadius = "999px";
  launcherEl.style.border = "none";
  launcherEl.style.padding = "10px 18px";
  launcherEl.style.background = "#c9701f";
  launcherEl.style.color = "#fff";
  launcherEl.style.fontSize = "14px";
  launcherEl.addEventListener("click", () => {
    if (state) state.isOpen ? close() : open();
  });

  const panelEl = document.createElement("iframe");
  panelEl.title = "LEO AI Chatbot";
  panelEl.style.display = "none";
  panelEl.style.width = "360px";
  panelEl.style.height = "540px";
  panelEl.style.border = "1px solid #d0d5dd";
  panelEl.style.borderRadius = "8px";
  panelEl.style.marginBottom = "8px";
  panelEl.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
  panelEl.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  panelEl.srcdoc = buildPanelSrcDoc(config);

  rootEl.appendChild(panelEl);
  rootEl.appendChild(launcherEl);
  mountPoint.appendChild(rootEl);

  const onMessage = (event: MessageEvent): void => {
    if (event.source === panelEl.contentWindow && event.data?.type === "leo-ai-chatbot:close") {
      close();
    }
  };
  window.addEventListener("message", onMessage);

  state = { config, rootEl, launcherEl, panelEl, isOpen: false, onMessage };

  checkBackendHealth(config.backendUrl);
}

export function open(): void {
  if (!state) {
    console.warn("[LeoAIChatbot] open() called before init()");
    return;
  }
  state.panelEl.style.display = "block";
  state.launcherEl.style.display = "none";
  state.isOpen = true;
}

export function close(): void {
  if (!state) {
    console.warn("[LeoAIChatbot] close() called before init()");
    return;
  }
  state.panelEl.style.display = "none";
  state.launcherEl.style.display = "inline-block";
  state.isOpen = false;
}

export function destroy(): void {
  if (!state) return;
  window.removeEventListener("message", state.onMessage);
  state.rootEl.remove();
  state = null;
}
