import { PersonStatus } from "@mesh/contract";
import type { PersonSummary } from "@mesh/server/api";
import { ChartNoAxesColumn, GitFork, History, OctagonAlert, Sun, Trophy, UserRound, type LucideIcon } from "lucide-react";

export interface Command {
  id: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  question: string;
  chip?: string;
}

export const STATIC_COMMANDS: Command[] = [
  { id: "sprint", icon: ChartNoAxesColumn, label: "Sprint report", hint: "Status, top performers, blockers and modules for this week", question: "Sprint report for this week", chip: "Sprint" },
  { id: "standup", icon: Sun, label: "Today's standup", hint: "What every developer worked on in the last 24 hours", question: "Today's standup", chip: "Standup" },
  { id: "blockers", icon: OctagonAlert, label: "Blockers right now", hint: "Who is blocked, for how long, and the most common issues", question: "Blockers right now", chip: "Blockers" },
  { id: "top", icon: Trophy, label: "Top contributors", hint: "Leaderboard by completed sessions, with activity over time", question: "Top contributors", chip: "Top contributors" },
  { id: "retro", icon: GitFork, label: "Dead ends and decisions", hint: "What was tried, what was ruled out, and why", question: "Dead ends and decisions this week", chip: "Dead ends" },
];

export function dynamicCommands(people: PersonSummary[] | undefined, modules: string[] | undefined): Command[] {
  const busiest = people?.find((p) => p.open_sessions > 0)?.person ?? people?.[0]?.person;
  const left = people?.find((p) => p.status !== PersonStatus.active);
  const target = left?.modules[0] ?? modules?.[1] ?? modules?.[0];
  const out: Command[] = [];
  if (busiest) out.push({ id: "person", icon: UserRound, label: `What is ${busiest} working on?`, hint: "Free-text question, answered from shared reports", question: `What is ${busiest} working on?` });
  if (target) out.push({ id: "module", icon: History, label: `What should I know before touching ${target}?`, hint: "History, dead ends and decisions for this module", question: `What should I know before touching ${target}?` });
  return out;
}
