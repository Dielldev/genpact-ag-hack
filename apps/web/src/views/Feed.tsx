import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import type { Dashboard } from "../dashboard";
import { Empty, ErrorState, Loading } from "../components/bits";
import { FilterChip } from "../components/FilterChip";
import { minutesSince } from "../format";
import { useNow } from "../hooks";
import { matchProject } from "../projects";
import { useShortcuts } from "../shortcuts";
import { BarChart } from "./feed/BarChart";
import { ChartCard } from "./feed/ChartCard";
import { groupItems, passes, toneFor, type TileId } from "./feed/filters";
import { Hero } from "./feed/Hero";
import { LineChart } from "./feed/LineChart";
import { pairKey, type Signal } from "./feed/MeshGraph";
import { PERIODS, series, trend } from "./feed/series";
import { SessionList } from "./feed/SessionList";
import { Tiles } from "./feed/Tiles";
import { useChanged } from "./feed/useChanged";
import type { Tone } from "../format";

interface Props {
  workspace: string;
  data: Dashboard;
  person: string;
  module: string;
  project: string;
  onPerson: (p: string) => void;
  onModule: (m: string) => void;
  onProject: (t: string) => void;
  onOpen: (id: string) => void;
}

const TILE_IDS: TileId[] = ["all", "progress", "blocked", "stuck", "done", "collisions"];

export function Feed({ workspace, data, person, module, project, onPerson, onModule, onProject, onOpen }: Props) {
  const now = useNow(5000);
  const [tile, setTile] = useState<TileId>("all");
  const [period, setPeriod] = useState(PERIODS[1]!);
  const [closed, setClosed] = useState<Set<Tone>>(new Set(["done"]));
  const [cursor, setCursor] = useState(0);
  const [scrollKey, setScrollKey] = useState(0);
  const all = data.feed.data?.items;
  const warnings = data.warnings.data?.warnings ?? [];
  const people = data.people.data?.people ?? [];
  const changed = useChanged(all);

  const projects = data.projects.data?.projects;
  const scoped = useMemo(() => {
    const inProject = matchProject(projects ?? [], project);
    return (all ?? []).filter((i) => (!person || i.person === person) && (!module || i.modules.includes(module)) && inProject(i));
  }, [all, person, module, project, projects]);
  const counts = Object.fromEntries(TILE_IDS.map((t) => [t, scoped.filter((i) => passes(t, i, now, warnings)).length])) as Record<TileId, number>;
  const visible = scoped.filter((i) => passes(tile, i, now, warnings));
  const groups = groupItems(visible, now);
  const shown = groups.filter((g) => !closed.has(g.tone)).flatMap((g) => g.items);

  const signals: Record<string, Signal> = {};
  for (const i of all ?? []) {
    const tone = toneFor(i, now);
    const next: Signal | undefined = tone === "stuck" ? "stuck" : tone === "blocked" ? "blocked" : tone === "done" ? undefined : "open";
    const have = signals[i.person];
    if (next && (!have || (have === "open" && next !== "open") || (have === "blocked" && next === "stuck"))) signals[i.person] = next;
  }
  const clashes = new Set<string>();
  for (const w of warnings) if (w.kind === "collision") for (const s of w.sources) clashes.add(pairKey(w.reporter.person, s.person));

  const started = series(scoped.map((i) => i.first_seen_at), now, period);
  const scopedWarnings = warnings.filter((w) => !person || w.people.includes(person));
  const raised = series(scopedWarnings.map((w) => w.created_at), now, period);
  const collisionsInPeriod = scopedWarnings.filter((w) => w.kind === "collision" && minutesSince(w.created_at, now) * 60_000 <= period.ms).length;
  const inPeriod = raised.counts.reduce((a, b) => a + b, 0);
  const raisedTrend = collisionsInPeriod > 0 ? { text: `${collisionsInPeriod} collision${collisionsInPeriod === 1 ? "" : "s"}`, dir: "down" as const } : { text: "All clear", dir: "up" as const };

  const toggle = (tone: Tone) => setClosed((c) => { const n = new Set(c); n.has(tone) ? n.delete(tone) : n.add(tone); return n; });
  const openAt = (i: number) => { const it = shown[i]; if (it) onOpen(it.event_id ?? String(it.session_pk)); };
  const pickTile = (t: TileId) => { setTile(t); setCursor(0); if (t === "done") setClosed((c) => { const n = new Set(c); n.delete("done"); return n; }); };

  useShortcuts([
    { keys: "j", run: () => { setCursor((c) => Math.min(shown.length - 1, c + 1)); setScrollKey((k) => k + 1); } },
    { keys: "k", run: () => { setCursor((c) => Math.max(0, c - 1)); setScrollKey((k) => k + 1); } },
    { keys: "enter", run: () => openAt(cursor) },
  ]);

  if (data.feed.loading && !all) return <Loading label="Loading the live feed" />;
  if (data.feed.error && !all) return <ErrorState message={data.feed.error} onRetry={data.feed.reload} />;

  return (
    <div>
      <Tiles active={tile} counts={counts} onPick={pickTile} />
      <Hero
        workspace={workspace}
        people={people}
        person={person}
        onPerson={onPerson}
        totals={{ sessions: scoped.length, open: scoped.filter((i) => toneFor(i, now) !== "done").length, modules: new Set(scoped.flatMap((i) => i.modules)).size }}
        signals={signals}
        clashes={clashes}
        now={now}
      />
      <div className="cards2">
        <ChartCard title="Sessions" period={period} onPeriod={setPeriod} big={String(started.counts.reduce((a, b) => a + b, 0))} trend={trend(started.counts)}>
          <BarChart data={started} unit="session" />
        </ChartCard>
        <ChartCard title="Warnings" period={period} onPeriod={setPeriod} big={String(inPeriod)} trend={raisedTrend}>
          <LineChart data={raised} unit="warning" />
        </ChartCard>
      </div>
      <section className="list-card" aria-label="Sessions">
        <div className="toolbar">
          <h3>Sessions <span className="count">{visible.length}</span></h3>
          <FilterChip label="Person" value={person} options={people.map((p) => p.person)} onPick={onPerson} />
          <FilterChip label="Project" value={project} options={(projects ?? []).map((p) => p.title)} onPick={onProject} />
          <FilterChip label="Module" value={module} options={data.modules.data?.modules ?? []} onPick={onModule} />
        </div>
        {all && visible.length === 0 ? (
          <div style={{ padding: 20 }}>
            <Empty icon={Radio} title={all.length === 0 ? "No shared sessions yet" : "No sessions match these filters"}>
              {all.length === 0 ? "Sessions appear here as soon as an agent finishes a response with the hook installed." : "Clear a filter or pick another tile to see more."}
            </Empty>
          </div>
        ) : (
          <SessionList groups={groups} closed={closed} onToggle={toggle} cursor={cursor} warnings={warnings} changed={changed} now={now} onOpen={onOpen} onModule={onModule} onCursor={setCursor} scrollKey={scrollKey} />
        )}
      </section>
    </div>
  );
}
