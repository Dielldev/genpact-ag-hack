import { CornerDownLeft, Sparkles } from "lucide-react";
import type { Command } from "./commands";

export function EmptyState({ commands, onRun }: { commands: Command[]; onRun: (c: Command) => void }) {
  return (
    <div className="ask-empty">
      <span className="ask-tile"><Sparkles size={20} /></span>
      <h2>Ask Mesh</h2>
      <p>Reports and answers are built from what the team's agents have shared. Pick a command or type a question.</p>
      <ul className="ask-cmds" aria-label="Commands">
        {commands.map((c) => (
          <li key={c.id}>
            <button type="button" className="ask-cmd" onClick={() => onRun(c)}>
              <span className="ask-cmd-icon"><c.icon size={15} /></span>
              <span className="ask-cmd-label">{c.label}</span>
              <span className="ask-cmd-hint">{c.hint}</span>
              <kbd className="ask-cmd-kbd"><CornerDownLeft size={10} /></kbd>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
