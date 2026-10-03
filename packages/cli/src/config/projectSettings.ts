import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Visibility } from "@mesh/contract";
import { PROJECT_SETTINGS_FILE } from "./paths.js";

export interface ProjectSettings {
  enabled: boolean;
  visibility: Visibility;
}

const DEFAULTS: ProjectSettings = { enabled: true, visibility: Visibility.shared };

export function loadProjectSettings(cwd: string): ProjectSettings {
  if (process.env.MESH_DISABLED === "1") return { ...DEFAULTS, enabled: false };
  const envVisibility = process.env.MESH_PRIVATE === "1" ? Visibility.private : undefined;
  const file = findUp(cwd, PROJECT_SETTINGS_FILE);
  const fromFile = file ? readSettings(file) : {};
  return {
    enabled: fromFile.enabled !== false,
    visibility: envVisibility ?? (fromFile.visibility === Visibility.private ? Visibility.private : Visibility.shared),
  };
}

function readSettings(file: string): Partial<ProjectSettings> {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Partial<ProjectSettings>;
  } catch {
    return {};
  }
}

function findUp(start: string, name: string): string | null {
  let dir = start;
  for (;;) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
