import type { AskResponse } from "@mesh/server/api";
import { Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { toMarkdown } from "../markdown";

const seconds = (ms: number) => (ms < 100 ? "<0.1s" : `${(ms / 1000).toFixed(1)}s`);

interface Props {
  question: string;
  answer: AskResponse;
}

export function Steps({ question, answer }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const steps = answer.steps ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(question, answer));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ask-steps">
      <div className="ask-steps-bar">
        {steps.length > 0 || answer.elapsed_ms ? (
          <button type="button" className="ask-steps-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={steps.length === 0}>
            <ChevronRight size={13} className={open ? "is-open" : undefined} />
            {steps.length > 0 ? `Worked through ${steps.length} ${steps.length === 1 ? "step" : "steps"}` : "Answered"}
            {answer.elapsed_ms ? <span className="faint"> · {seconds(answer.elapsed_ms)}</span> : null}
          </button>
        ) : <span />}
        <span className="ask-steps-right">
          {answer.model && <span className="rep-chip rep-chip-mono" title="Model">{answer.model}</span>}
          <button type="button" className="btn btn-ghost ask-copy" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy as Markdown"}</span>
          </button>
        </span>
      </div>
      {open && (
        <ol className="ask-steps-list">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="ask-step-n">{i + 1}</span>
              <span className="ask-step-label">{s.label}</span>
              {s.tool && <span className="rep-chip rep-chip-mono">{s.tool}</span>}
              <span className="ask-step-ms">{s.ms < 1000 ? `${Math.round(s.ms)}ms` : seconds(s.ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
