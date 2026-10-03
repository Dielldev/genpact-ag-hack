import type { FeedItem } from "@mesh/server/api";
import { Boxes, Folder, Radio, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Empty, ErrorState, Loading } from "../components/bits";
import { FilterChip } from "../components/FilterChip";
import { useNow } from "../hooks";
import { matchProject } from "../projects";
import { useShortcuts } from "../shortcuts";
import { BarChart } from "./feed/BarChart";
import { Board } from "./feed/Board";
import { buildBoard, type ColumnId } from "./feed/boardModel";
import { ChartCard } from "./feed/ChartCard";
import { clashPairs, overview, personSignals } from "./feed/feedStats";
import { passes, type TabId } from "./feed/filters";
import { LineChart } from "./feed/LineChart";
import { PERIODS, series, trend } from "./feed/series";
import { Stats } from "./feed/Stats";
import { Tabs } from "./feed/Tabs";
import { TeamPanel } from "./feed/TeamPanel";
import { useChanged } from "./feed/useChanged";
import type { Dashboard } from "../dashboard";

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

const TAB_IDS: TabId[] = ["all", "progress", "blocked", "stuck", "done", "collisions"];
const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0);

export function Feed({ workspace, data, person, module, project, onPerson, onModule, onProject, onOpen }: Props) {
  const now = useNow(5000);
  const [tab, setTab] = useState<TabId>("all");
  const [period, setPeriod] = useState(PERIODS[1]!);
  const [closed, setClosed] = useState<Set<ColumnId>>(new Set(["done"]));
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
  const counts = Object.fromEntries(TAB_IDS.map((t) => [t, scoped.filter((i) => passes(t, i, now, warnings)).length])) as Record<TabId, number>;
  const visible = scoped.filter((i) => passes(tab, i, now, warnings));
  const columns = buildBoard(visible, now);
  const shown = columns.filter((c) => !closed.has(c.id)).flatMap((c) => c.cards);

  const scopedWarnings = warnings.filter((w) => !person || w.people.includes(person));
  const values = overview(scoped, scopedWarnings, people.find((p) => p.person === person), now, period);
  const raised = series(scopedWarnings.map((w) => w.created_at), now, period);
  const started = series(scoped.map((i) => i.first_seen_at), now, period);
  const collisionsInPeriod = values.collisionsInPeriod;
  const raisedTrend = collisionsInPeriod > 0 ? { text: `${collisionsInPeriod} collision${collisionsInPeriod === 1 ? "" : "s"}`, dir: "down" as const } : { text: "All clear", dir: "up" as const };

  const toggle = (id: ColumnId) => setClosed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openItem = (it: FeedItem) => onOpen(it.event_id ?? String(it.session_pk));
  const openAt = (i: number) => { const card = shown[i]; if (card) openItem(card.lead); };
  const pickTab = (t: TabId) => { setTab(t); setCursor(0); if (t === "done") setClosed((c) => { const n = new Set(c); n.delete("done"); return n; }); };

  useShortcuts([
    { keys: "j", run: () => { setCursor((c) => Math.min(shown.length - 1, c + 1)); setScrollKey((k) => k + 1); } },
    { keys: "k", run: () => { setCursor((c) => Math.max(0, c - 1)); setScrollKey((k) => k + 1); } },
    { keys: "enter", run: () => openAt(cursor) },
  ]);

  if (data.feed.loading && !all) return <Loading label="Loading the live feed" />;
  if (data.feed.error && !all) return <ErrorState message={data.feed.error} onRetry={data.feed.reload} />;

  return (
    <div className="feed">
      <div className="feed-head">
        <Tabs active={tab} counts={counts} onPick={pickTab} />
        <div className="feed-filters">
          <FilterChip icon={User} label="Person" value={person} options={people.map((p) => p.person)} onPick={onPerson} />
          <FilterChip icon={Folder} label="Project" value={project} options={(projects ?? []).map((p) => p.title)} onPick={onProject} />
          <FilterChip icon={Boxes} label="Module" value={module} options={data.modules.data?.modules ?? []} onPick={onModule} />
        </div>
      </div>
      <Stats workspace={workspace} people={people} person={person} onPerson={onPerson} values={values} period={period} now={now} />
      <div className="charts">
        <ChartCard title="Sessions" period={period} onPeriod={setPeriod} big={String(sum(started.counts))} trend={trend(started.counts)}>
          <BarChart data={started} unit="session" />
        </ChartCard>
        <ChartCard title="Warnings" period={period} onPeriod={setPeriod} big={String(sum(raised.counts))} trend={raisedTrend}>
          <LineChart data={raised} unit="warning" />
        </ChartCard>
      </div>
      <TeamPanel people={people} selected={person} signals={personSignals(all ?? [], now)} clashes={clashPairs(warnings)} onSelect={onPerson} />
      <section className="board-section" aria-label="Team board">
        {all && visible.length === 0 ? (
          <Empty icon={Radio} title={all.length === 0 ? "No shared sessions yet" : "No sessions match these filters"}>
            {all.length === 0 ? "Sessions appear here as soon as an agent finishes a response with the hook installed." : "Clear a filter or pick another tab to see more."}
          </Empty>
        ) : (
          <Board columns={columns} closed={closed} onToggle={toggle} cursor={cursor} warnings={warnings} people={people} focused={person} changed={changed} now={now} onOpen={openItem} onPerson={(p) => onPerson(p === person ? "" : p)} onModule={onModule} onCursor={setCursor} scrollKey={scrollKey} />
        )}
      </section>
    </div>
  );
}
