import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getKey } from "../api";
import { installCommand, type InstallShell } from "../install";

interface Props {
  onClose: () => void;
}

const TABS: Array<{ id: InstallShell; label: string }> = [
  { id: "posix", label: "macOS / Linux" },
  { id: "powershell", label: "Windows (PowerShell)" },
];

const COPIED_MS = 1500;

export function InstallDialog({ onClose }: Props) {
  const [shell, setShell] = useState<InstallShell>("posix");
  const [copied, setCopied] = useState(false);
  const block = useRef<HTMLPreElement>(null);
  const command = installCommand(shell, window.location.origin, getKey());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      if (block.current) window.getSelection()?.selectAllChildren(block.current);
    }
  };

  return (
    <div className="backdrop palette-wrap" data-modal onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-wide" role="dialog" aria-label="Install the hook">
        <header className="dialog-head">
          <h2>Install the hook</h2>
          <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <p className="muted">Run one command in a terminal on the machine where you use Claude Code.</p>
        <div className="seg" role="group" aria-label="Operating system">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={shell === t.id} onClick={() => { setShell(t.id); setCopied(false); }}>{t.label}</button>
          ))}
        </div>
        <div className="code-wrap">
          <pre ref={block} className="code" tabIndex={0}><code>{command}</code></pre>
          <button type="button" className="btn code-copy" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="muted small">Then restart Claude Code and work as usual.</p>
      </div>
    </div>
  );
}
