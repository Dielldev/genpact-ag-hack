import { z } from "zod";
import type { AnswerBlock, AskStep } from "../api/blocks.js";
import { redactDeep } from "../redact.js";
import { ToolInputError } from "./data.js";
import type { ChatMessage, ToolCall, ToolSpec } from "./openrouter.js";
import { TOOLS } from "./tools.js";
import type { ToolContext, ToolDef } from "./types.js";

const BLOCK_ORDER: Array<AnswerBlock["type"]> = ["person", "kpis", "status", "leaderboard", "blockers", "issues", "bars", "timeline", "sessions", "insights"];
const MAX_BLOCKS = 8;
const MAX_RESULT_CHARS = 14_000;

export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((tool) => {
    const { $schema: _schema, ...parameters } = z.toJSONSchema(tool.schema, { io: "input" }) as Record<string, unknown>;
    return { type: "function", function: { name: tool.name, description: tool.description, parameters } };
  });
}

const keyOf = (b: AnswerBlock): string => {
  if (b.type === "person") return `person:${b.person}`;
  if (b.type === "insights") return `insights:${b.kind}:${b.title}`;
  return `${b.type}:${b.title ?? ""}`;
};

export class BlockLedger {
  private readonly blocks = new Map<string, AnswerBlock>();

  add(blocks: AnswerBlock[]): void {
    for (const block of blocks) if (!this.blocks.has(keyOf(block))) this.blocks.set(keyOf(block), block);
  }

  list(): AnswerBlock[] {
    const rank = (b: AnswerBlock) => BLOCK_ORDER.indexOf(b.type);
    return [...this.blocks.values()].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_BLOCKS);
  }
}

export interface ToolRun {
  message: ChatMessage;
  step: AskStep;
  ok: boolean;
}

function serialize(data: Record<string, unknown>): string {
  const text = JSON.stringify(data);
  return text.length <= MAX_RESULT_CHARS ? text : `${text.slice(0, MAX_RESULT_CHARS)}…`;
}

function failure(message: string): string {
  return JSON.stringify({ error: message });
}

function labelOf(tool: ToolDef<unknown>, args: unknown): string {
  try {
    return tool.label(args);
  } catch {
    return "Working on it";
  }
}

export async function executeTool(call: ToolCall, ctx: ToolContext, sink: BlockLedger): Promise<ToolRun> {
  const started = Date.now();
  const tool: ToolDef<unknown> | undefined = TOOLS.find((t) => t.name === call.function.name);
  const reply = (content: string, ok: boolean, label: string): ToolRun => ({
    message: { role: "tool", tool_call_id: call.id, content },
    step: { label, tool: tool?.name ?? null, ms: Date.now() - started },
    ok,
  });
  if (!tool) return reply(failure(`Unknown tool ${call.function.name}.`), false, "Skipped an unknown step");
  let raw: unknown = {};
  try {
    raw = call.function.arguments?.trim() ? JSON.parse(call.function.arguments) : {};
  } catch {
    return reply(failure("Arguments were not valid JSON."), false, labelOf(tool, raw));
  }
  const parsed = tool.schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return reply(failure(`Invalid arguments: ${issue ? `${issue.path.join(".") || "input"} ${issue.message}` : "check the schema"}.`), false, labelOf(tool, raw));
  }
  const label = labelOf(tool, parsed.data);
  const scoped: ToolContext = { ...ctx, emit: (blocks) => sink.add(redactDeep(blocks)) };
  try {
    const outcome = await tool.run(parsed.data, scoped);
    return reply(serialize(redactDeep(outcome.data)), outcome.ok, label);
  } catch (error) {
    if (error instanceof ToolInputError) return reply(failure(error.message), false, label);
    ctx.log(`agent tool ${tool.name} failed: ${(error as Error).message}`);
    return reply(failure("That lookup failed. Try a different tool or answer with what you have."), false, label);
  }
}
