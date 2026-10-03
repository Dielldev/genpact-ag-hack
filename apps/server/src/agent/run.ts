import type { AskStep } from "../api/blocks.js";
import type { Config } from "../config.js";
import type { MeshApi } from "../db/meshApi.js";
import { redact } from "../redact.js";
import { clip } from "../text.js";
import { createOpenRouter, type ChatMessage } from "./openrouter.js";
import { FORCE_TOOL_NOTE, systemPrompt } from "./prompt.js";
import { BlockLedger, executeTool, toolSpecs } from "./toolkit.js";
import { AgentError, type AgentResult, type AgentRunner, type ToolContext } from "./types.js";

export interface AgentOptions {
  api: MeshApi;
  config: Config;
  clock: () => Date;
  log: (message: string) => void;
  fetchImpl?: typeof fetch;
  backoffMs?: number;
}

const NO_RECORD = "No record: I can only answer from the team's shared reports. Ask about a person, a period, a module or a past decision.";
const CITATION = /\[?\b(evt_[A-Za-z0-9_-]+|session-\d+)\b\]?/g;

function tidy(answer: string, known: Set<string>): { answer: string; citations: string[] } {
  const cited: string[] = [];
  const text = answer
    .replace(CITATION, (match, id: string) => {
      if (!known.has(id)) return "";
      if (!cited.includes(id)) cited.push(id);
      return match;
    })
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { answer: text, citations: cited };
}

export function createAgentRunner(opts: AgentOptions): AgentRunner {
  const { config } = opts;
  const client = createOpenRouter({
    apiKey: config.openrouterApiKey ?? "",
    model: config.agentModel,
    referer: config.publicUrl ?? "https://mesh.local",
    fetchImpl: opts.fetchImpl,
    backoffMs: opts.backoffMs,
  });

  return async (workspace, question) => {
    const started = Date.now();
    const deadline = started + config.agentTimeoutMs;
    const vocabulary = await opts.api.vocabulary(workspace);
    const now = opts.clock();
    const ledger = new BlockLedger();
    const ctx: ToolContext = { api: opts.api, workspace, now, vocabulary, emit: (blocks) => ledger.add(blocks), log: opts.log };
    const specs = toolSpecs();
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(now.toISOString().slice(0, 10), vocabulary) },
      { role: "user", content: clip(question, 500) },
    ];
    const steps: AskStep[] = [];
    const known = new Set<string>();
    let toolCalls = 0;
    let forced = false;

    for (let turn = 0; turn < config.agentMaxSteps + 1; turn++) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) throw new AgentError("agent ran out of time");
      const last = turn >= config.agentMaxSteps;
      const thinking = Date.now();
      const { message } = await client.chat(messages, specs, { timeoutMs: remaining, toolChoice: last ? "none" : "auto" });
      const calls = message.tool_calls ?? [];
      if (calls.length > 0 && !last) {
        messages.push(message);
        const runs = await Promise.all(calls.map((call) => executeTool(call, ctx, ledger)));
        for (const run of runs) {
          messages.push(run.message);
          steps.push(run.step);
          for (const id of run.message.content?.match(/evt_[A-Za-z0-9_-]+|session-\d+/g) ?? []) known.add(id);
        }
        toolCalls += calls.length;
        continue;
      }
      const content = message.content?.trim() ?? "";
      if (toolCalls === 0 && !forced && !last) {
        forced = true;
        messages.push({ ...message, content: content || null }, { role: "user", content: FORCE_TOOL_NOTE });
        continue;
      }
      if (!content) throw new AgentError("the model returned an empty answer");
      steps.push({ label: "Writing the answer", tool: null, ms: Date.now() - thinking });
      const elapsed = Date.now() - started;
      if (toolCalls === 0) return { answer: NO_RECORD, no_record: true, citations: [], blocks: [], steps, elapsed_ms: elapsed, model: config.agentModel };
      const { answer, citations } = tidy(redact(content), known);
      const noRecord = /^\W*no record\b/i.test(answer);
      const result: AgentResult = {
        answer,
        no_record: noRecord,
        citations: noRecord ? [] : citations,
        blocks: noRecord ? [] : ledger.list(),
        steps,
        elapsed_ms: elapsed,
        model: config.agentModel,
      };
      return result;
    }
    throw new AgentError("the agent did not finish");
  };
}
