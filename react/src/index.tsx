import { useEffect } from "react";
import { init, destroy } from "../../sdk/src/chatbot";
import type { LeoAIChatbotConfig, LeoAIChatbotUser } from "../../sdk/src/types";

export { open, close } from "../../sdk/src/chatbot";
export type { LeoAIChatbotUser } from "../../sdk/src/types";

export interface LeoAIChatbotProps {
  /** Base URL of the LEO AI Backend, e.g. "http://localhost:4000". */
  backendUrl: string;
  /** Free-text application identifier, e.g. "shipper". */
  application: string;
  user?: LeoAIChatbotUser;
  /** Optional mount point. Defaults to a fixed-position launcher appended to <body>. */
  container?: LeoAIChatbotConfig["container"];
}

/**
 * Mounts the LEO AI Chatbot launcher + panel for the lifetime of this component.
 * Re-initializes if backendUrl/application/container/user identity changes.
 */
export function LeoAIChatbot(props: LeoAIChatbotProps): null {
  const { backendUrl, application, user, container } = props;

  useEffect(() => {
    init({ backendUrl, application, user, container });
    return () => destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, application, container, user?.id, user?.name, user?.email]);

  return null;
}
