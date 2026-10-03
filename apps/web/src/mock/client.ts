import type { AskResponse, EventRecord, EventResponse, ExitInterviewResponse, FeedResponse, OnboardingResponse, PeopleResponse, WarningsResponse, WorkspacesResponse } from "@mesh/server/api";
import type { MeshClient, ModulesResponse } from "../api";
import raw from "./snapshot.json";

interface Space {
  feed: FeedResponse;
  warnings: WarningsResponse;
  people: PeopleResponse;
  modules: ModulesResponse;
  events: Record<string, EventResponse>;
  onboarding: Record<string, OnboardingResponse>;
  exit: Record<string, ExitInterviewResponse>;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const offset = Date.now() - Date.parse((raw as { generated_at: string }).generated_at);

function shift<T>(value: T): T {
  if (typeof value === "string") return (ISO.test(value) ? new Date(Date.parse(value) + offset).toISOString() : value) as T;
  if (Array.isArray(value)) return value.map(shift) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shift(v)])) as T;
  return value;
}

const data = shift(raw as unknown as { workspaces: WorkspacesResponse; spaces: Record<string, Space> });
const space = (ws: string): Space => {
  const s = data.spaces[ws];
  if (!s) throw new Error(`No demo data for ${ws}`);
  return s;
};
const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), 120));

function answerFor(ws: string, question: string): AskResponse {
  const words = question.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 3);
  const events = Object.values(space(ws).events).map((e) => e.event);
  const unique = [...new Map(events.map((e) => [e.session_pk, e])).values()];
  const score = (e: EventRecord) => {
    const text = `${e.person} ${e.task} ${e.summary} ${e.modules.join(" ")} ${e.dead_ends.map((d) => d.attempt + d.reason).join(" ")} ${e.decisions.map((d) => d.choice + d.reason).join(" ")}`.toLowerCase();
    return words.filter((w) => text.includes(w)).length;
  };
  const hits = unique.map((e) => ({ e, s: score(e) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => x.e);
  const plan = { intent: "why", person: null, modules: [], keywords: words, since_days: null, source: "heuristic" } as AskResponse["plan"];
  if (hits.length === 0) return { answer: "No record: the shared reports in this workspace do not cover that question.", no_record: true, citations: [], sources: [], knowledge: [], plan };
  const lines = hits.map((e) => `- ${e.person}: ${e.task} (${e.status?.replace("_", " ") ?? "active"}). ${e.summary ?? ""} [${e.event_id}]`);
  return { answer: `Matching records:\n${lines.join("\n")}`, no_record: false, citations: hits.map((e) => e.event_id ?? ""), sources: hits, knowledge: [], plan, degraded: "Demo mode: offline sample data, no live server." };
}

export const mockClient: MeshClient = {
  health: () => delay(true),
  workspaces: () => delay(data.workspaces),
  people: (ws) => delay(space(ws).people),
  modules: (ws) => delay(space(ws).modules),
  feed: (ws, f) =>
    delay({
      ...space(ws).feed,
      items: space(ws).feed.items.filter(
        (i) =>
          (!f.person || i.person === f.person) &&
          (!f.module || i.modules.includes(f.module)) &&
          (!f.status || (f.status === "active" ? i.report_count === 0 : i.status === f.status)),
      ),
    }),
  event: (ws, id) => {
    const e = space(ws).events[id];
    return e ? delay(e) : Promise.reject(new Error("Not in the demo data"));
  },
  warnings: (ws) => delay(space(ws).warnings),
  ask: (ws, question) => delay(answerFor(ws, question)),
  exitInterview: (ws, person) => {
    const e = space(ws).exit[person];
    return e ? delay(e) : Promise.reject(new Error("Not in the demo data"));
  },
  setStatus: async () => ({}),
  generateQuestions: (ws, person) => mockClient.exitInterview(ws, person),
  saveAnswer: async (ws, person, questionId, answer) => {
    const interview = space(ws).exit[person];
    const q = interview?.questions.find((x) => x.question_id === questionId);
    const entry = { entry_id: `demo-${questionId}`, workspace: ws, person, module: q?.module ?? null, question: q?.question ?? "", answer, source: "exit_interview", source_event_ids: q?.source_event_ids ?? [], created_at: new Date().toISOString() } as never;
    if (q && interview) {
      q.answer = entry;
      interview.entries = [...interview.entries.filter((k) => k.entry_id !== `demo-${questionId}`), entry];
    }
    return entry;
  },
  onboarding: (ws, module) => {
    const o = space(ws).onboarding[module];
    return o ? delay(o) : Promise.reject(new Error("Not in the demo data"));
  },
};
