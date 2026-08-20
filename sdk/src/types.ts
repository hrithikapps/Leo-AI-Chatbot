export interface LeoAIChatbotUser {
  /** Stable unique id supplied by the consumer app. Not defined/invented by the SDK. */
  id: string;
  name?: string;
  email?: string;
}

export interface LeoAIChatbotConfig {
  /** Base URL of the LEO AI Backend, e.g. "http://localhost:4000". */
  backendUrl: string;
  /** Free-text application identifier, e.g. "shipper". */
  application: string;
  user?: LeoAIChatbotUser;
  /** Optional mount point. Defaults to a fixed-position launcher appended to <body>. */
  container?: HTMLElement | string;
}
