import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, LlmRequest } from "./types.js";

interface ModelCaps {
  temperature: boolean;
  effort: boolean;
  fallbacks: boolean;
}

export function modelCaps(model: string): ModelCaps {
  const m = model.toLowerCase();
  if (m.startsWith("claude-haiku-4-5")) return { temperature: true, effort: false, fallbacks: false };
  if (m.startsWith("claude-sonnet-4-6") || m.startsWith("claude-opus-4-6")) {
    return { temperature: true, effort: true, fallbacks: false };
  }
  if (m.startsWith("claude-sonnet-5-5") || m.startsWith("claude-opus-5-5") || m.startsWith("claude-fable-5-1") || m === "claude-opus-5") {
    return { temperature: false, effort: true, fallbacks: true };
  }
  if (/^claude-(sonnet-5|opus-5|opus-4-[78]|fable-5)/.test(m)) return { temperature: false, effort: true, fallbacks: false };
  return { temperature: false, effort: false, fallbacks: false };
}

function textOf(blocks: Array<{ type: string; text?: string }>): string {
  return blocks.map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
}

export class AnthropicLlm implements LlmClient {
  readonly mode = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async completeJson(req: LlmRequest): Promise<unknown> {
    const caps = modelCaps(req.model);
    const base = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user" as const, content: req.user }],
      output_config: {
        format: { type: "json_schema" as const, schema: req.schema },
        ...(caps.effort && req.effort ? { effort: req.effort } : {}),
      },
      ...(caps.temperature && req.temperature !== undefined ? { temperature: req.temperature } : {}),
    };
    const options = {
      timeout: req.timeoutMs,
      signal: req.signal,
      maxRetries: 1,
    };
    let stopReason: string | null;
    let text: string;
    if (caps.fallbacks) {
      const msg = await this.client.beta.messages.create(
        { ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
        options,
      );
      stopReason = msg.stop_reason;
      text = textOf(msg.content);
    } else {
      const msg = await this.client.messages.create(base, options);
      stopReason = msg.stop_reason;
      text = textOf(msg.content);
    }
    if (stopReason === "refusal") throw new Error(`${req.purpose}: model declined the request`);
    if (stopReason === "max_tokens") throw new Error(`${req.purpose}: output hit max_tokens`);
    return JSON.parse(text);
  }
}
