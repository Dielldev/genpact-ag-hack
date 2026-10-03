import type { z } from "zod";
import type { AnswerBlock, AskStep } from "../api/blocks.js";
import type { MeshApi } from "../db/meshApi.js";

export interface AgentResult {
  answer: string;
  no_record: boolean;
  citations: string[];
  blocks: AnswerBlock[];
  steps: AskStep[];
  elapsed_ms: number;
  model: string;
}

export type AgentRunner = (workspace: string, question: string) => Promise<AgentResult>;

export class AgentError extends Error {
  override readonly name = "AgentError";
}

export interface Vocabulary {
  people: string[];
  modules: string[];
  tags: string[];
}

export interface ToolContext {
  api: MeshApi;
  workspace: string;
  now: Date;
  vocabulary: Vocabulary;
  emit: (blocks: AnswerBlock[]) => void;
  log: (message: string) => void;
}

export interface ToolOutcome {
  ok: boolean;
  data: Record<string, unknown>;
}

export interface ToolDef<T = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  label: (args: T) => string;
  run: (args: T, ctx: ToolContext) => Promise<ToolOutcome>;
}
