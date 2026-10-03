import type { AnswerBlock, AskResponse } from "@mesh/server/api";
import { duration } from "../../format";

const bullet = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");

function blockText(b: AnswerBlock): string {
  switch (b.type) {
    case "kpis": return `**${b.title ?? "Key numbers"}**: ${b.items.map((k) => `${k.label} ${k.value}`).join(" · ")}`;
    case "status": return `## ${b.title}\n\n${b.segments.map((s) => `${s.label} ${s.count}`).join(" · ")}`;
    case "leaderboard": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `${r.person}: ${r.value} ${b.unit}${r.detail ? ` (${r.detail})` : ""}`))}`;
    case "blockers": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `${r.person}${r.ticket_ref ? ` ${r.ticket_ref}` : ""}: ${r.blocker} (${duration(r.minutes)})`))}`;
    case "issues": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `[${r.kind}] ${r.text} (${r.people.join(", ")})`))}`;
    case "bars": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `${r.label}: ${r.value}`))}`;
    case "timeline": return `## ${b.title}\n\n${bullet(b.buckets.map((r) => `${r.label}: ${r.count}`))}`;
    case "sessions": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `${r.ticket_ref ? `${r.ticket_ref} · ` : ""}${r.task ?? "Open session"} (${r.person}, ${r.status})`))}`;
    case "insights": return `## ${b.title}\n\n${bullet(b.rows.map((r) => `${r.title}: ${r.reason} (${r.person})`))}`;
    case "person": return `## ${b.person}\n\n${b.done} done · ${b.in_progress} in progress · ${b.blocked} blocked`;
  }
}

export function toMarkdown(question: string, answer: AskResponse): string {
  const blocks = (answer.blocks ?? []).map(blockText);
  return [`# ${question}`, answer.answer, ...blocks].filter(Boolean).join("\n\n");
}
