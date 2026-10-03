import type { EventRecord } from "@mesh/server/api";
import { Fragment, type ReactNode } from "react";
import { firstName } from "../../../format";

const TOKEN = /\*\*([^*]+)\*\*|\[((?:evt_|session-)[\w-]+(?:\s*,\s*(?:evt_|session-)[\w-]+)*)\]/g;

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const item = /^(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (item) {
      if (last?.type === "ul") last.items.push(item[1]!);
      else blocks.push({ type: "ul", items: [item[1]!] });
    } else blocks.push({ type: "p", text: line });
  }
  return blocks;
}

const idOf = (e: EventRecord) => e.event_id ?? `session-${e.session_pk}`;

function labelFor(id: string, sources: EventRecord[]): string {
  const hit = sources.find((s) => idOf(s) === id || s.event_ids.includes(id));
  if (hit) return hit.ticket_ref ?? firstName(hit.person);
  return `${id.slice(0, 8)}…`;
}

function Cite({ id, sources, onOpen }: { id: string; sources: EventRecord[]; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="ask-cite" onClick={() => onOpen(id)} title={`Open ${id}`}>
      {labelFor(id, sources)}
    </button>
  );
}

export function Inline({ text, sources, onOpen }: { text: string; sources: EventRecord[]; onOpen: (id: string) => void }) {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1]) out.push(<strong key={n++}>{m[1]}</strong>);
    else
      for (const id of (m[2] ?? "").split(/\s*,\s*/)) out.push(<Cite key={n++} id={id} sources={sources} onOpen={onOpen} />);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}

export function RichText({ text, sources, onOpen }: { text: string; sources: EventRecord[]; onOpen: (id: string) => void }) {
  return (
    <div className="ask-prose">
      {blocksOf(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}><Inline text={b.text} sources={sources} onOpen={onOpen} /></p>
        ) : (
          <ul key={i}>
            {b.items.map((item, j) => <li key={j}><Inline text={item} sources={sources} onOpen={onOpen} /></li>)}
          </ul>
        ),
      )}
    </div>
  );
}
