import type { AgentRunner } from "./agent/types.js";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import type { MeshApi } from "./db/meshApi.js";
import type { LlmClient } from "./llm/types.js";

export interface AppDeps {
  db: Db;
  api: MeshApi;
  llm: LlmClient | null;
  agent?: AgentRunner | null;
  config: Config;
  clock: () => Date;
  log: (message: string) => void;
}
