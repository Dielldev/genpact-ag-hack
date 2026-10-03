const HEADER_PATTERN = /^\s*\[\[?([^\]]+)\]\]?\s*(#.*)?$/;

interface SectionRange {
  start: number;
  end: number;
}

export function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function hasTomlSection(text: string, section: string): boolean {
  return findSection(splitLines(text), section) !== null;
}

export function readTomlKey(text: string, section: string, key: string): string | null {
  const lines = splitLines(text);
  const range = findSection(lines, section);
  if (!range) return null;
  for (let i = range.start + 1; i < range.end; i++) {
    const match = lines[i]?.match(keyPattern(key));
    if (match) return match[1]?.trim() ?? null;
  }
  return null;
}

export function upsertTomlKey(text: string, section: string, key: string, literal: string): string {
  const lines = splitLines(text);
  const entry = `${key} = ${literal}`;
  const range = findSection(lines, section);
  if (!range) {
    const prefix = lines.length > 0 && lines[lines.length - 1]?.trim() !== "" ? [""] : [];
    return joinLines([...lines, ...prefix, `[${section}]`, entry]);
  }
  for (let i = range.start + 1; i < range.end; i++) {
    if (keyPattern(key).test(lines[i] ?? "")) {
      lines[i] = entry;
      return joinLines(lines);
    }
  }
  let insertAt = range.end;
  while (insertAt > range.start + 1 && (lines[insertAt - 1] ?? "").trim() === "") insertAt--;
  lines.splice(insertAt, 0, entry);
  return joinLines(lines);
}

export function removeTomlSection(text: string, section: string): string {
  const lines = splitLines(text);
  const range = findSection(lines, section);
  if (!range) return text;
  lines.splice(range.start, range.end - range.start);
  return joinLines(lines);
}

function findSection(lines: string[], section: string): SectionRange | null {
  const start = lines.findIndex((line) => line.match(HEADER_PATTERN)?.[1]?.trim() === section);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !HEADER_PATTERN.test(lines[end] ?? "")) end++;
  return { start, end };
}

function keyPattern(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*=(.*)$`);
}

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") lines.pop();
  return lines;
}

function joinLines(lines: string[]): string {
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") lines.pop();
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}
