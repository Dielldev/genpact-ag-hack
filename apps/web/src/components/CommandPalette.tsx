import type { FeedItem } from "@mesh/server/api";
import { Boxes, CornerDownLeft, Keyboard, LayoutGrid, MessageSquareText, Search, Sparkles, UserRound, Workflow, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VIEWS } from "../nav";

interface Props {
  onClose: () => void;
  go: (id: string) => void;
  people: string[];
  modules: string[];
  sessions: FeedItem[];
  workspaces: string[];
  onPerson: (p: string) => void;
  onModule: (m: string) => void;
  onOpen: (id: string) => void;
  onWorkspace: (w: string) => void;
  onAsk: (q: string) => void;
  onHelp: () => void;
}

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const matches = (text: string, q: string) => q.split(/\s+/).every((w) => text.toLowerCase().includes(w));

export function CommandPalette(p: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const done = (fn: () => void) => () => {
      p.onClose();
      fn();
    };
    const all: Item[] = [
      ...VIEWS.map((v) => ({ id: `v-${v.id}`, group: "Navigate", label: v.label, hint: v.keys.toUpperCase(), icon: v.icon, run: done(() => p.go(v.id)) })),
      { id: "help", group: "Navigate", label: "Keyboard shortcuts", hint: "?", icon: Keyboard, run: done(p.onHelp) },
      ...p.workspaces.map((w) => ({ id: `w-${w}`, group: "Workspaces", label: `Switch to ${w}`, icon: LayoutGrid, run: done(() => p.onWorkspace(w)) })),
      ...p.people.map((n) => ({ id: `p-${n}`, group: "People", label: n, hint: "Focus on the feed", icon: UserRound, run: done(() => { p.onPerson(n); p.go("feed"); }) })),
      ...p.modules.map((m) => ({ id: `m-${m}`, group: "Modules", label: m, hint: "Filter the feed", icon: Boxes, run: done(() => { p.onModule(m); p.go("feed"); }) })),
      ...p.sessions.map((s) => ({ id: `s-${s.key}`, group: "Sessions", label: s.task ?? "Active session", hint: s.person, icon: Workflow, run: done(() => p.onOpen(s.event_id ?? String(s.session_pk))) })),
    ];
    const text = (i: Item) => `${i.label} ${i.hint ?? ""} ${i.group}`;
    const hits = q ? all.filter((i) => matches(text(i), q)) : all.filter((i) => ["Navigate", "People"].includes(i.group));
    const counts = new Map<string, number>();
    const capped = hits.filter((i) => {
      const n = (counts.get(i.group) ?? 0) + 1;
      counts.set(i.group, n);
      return n <= (q ? 5 : 6);
    });
    const ask: Item[] = q ? [{ id: "ask", group: "Ask", label: `Ask Mesh: “${query.trim()}”`, hint: "Search the shared record", icon: Sparkles, run: done(() => p.onAsk(query.trim())) }] : [];
    return [...ask, ...capped];
  }, [q, p.people, p.modules, p.sessions, p.workspaces]);

  useEffect(() => {
    setIndex(0);
  }, [q]);
  useEffect(() => {
    document.getElementById(`pal-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[index]?.run(); }
    else if (e.key === "Escape") p.onClose();
  };

  let lastGroup = "";
  return (
    <div className="backdrop palette-wrap" data-modal onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="palette-input">
          <Search size={18} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search sessions, people and modules, or ask a question…" />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} role="listbox">
          {items.length === 0 && <div className="menu-empty">Nothing matches “{query}”.</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <div className="palette-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {head}
                <button id={`pal-${i}`} type="button" role="option" aria-selected={i === index} className="palette-item" onMouseMove={() => setIndex(i)} onClick={it.run}>
                  <span className="ico"><it.icon size={17} /></span>
                  <span className="txt">{it.label}</span>
                  {it.hint && <span className="hint">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
          <span><CornerDownLeft size={11} style={{ verticalAlign: -1 }} /> select</span>
          <span><MessageSquareText size={11} style={{ verticalAlign: -1 }} /> type a question to ask</span>
        </div>
      </div>
    </div>
  );
}
