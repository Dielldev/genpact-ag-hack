import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useLoad, useStored } from "../hooks";
import { Composer } from "./ask/Composer";
import { dynamicCommands, STATIC_COMMANDS, type Command } from "./ask/commands";
import { EmptyState } from "./ask/EmptyState";
import { PERIODS, PeriodId } from "./ask/intent";
import { TurnView } from "./ask/TurnView";
import { useThread } from "./ask/useThread";

interface Props {
  workspace: string;
  onOpen: (id: string) => void;
  seed: string | null;
  onSeed: () => void;
}

const isPeriod = (v: string): v is PeriodId => PERIODS.some((p) => p.id === v);

export function Ask({ workspace, onOpen, seed, onSeed }: Props) {
  const [stored, setStored] = useStored("mesh.ask.period", "");
  const chosen = isPeriod(stored);
  const period = isPeriod(stored) ? stored : PeriodId.week;
  const [draft, setDraft] = useState("");
  const vocab = useLoad(() => Promise.all([api.modules(workspace), api.people(workspace)]), [workspace]);
  const [mods, team] = vocab.data ?? [undefined, undefined];
  const { turns, busy, submit } = useThread(workspace, period, chosen, team?.people.map((p) => p.person) ?? []);
  const scroller = useRef<HTMLDivElement>(null);
  const commands = [...STATIC_COMMANDS, ...dynamicCommands(team?.people, mods?.modules)];

  const send = (text: string) => {
    setDraft("");
    void submit(text);
  };
  const run = (c: Command) => send(c.question);

  const submitRef = useRef(send);
  submitRef.current = send;
  useEffect(() => {
    if (!seed) return;
    onSeed();
    submitRef.current(seed);
  }, [seed]);

  const last = turns[turns.length - 1];
  const settled = Boolean(last?.error || last?.answer);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(".ask-turn:last-child");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [turns.length, settled]);

  return (
    <div className="ask-page">
      <div className="ask-thread" ref={scroller}>
        {turns.length === 0 ? (
          <EmptyState commands={commands} onRun={run} />
        ) : (
          <div className="ask-turns">
            {turns.map((t) => <TurnView key={t.id} turn={t} workspace={workspace} onOpen={onOpen} />)}
          </div>
        )}
      </div>
      <div className="ask-dock">
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => send(draft)}
          busy={busy}
          period={period}
          onPeriod={setStored}
          chips={STATIC_COMMANDS.slice(0, 4)}
          onChip={run}
        />
        <p className="ask-foot">Reports are computed from shared sessions. Questions are answered from shared reports only.</p>
      </div>
    </div>
  );
}
