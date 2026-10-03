import type { AnswerBlock } from "@mesh/server/api";
import type { ReactNode } from "react";
import { BarsView, InsightsView, IssuesView, TimelineView } from "./Insights";
import { KpisView, StatusView } from "./Overview";
import { BlockersView, LeaderboardView, PersonView } from "./People";
import { SessionsView } from "./SessionRow";

interface Props {
  block: AnswerBlock;
  now: number;
  onOpen: (id: string) => void;
}

export function BlockView({ block, now, onOpen }: Props): ReactNode {
  switch (block.type) {
    case "kpis": return <KpisView block={block} />;
    case "status": return <StatusView block={block} />;
    case "leaderboard": return <LeaderboardView block={block} onOpen={onOpen} />;
    case "blockers": return <BlockersView block={block} onOpen={onOpen} />;
    case "issues": return <IssuesView block={block} />;
    case "bars": return <BarsView block={block} />;
    case "timeline": return <TimelineView block={block} />;
    case "sessions": return <SessionsView block={block} now={now} onOpen={onOpen} />;
    case "insights": return <InsightsView block={block} onOpen={onOpen} />;
    case "person": return <PersonView block={block} now={now} onOpen={onOpen} />;
  }
}

const PAIRABLE = new Set<AnswerBlock["type"]>(["leaderboard", "blockers", "bars", "timeline"]);

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
