import type { BarsBlock, InsightsBlock, IssuesBlock, TimelineBlock } from "@mesh/server/api";
import { Avatar } from "../../../components/bits";
import { day, firstName } from "../../../format";
import { Block, None } from "./Block";
import { ReasonRow } from "./Reason";

export function IssuesView({ block }: { block: IssuesBlock }) {
  return (
    <Block title={block.title} count={block.rows.length}>
      {block.rows.length === 0 ? <None>No blockers, collisions or rediscoveries in this period.</None> : (
        <ul className="rep-rows">
          {block.rows.map((r, i) => (
            <li key={`${r.kind}-${i}`} className="rep-issue rep-issue-static">
              {r.kind === "blocker" ? <span className="rep-times">{r.count}×</span> : <span className={`rep-chip rep-chip-${r.kind}`}>{r.kind}</span>}
              <span className="rep-issue-main">
                <span className="rep-issue-text rep-clamp">{r.text}</span>
                <span className="rep-issue-who">
                  {r.people.slice(0, 4).map((p) => <Avatar key={p} name={p} size={16} />)}
                  <span>{r.people.map(firstName).join(", ")}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function BarsView({ block }: { block: BarsBlock }) {
  const max = Math.max(1, ...block.rows.map((r) => r.value));
  const mono = /module|area|file/i.test(block.title);
  return (
    <Block title={block.title} count={block.rows.length}>
      {block.rows.length === 0 ? <None>Nothing to show in this period.</None> : (
        <ul className="rep-rows">
          {block.rows.map((r) => (
            <li key={r.label} className="rep-mod">
              <span className={mono ? "rep-mono" : "rep-name"}>{r.label}</span>
              <span className="rep-track"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
              <span className="rep-num">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function TimelineView({ block }: { block: TimelineBlock }) {
  const { buckets } = block;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const peakAt = buckets.reduce((best, b, i) => (b.count > (buckets[best]?.count ?? 0) ? i : best), 0);
  const peak = buckets[peakAt];
  const marks = [...new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1])].map((i) => buckets[i]);
  return (
    <Block title={block.title} count={buckets.reduce((n, b) => n + b.count, 0)} aside={peak && peak.count > 0 ? `Peak ${peak.count} at ${peak.label}` : undefined}>
      {buckets.length === 0 ? <None>No activity in this period.</None> : (
        <>
          <div className="rep-chart" role="img" aria-label="Sessions over time">
            {buckets.map((b, i) => (
              <span key={`${b.label}-${i}`} className={`rep-col${i === peakAt && b.count > 0 ? " is-peak" : ""}`} title={`${b.label}: ${b.count}`}>
                <i style={{ height: b.count === 0 ? 2 : `${Math.max(6, (b.count / max) * 100)}%` }} />
              </span>
            ))}
          </div>
          <div className="rep-axis">
            {marks.map((b, i) => <span key={i}>{b?.label}</span>)}
          </div>
        </>
      )}
    </Block>
  );
}

export function InsightsView({ block, onOpen }: { block: InsightsBlock; onOpen: (id: string) => void }) {
  return (
    <Block title={block.title} count={block.rows.length}>
      {block.rows.length === 0 ? <None>Nothing recorded in this period.</None> : (
        <ul className="rep-rows">
          {block.rows.map((r, i) => (
            <ReasonRow
              key={`${r.event_id}-${i}`}
              kind={block.kind === "decisions" ? "Decision" : "Dead end"}
              title={r.title}
              reason={r.reason}
              meta={`${r.person} · ${day(r.ts)}`}
              onClick={() => r.event_id && onOpen(r.event_id)}
            />
          ))}
        </ul>
      )}
    </Block>
  );
}
