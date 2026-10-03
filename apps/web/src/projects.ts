import type { FeedItem, Project } from "@mesh/server/api";

const GITHUB_URL = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;

export const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const clean = (url: string): string => url.trim().replace(/\/+$/, "").replace(/\.git$/i, "");

export function isGithubUrl(url: string): boolean {
  return GITHUB_URL.test(clean(url));
}

export function repoName(url: string | null | undefined): string | null {
  const match = url ? GITHUB_URL.exec(clean(url)) : null;
  return match?.[2] ?? null;
}

function keysOf(title: string, githubUrl: string | null | undefined): Set<string> {
  const keys = new Set([slug(title)]);
  const repo = repoName(githubUrl);
  if (repo) keys.add(slug(repo));
  keys.delete("");
  return keys;
}

export function matchProject(projects: Project[], title: string): (item: FeedItem) => boolean {
  if (!title) return () => true;
  const found = projects.find((p) => p.title === title);
  const keys = keysOf(title, found?.github_url);
  return (item) => item.project !== null && keys.has(slug(item.project));
}
