import type { ReactNode } from "react";

interface Props {
  title: string;
  count?: number;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Block({ title, count, aside, className = "", children }: Props) {
  return (
    <section className={`rep-block ${className}`.trim()}>
      <header className="rep-block-head">
        <h3>{title}</h3>
        {count !== undefined && <span className="rep-count">{count}</span>}
        {aside && <span className="rep-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function None({ children }: { children: ReactNode }) {
  return <p className="rep-none">{children}</p>;
}
