import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type JsonObject = Record<string, unknown>;

export class ConfigParseError extends Error {
  constructor(public readonly path: string, cause: unknown) {
    super(`Could not parse ${path} (${cause instanceof Error ? cause.message : String(cause)}). Left it untouched.`);
  }
}

export function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8").replace(/^﻿/, "") : "";
}

export function readJson<T>(path: string, fallback: T): T {
  const text = readText(path);
  if (text.trim() === "") return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ConfigParseError(path, error);
  }
}

export function writeJson(path: string, data: unknown, backup = true): void {
  if (backup) backupOnce(path);
  writeAtomic(path, JSON.stringify(data, null, 2) + "\n");
}

export function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.mesh-tmp`;
  writeFileSync(temp, content, "utf8");
  renameSync(temp, path);
}

export function backupOnce(path: string): void {
  const backupPath = `${path}.mesh-backup`;
  if (existsSync(path) && !existsSync(backupPath)) copyFileSync(path, backupPath);
}

export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
