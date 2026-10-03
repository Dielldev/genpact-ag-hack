import { WarningKind } from "@mesh/contract";
import type { FeedItem, PersonSummary, WarningCard } from "@mesh/server/api";
import { minutesSince } from "../../format";
import { toneFor } from "./filters";
import { LIVE_WITHIN_MINUTES } from "./boardModel";
import { pairKey, type Signal } from "./MeshGraph";
import { series, type Period } from "./series";

export interface StatValues {
  sessions: number;
  open: number;
  live: number;
  blocked: number;
  stuck: number;
  collisions: number;
  collisionsInPeriod: number;
  modules: number;
  startedInPeriod: number;
  sessionSpark: number[];
  collisionSpark: number[];
}

export function personSignals(items: FeedItem[], now: number): Record<string, Signal> {
  const signals: Record<string, Signal> = {};
  for (const i of items) {
    const tone = toneFor(i, now);
    const next: Signal | undefined = tone === "stuck" ? "stuck" : tone === "blocked" ? "blocked" : tone === "done" ? undefined : "open";
    const have = signals[i.person];
    if (next && (!have || (have === "open" && next !== "open") || (have === "blocked" && next === "stuck"))) signals[i.person] = next;
  }
  return signals;
}

export function clashPairs(warnings: WarningCard[]): Set<string> {
  const clashes = new Set<string>();
  for (const w of warnings) if (w.kind === WarningKind.collision) for (const s of w.sources) clashes.add(pairKey(w.reporter.person, s.person));
  return clashes;
}

export function overview(scoped: FeedItem[], scopedWarnings: WarningCard[], who: PersonSummary | undefined, now: number, period: Period): StatValues {
  const tones = scoped.map((i) => toneFor(i, now));
  const collisions = scopedWarnings.filter((w) => w.kind === WarningKind.collision);
  const started = series(scoped.map((i) => i.first_seen_at), now, period);
  const clashSeries = series(collisions.map((w) => w.created_at), now, period);
  return {
    sessions: who ? who.sessions : scoped.length,
    open: who ? who.open_sessions : tones.filter((t) => t !== "done").length,
    live: scoped.filter((i, n) => tones[n] !== "done" && minutesSince(i.last_seen_at, now) <= LIVE_WITHIN_MINUTES).length,
    blocked: tones.filter((t) => t === "blocked" || t === "stuck").length,
    stuck: tones.filter((t) => t === "stuck").length,
    collisions: collisions.length,
    collisionsInPeriod: clashSeries.counts.reduce((a, b) => a + b, 0),
    modules: who ? who.modules.length : new Set(scoped.flatMap((i) => i.modules)).size,
    startedInPeriod: started.counts.reduce((a, b) => a + b, 0),
    sessionSpark: started.counts,
    collisionSpark: clashSeries.counts,
  };
}
