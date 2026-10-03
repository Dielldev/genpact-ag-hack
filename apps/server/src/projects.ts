import { z } from "zod";
import type { Project } from "./api/types.js";
import type { AppDeps } from "./deps.js";
import { redact } from "./redact.js";
import { issuesOf, ValidationError } from "./schemas.js";
import { clip } from "./text.js";

const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const CreateProjectSchema = z.object({
  workspace: z.string().trim().min(1),
  title: z.string().trim().min(1, "title is required").max(80, "title must be at most 80 characters"),
  github_url: z.string().trim().nullish(),
  created_by: z.string().trim().min(1, "created_by is required"),
});

export function normalizeGithubUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const cleaned = value.replace(/\/+$/, "").replace(/\.git$/i, "");
  if (!GITHUB_URL.test(cleaned)) throw new ValidationError(["github_url must look like https://github.com/owner/repo"]);
  return cleaned;
}

export async function createProject(deps: AppDeps, raw: unknown): Promise<Project> {
  const parsed = CreateProjectSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(issuesOf(parsed.error));
  const p = parsed.data;
  return deps.api.createProject({
    workspace: clip(p.workspace, 200),
    title: clip(redact(p.title), 80),
    github_url: normalizeGithubUrl(p.github_url),
    created_by: clip(p.created_by, 200),
  });
}
