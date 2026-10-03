import type { AskResponse } from "@mesh/server/api";
import { Check, ChevronRight, Copy } from "lucide-react";
import { useState, type RefObject } from "react";
import { toMarkdown } from "../markdown";
import { PdfButton } from "./PdfButton";

const seconds = (ms: number) => (ms < 100 ? "<0.1s" : `${(ms / 1000).toFixed(1)}s`);

interface Props {
  question: string;
  answer: AskResponse;
  target: RefObject<HTMLElement | null>;
  workspace: string;
}

export function Steps({ question, answer, target, workspace }: Props) {
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
    <div className="ask-quiet" data-pdf-hide>
      <div className="ask-quiet-line">
        {steps.length > 0 || answer.elapsed_ms ? (
          <button type="button" className="ask-link" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={steps.length === 0}>
            {steps.length > 0 && <ChevronRight size={12} className={open ? "is-open" : undefined} />}
            {steps.length > 0 ? `Worked through ${steps.length} ${steps.length === 1 ? "step" : "steps"}` : "Answered"}
            {answer.elapsed_ms ? ` · ${seconds(answer.elapsed_ms)}` : ""}
          </button>
        ) : null}
        {answer.model && <span className="ask-model" title="Model">{answer.model}</span>}
        <PdfButton target={target} title={question} workspace={workspace} />
        <button type="button" className="ask-link" onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>
      {open && (
        <ol className="ask-steps-list">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="ask-step-n">{i + 1}</span>
              <span className="ask-step-label">{s.label}</span>
              {s.tool && <span className="ask-model">{s.tool}</span>}
              <span className="ask-step-ms">{s.ms < 1000 ? `${Math.round(s.ms)}ms` : seconds(s.ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
