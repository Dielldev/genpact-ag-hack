import { useEffect } from "react";

const ROWS: Array<[string, string[]]> = [
  ["Open the command palette", ["⌘", "K"]],
  ["Go to Live feed", ["G", "F"]],
  ["Go to Collisions", ["G", "C"]],
  ["Go to Ask", ["G", "A"]],
  ["Go to Exit interview", ["G", "E"]],
  ["Go to Onboarding", ["G", "O"]],
  ["Move through sessions", ["J", "K"]],
  ["Open the selected session", ["↵"]],
  ["Collapse the sidebar", ["["]],
  ["Close any panel", ["esc"]],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop palette-wrap" data-modal onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="help" role="dialog" aria-label="Keyboard shortcuts">
        <h2>Keyboard shortcuts</h2>
        {ROWS.map(([label, keys]) => (
          <div key={label} className="help-row">
            <span>{label}</span>
            <span className="help-keys">{keys.map((k, i) => <span key={k}>{i > 0 && "then "}<kbd>{k}</kbd></span>)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
