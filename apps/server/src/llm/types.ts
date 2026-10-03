export enum LlmPurpose {
  plan = "plan",
  answer = "answer",
  exitQuestions = "exit_questions",
}

export type Effort = "low" | "medium" | "high";

export interface LlmRequest {
  purpose: LlmPurpose;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  temperature?: number;
  effort?: Effort;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface LlmClient {
  readonly mode: "anthropic" | "test";
  completeJson(req: LlmRequest): Promise<unknown>;
}

export class Timeout extends Error {}

export function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Timeout(`timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([work(controller.signal), deadline]).finally(() => clearTimeout(timer));
}
