import type { PersonStatus } from "@mesh/contract";
import type {
  AskResponse,
  EventResponse,
  ExitInterviewResponse,
  FeedResponse,
  KnowledgeEntry,
  OnboardingResponse,
  PeopleResponse,
  WarningsResponse,
  WorkspacesResponse,
} from "@mesh/server/api";

export interface ModulesResponse {
  workspace: string;
  modules: string[];
  tags: string[];
  people: string[];
}

export interface FeedFilters {
  person?: string;
  status?: string;
  module?: string;
  since?: string;
}

export interface MeshClient {
  health(): Promise<boolean>;
  workspaces(): Promise<WorkspacesResponse>;
  people(ws: string): Promise<PeopleResponse>;
  modules(ws: string): Promise<ModulesResponse>;
  feed(ws: string, filters: FeedFilters): Promise<FeedResponse>;
  event(ws: string, id: string): Promise<EventResponse>;
  warnings(ws: string): Promise<WarningsResponse>;
  ask(ws: string, question: string): Promise<AskResponse>;
  exitInterview(ws: string, person: string): Promise<ExitInterviewResponse>;
  setStatus(ws: string, person: string, status: PersonStatus): Promise<unknown>;
  generateQuestions(ws: string, person: string, force: boolean): Promise<ExitInterviewResponse>;
  saveAnswer(ws: string, person: string, questionId: string, answer: string): Promise<KnowledgeEntry>;
  onboarding(ws: string, module: string): Promise<OnboardingResponse>;
}

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`);
  return body as T;
}

const q = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  return `?${search.toString()}`;
};
const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
const enc = encodeURIComponent;

const httpClient: MeshClient = {
  health: () => fetch("/api/v1/health").then((r) => r.ok).catch(() => false),
  workspaces: () => request("/workspaces"),
  people: (ws) => request(`/people${q({ workspace: ws })}`),
  modules: (ws) => request(`/modules${q({ workspace: ws })}`),
  feed: (ws, f) => request(`/feed${q({ workspace: ws, ...f })}`),
  event: (ws, id) => request(`/events/${enc(id)}${q({ workspace: ws })}`),
  warnings: (ws) => request(`/warnings${q({ workspace: ws })}`),
  ask: (ws, question) => post("/ask", { workspace: ws, question }),
  exitInterview: (ws, person) => request(`/exit-interview/${enc(person)}${q({ workspace: ws })}`),
  setStatus: (ws, person, status) => post(`/people/${enc(person)}/status`, { workspace: ws, status }),
  generateQuestions: (ws, person, force) => post(`/exit-interview/${enc(person)}/questions`, { workspace: ws, force }),
  saveAnswer: (ws, person, questionId, answer) => post(`/exit-interview/${enc(person)}/answers`, { workspace: ws, question_id: questionId, answer }),
  onboarding: (ws, module) => request(`/onboarding/${enc(module)}${q({ workspace: ws })}`),
};

export const MOCK = import.meta.env.VITE_MOCK === "1";
const lazyMock = new Proxy({} as MeshClient, {
  get: (_target, key: keyof MeshClient) => (...args: unknown[]) =>
    import("./mock/client").then((m) => (m.mockClient[key] as (...a: unknown[]) => unknown)(...args)),
});

export const api: MeshClient = MOCK ? lazyMock : httpClient;
