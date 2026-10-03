import type { AnswerBlock } from "@mesh/server/api";
import type { ReactNode } from "react";
import { BarsView, InsightsView, TimelineView } from "./Insights";
import { SessionsView } from "./SessionRow";

interface Props {
  block: AnswerBlock;
  now: number;
  onOpen: (id: string) => void;
}

export function BlockView({ block, now, onOpen }: Props): ReactNode {
  switch (block.type) {
    case "bars": return <BarsView block={block} />;
    case "timeline": return <TimelineView block={block} />;
    case "sessions": return <SessionsView block={block} now={now} onOpen={onOpen} />;
    case "insights": return <InsightsView block={block} onOpen={onOpen} />;
    default: return null;
  }
}

const PAIRABLE = new Set<AnswerBlock["type"]>(["bars", "timeline"]);

export function BlockList({ blocks, now, onOpen }: { blocks: AnswerBlock[]; now: number; onOpen: (id: string) => void }) {
  const rows: AnswerBlock[][] = [];
  for (const b of blocks) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && PAIRABLE.has(b.type) && PAIRABLE.has(last[0]!.type)) last.push(b);
    else rows.push([b]);
  }
  return (
    <div className="rep">
      {rows.map((row, i) => (
        <div key={i} className={`rep-row rep-row-${row.length}`}>
          {row.map((b, j) => <div key={j} className="rep-cell"><BlockView block={b} now={now} onOpen={onOpen} /></div>)}
        </div>
      ))}
    </div>
  );
}
