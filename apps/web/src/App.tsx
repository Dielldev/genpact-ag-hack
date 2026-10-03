import { useEffect, useState } from "react";
import { api, MOCK } from "./api";
import { Drawer } from "./components/Drawer";
import { useHashRoute, useLoad, useStored } from "./hooks";
import { Ask } from "./views/Ask";
import { Collisions } from "./views/Collisions";
import { ExitInterview } from "./views/ExitInterview";
import { Feed } from "./views/Feed";
import { Onboarding } from "./views/Onboarding";

const VIEWS = [
  { id: "feed", label: "Live feed", icon: "◉" },
  { id: "collisions", label: "Collisions", icon: "⇄" },
  { id: "ask", label: "Ask", icon: "?" },
  { id: "exit", label: "Exit interview", icon: "↗" },
  { id: "onboarding", label: "Onboarding", icon: "◎" },
] as const;

export function App() {
  const [route, go] = useHashRoute();
  const [workspace, setWorkspace] = useStored("mesh.workspace", "");
  const [eventId, setEventId] = useState<string | null>(null);
  const health = useLoad(() => api.health(), [], 5000);
  const spaces = useLoad(() => api.workspaces(), [], 15_000);
  const online = health.data !== false && !health.error;
  const list = spaces.data?.workspaces ?? [];

  useEffect(() => {
    const first = list[0];
    if (first && !list.some((w) => w.workspace === workspace)) setWorkspace(first.workspace);
  }, [list.map((w) => w.workspace).join(), workspace]);

  const view = VIEWS.find((v) => v.id === route) ?? VIEWS[0];
  const props = { workspace, onOpen: setEventId };

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand"><span className="brand-mark">◆</span> Mesh</div>
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={`nav-item${v.id === view.id ? " nav-active" : ""}`} onClick={() => go(v.id)}>
            <span className="nav-icon">{v.icon}</span>{v.label}
          </button>
        ))}
        <div className="nav-foot">PM seat · no repo needed</div>
      </nav>
      <div className="main">
        <header className="topbar">
          <h1>{view.label}</h1>
          <div className="topbar-right">
            <label className="workspace">
              <span>Workspace</span>
              <select value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
                {list.length === 0 && <option value="">none yet</option>}
                {list.map((w) => <option key={w.workspace} value={w.workspace}>{w.workspace} · {w.people} people</option>)}
              </select>
            </label>
            <span className={`conn ${online ? "conn-on" : "conn-off"}`}>{MOCK ? "Demo data" : online ? "Connected" : "Offline"}</span>
          </div>
        </header>
        <div className="privacy">Shared reports only. Private sessions are never shown.</div>
        {!online && !MOCK && <div className="offline">The Mesh server is unreachable. Showing the last data we had; retrying every few seconds.</div>}
        {workspace ? (
          <main className="content">
            {view.id === "feed" && <Feed {...props} />}
            {view.id === "collisions" && <Collisions {...props} />}
            {view.id === "ask" && <Ask {...props} />}
            {view.id === "exit" && <ExitInterview workspace={workspace} />}
            {view.id === "onboarding" && <Onboarding {...props} />}
          </main>
        ) : (
          <main className="content"><div className="state state-empty"><strong>{spaces.loading ? "Loading workspaces…" : "No workspace has shared reports yet"}</strong><p>Install the hook with <code>mesh init</code> and finish one agent response.</p></div></main>
        )}
      </div>
      {eventId && workspace && <Drawer workspace={workspace} eventId={eventId} onClose={() => setEventId(null)} onOpen={setEventId} />}
    </div>
  );
}
