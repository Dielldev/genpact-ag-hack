import { AskIntent, PlanSource, type AskPlan, type AskResponse } from "../api/types.js";
import type { AgentRunner } from "../agent/types.js";
import type { AppDeps } from "../deps.js";
import { keywords } from "../text.js";

export const AGENT_DEGRADED = "The AI agent was unavailable, so this lists the matching records.";

function agentPlan(question: string): AskPlan {
  return { intent: AskIntent.other, person: null, modules: [], keywords: keywords(question, 8), since_days: null, source: PlanSource.llm };
}

export async function askWithAgent(deps: AppDeps, agent: AgentRunner, ws: string, question: string): Promise<AskResponse | null> {
  try {
    const out = await agent(ws, question);
    const sources = out.citations.length ? await deps.api.sessions(ws, { event_ids: out.citations, limit: 50 }) : [];
    return {
      answer: out.answer,
      no_record: out.no_record,
      citations: out.citations,
      sources: out.no_record ? [] : sources,
      knowledge: [],
      plan: agentPlan(question),
      blocks: out.blocks,
      steps: out.steps,
      elapsed_ms: out.elapsed_ms,
      model: out.model,
    };
  } catch (error) {
    deps.log(`ask: agent failed, falling back: ${(error as Error).message}`);
    return null;
  }
}
