import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`ask-card ${className}`.trim()}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function ExpandList({ rows, cap }: { rows: ReactNode[]; cap: number }) {
  const [open, setOpen] = useState(false);
  const hidden = rows.length - cap;
  return (
    <>
      <ul className={`ask-list${open ? " is-open" : ""}`}>
        {rows.map((row, i) => <li key={i} className={i >= cap ? "ask-extra" : undefined}>{row}</li>)}
      </ul>
      {hidden > 0 && (
        <button type="button" className="ask-toggle" onClick={() => setOpen((v) => !v)} data-pdf-hide>
          <ChevronDown size={13} className={open ? "is-flipped" : undefined} />
          {open ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </>
  );
}
