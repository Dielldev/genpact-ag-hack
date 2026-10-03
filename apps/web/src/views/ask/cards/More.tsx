import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export function More({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`ask-more${open ? " is-open" : ""}`}>
      <button type="button" className="ask-more-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={14} />
        <span>More details</span>
        <em>{summary}</em>
      </button>
      <div className="ask-more-body">{children}</div>
    </section>
  );
}

const NAMES: Record<string, string> = {
  bars: "modules",
  timeline: "timeline",
  sessions: "sessions",
  insights: "decisions and dead ends",
};

export function summaryOf(types: string[], sources: boolean): string {
  const names = [...new Set(types.map((t) => NAMES[t]).filter(Boolean))];
  if (sources) names.push("sources");
  return names.join(", ");
}
