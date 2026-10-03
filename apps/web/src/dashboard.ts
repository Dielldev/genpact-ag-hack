import { api } from "./api";
import { useLoad } from "./hooks";

const idle = <T,>(workspace: string, load: () => Promise<T>) => (workspace ? load() : Promise.resolve(undefined));

export function useDashboard(workspace: string) {
  const feed = useLoad(() => idle(workspace, () => api.feed(workspace, {})), [workspace], 4000);
  const warnings = useLoad(() => idle(workspace, () => api.warnings(workspace)), [workspace], 4000);
  const people = useLoad(() => idle(workspace, () => api.people(workspace)), [workspace], 15_000);
  const modules = useLoad(() => idle(workspace, () => api.modules(workspace)), [workspace], 30_000);
  const projects = useLoad(() => idle(workspace, () => api.projects(workspace)), [workspace], 15_000);
  return { feed, warnings, people, modules, projects };
}

export type Dashboard = ReturnType<typeof useDashboard>;
