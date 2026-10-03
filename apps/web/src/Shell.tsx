import type { MeResponse } from "@mesh/server/api";
import { useEffect, useState } from "react";
import { MOCK, api } from "./api";
import { PageHead } from "./components/bits";
import { CommandPalette } from "./components/CommandPalette";
import { Drawer } from "./components/Drawer";
import { InstallDialog } from "./components/InstallDialog";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import type { ProfileInfo } from "./components/shell/ProfileMenu";
import { Sidebar } from "./components/shell/Sidebar";
import { Topbar } from "./components/shell/Topbar";
import { Empty } from "./components/bits";
import { useDashboard } from "./dashboard";
import { useHashRoute, useLoad, useNow, useStored } from "./hooks";
import { VIEWS } from "./nav";
import { useShortcuts } from "./shortcuts";
import { Ask } from "./views/Ask";
import { Collisions } from "./views/Collisions";
import { ExitInterview } from "./views/ExitInterview";
import { Feed } from "./views/Feed";
import { Onboarding } from "./views/Onboarding";
import { Inbox } from "lucide-react";

type Dialog = "project" | "install" | null;

interface Props {
  me: MeResponse | null;
  onSignOut: (() => void) | null;
}

export function Shell({ me, onSignOut }: Props) {
  const [route, go] = useHashRoute();
  const [workspace, setWorkspace] = useStored("mesh.workspace", "");
  const [collapsedFlag, setCollapsedFlag] = useStored("mesh.collapsed", "");
  const [eventId, setEventId] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [module, setModule] = useState("");
  const [project, setProject] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const now = useNow(15_000);

  const health = useLoad(() => api.health(), [], 5000);
  const spaces = useLoad(() => api.workspaces(), [], 15_000);
  const data = useDashboard(workspace);
  const online = health.data !== false && !health.error;
  const list = spaces.data?.workspaces ?? [];
  const collapsed = collapsedFlag === "1";
  const view = VIEWS.find((v) => v.id === route) ?? VIEWS[0]!;

  useEffect(() => {
    const first = list[0];
    if (first && !list.some((w) => w.workspace === workspace)) setWorkspace(first.workspace);
  }, [list.map((w) => w.workspace).join(), workspace]);

  useEffect(() => {
    setPerson("");
    setModule("");
    setProject("");
  }, [workspace]);

  useShortcuts([
    { keys: "mod+k", run: () => setPalette(true) },
    { keys: "/", run: () => setPalette(true) },
    { keys: "?", run: () => setHelp(true) },
    { keys: "[", run: () => setCollapsedFlag(collapsed ? "" : "1") },
    ...VIEWS.map((v) => ({ keys: v.keys, run: () => go(v.id) })),
  ]);

  const projects = data.projects.data?.projects ?? [];
  const profile: ProfileInfo = { person: me?.person ?? null, online, demo: MOCK, onHelp: () => setHelp(true), onInstall: () => setDialog("install"), onSignOut };
  const openEvent = setEventId;
  const created = (p: { title: string }) => {
    data.projects.reload();
    setProject(p.title);
    go("feed");
  };
  const askMesh = (q: string) => {
    setSeed(q);
    go("ask");
  };

  return (
    <div className={`shell${collapsed ? " shell-collapsed" : ""}`}>
      <Sidebar
        view={view.id}
        go={go}
        collapsed={collapsed}
        toggle={() => setCollapsedFlag(collapsed ? "" : "1")}
        modules={data.modules.data?.modules ?? []}
        activeModule={module}
        onModule={(m) => { setModule(m); go("feed"); }}
        projects={projects}
        activeProject={project}
        onProject={(t) => { setProject(t); go("feed"); }}
        onNewProject={() => workspace && setDialog("project")}
        onMore={() => setPalette(true)}
        profile={profile}
      />
      <div className="main">
        <Topbar
          workspaces={list}
          workspace={workspace}
          onWorkspace={setWorkspace}
          warnings={data.warnings.data}
          people={data.people.data}
          person={person}
          onPerson={(p) => { setPerson(p); go("feed"); }}
          onWarnings={() => go("collisions")}
          onOpen={openEvent}
          onSearch={() => setPalette(true)}
          profile={profile}
          now={now}
        />
        <main className={`page${view.id === "ask" ? " page-flush" : ""}`}>
          {!online && !MOCK && <div className="offline">The Mesh server is unreachable. Showing the last data we had; retrying every few seconds.</div>}
          {view.id !== "feed" && view.id !== "ask" && <PageHead title={view.label} subtitle={view.subtitle} />}
          {!workspace ? (
            <Empty icon={Inbox} title={spaces.loading ? "Loading workspaces…" : "No workspace has shared reports yet"}>
              Install the hook with <code>mesh init</code> and finish one agent response.
            </Empty>
          ) : (
            <>
              {view.id === "feed" && <Feed workspace={workspace} data={data} person={person} module={module} project={project} onPerson={setPerson} onModule={setModule} onProject={setProject} onOpen={openEvent} />}
              {view.id === "collisions" && <Collisions data={data} onOpen={openEvent} />}
              {view.id === "ask" && <Ask workspace={workspace} onOpen={openEvent} seed={seed} onSeed={() => setSeed(null)} />}
              {view.id === "exit" && <ExitInterview workspace={workspace} />}
              {view.id === "onboarding" && <Onboarding workspace={workspace} onOpen={openEvent} />}
            </>
          )}
        </main>
      </div>
      {eventId && workspace && <Drawer workspace={workspace} eventId={eventId} onClose={() => setEventId(null)} onOpen={openEvent} />}
      {palette && (
        <CommandPalette
          onClose={() => setPalette(false)}
          go={go}
          people={(data.people.data?.people ?? []).map((p) => p.person)}
          modules={data.modules.data?.modules ?? []}
          projects={projects.map((p) => p.title)}
          sessions={data.feed.data?.items ?? []}
          workspaces={list.map((w) => w.workspace)}
          onPerson={setPerson}
          onModule={setModule}
          onProject={setProject}
          onOpen={openEvent}
          onWorkspace={setWorkspace}
          onAsk={askMesh}
          onHelp={() => setHelp(true)}
          onInstall={() => setDialog("install")}
        />
      )}
      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}
      {dialog === "project" && workspace && <NewProjectDialog workspace={workspace} onClose={() => setDialog(null)} onCreated={created} />}
      {dialog === "install" && <InstallDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
