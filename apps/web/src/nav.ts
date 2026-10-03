import { Activity, BookOpen, CalendarClock, DoorOpen, GitCompareArrows, MessageSquareText, type LucideIcon } from "lucide-react";

export interface ViewDef {
  id: string;
  label: string;
  icon: LucideIcon;
  keys: string;
  subtitle: string;
}

export const VIEWS: ViewDef[] = [
  { id: "feed", label: "Live feed", icon: Activity, keys: "g f", subtitle: "Everything the team's agents are doing right now." },
  { id: "ask", label: "Ask", icon: MessageSquareText, keys: "g a", subtitle: "Answers come only from shared reports and exit-interview answers, with the sessions they cite." },
  { id: "automations", label: "Automations", icon: CalendarClock, keys: "g u", subtitle: "Reports Mesh builds on a schedule, without anyone asking." },
  { id: "collisions", label: "Collisions", icon: GitCompareArrows, keys: "g c", subtitle: "Warnings the server returned to agents while they worked. Each one was also shown to the developer." },
  { id: "exit", label: "Exit interview", icon: DoorOpen, keys: "g e", subtitle: "Capture what a departing person knows, built from their own reports." },
  { id: "onboarding", label: "Onboarding", icon: BookOpen, keys: "g o", subtitle: "History, dead ends, decisions and exit-interview answers for any module, even when the owner has gone." },
];
