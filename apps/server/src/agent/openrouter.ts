import { AgentError } from "./types.js";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning?: string | null;
  reasoning_details?: unknown;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface ChatResult {
  message: ChatMessage;
  usage: ChatUsage | null;
}

export interface ChatOptions {
  timeoutMs?: number;
  toolChoice?: "auto" | "none";
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  referer: string;
  requestTimeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  backoffMs?: number;
  fetchImpl?: typeof fetch;
}

export interface OpenRouterClient {
  readonly model: string;
  chat(messages: ChatMessage[], tools: ToolSpec[], options?: ChatOptions): Promise<ChatResult>;
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

class Retryable extends AgentError {}

function describe(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 200);
  if (value && typeof value === "object") {
    const message = (value as Record<string, unknown>).message;
    if (typeof message === "string") return message.slice(0, 200);
  }
  return "unknown error";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseBody(text: string, status: number): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new AgentError(`OpenRouter returned a non-JSON body (HTTP ${status})`);
    throw isRetryableStatus(status) ? new Retryable(error.message) : error;
  }
  if (!parsed || typeof parsed !== "object") throw new AgentError(`OpenRouter returned an unexpected body (HTTP ${status})`);
  return parsed as Record<string, unknown>;
}

function toResult(body: Record<string, unknown>): ChatResult {
  const choices = body.choices;
  const first = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
  const raw = first?.message as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") throw new AgentError("OpenRouter returned no message");
  const calls = Array.isArray(raw.tool_calls) ? (raw.tool_calls as ToolCall[]).filter((c) => c?.function && typeof c.function.name === "string") : [];
  const message: ChatMessage = {
    role: "assistant",
    content: typeof raw.content === "string" ? raw.content : null,
    ...(calls.length ? { tool_calls: calls } : {}),
    ...(typeof raw.reasoning === "string" ? { reasoning: raw.reasoning } : {}),
    ...(raw.reasoning_details !== undefined && raw.reasoning_details !== null ? { reasoning_details: raw.reasoning_details } : {}),
  };
  const usage = body.usage as Record<string, unknown> | undefined;
  return {
    message,
    usage: usage ? { prompt_tokens: Number(usage.prompt_tokens) || 0, completion_tokens: Number(usage.completion_tokens) || 0 } : null,
  };
}

export function createOpenRouter(config: OpenRouterConfig): OpenRouterClient {
  const doFetch = config.fetchImpl ?? fetch;
  const backoff = config.backoffMs ?? 600;

  async function attempt(payload: string, timeoutMs: number): Promise<ChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await doFetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.referer,
          "X-Title": "Mesh",
        },
        body: payload,
      });
      text = await res.text();
    } catch (error) {
      const aborted = (error as Error).name === "AbortError" || controller.signal.aborted;
      throw new Retryable(aborted ? `OpenRouter request timed out after ${timeoutMs}ms` : "OpenRouter request failed (network)");
    } finally {
      clearTimeout(timer);
    }
    const body = parseBody(text, res.status);
    if (body.error) {
      const code = Number((body.error as Record<string, unknown>)?.code ?? res.status);
      const message = `OpenRouter error ${code}: ${describe(body.error)}`;
      throw isRetryableStatus(code) ? new Retryable(message) : new AgentError(message);
    }
    if (!res.ok) {
      const message = `OpenRouter HTTP ${res.status}`;
      throw isRetryableStatus(res.status) ? new Retryable(message) : new AgentError(message);
    }
    return toResult(body);
  }

  return {
    model: config.model,
    async chat(messages, tools, options = {}) {
      const payload = JSON.stringify({
        model: config.model,
        messages,
        ...(tools.length ? { tools, tool_choice: options.toolChoice ?? "auto" } : {}),
        reasoning: { effort: "low" },
        max_tokens: config.maxTokens ?? 4000,
        temperature: config.temperature ?? 0.2,
      });
      const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? config.requestTimeoutMs ?? 45_000, config.requestTimeoutMs ?? 45_000));
      try {
        return await attempt(payload, timeoutMs);
      } catch (error) {
        if (!(error instanceof Retryable)) throw error;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return attempt(payload, timeoutMs);
      }
    },
  };
}
