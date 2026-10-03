import type { Project } from "@mesh/server/api";
import { ChevronDown, ChevronLeft, Lock, Plus } from "lucide-react";
import { Avatar } from "../bits";
import { Menu } from "../Menu";
import { VIEWS } from "../../nav";
import { ProfileMenuBody, type ProfileInfo } from "./ProfileMenu";

interface Props {
  view: string;
  go: (id: string) => void;
  collapsed: boolean;
  toggle: () => void;
  modules: string[];
  activeModule: string;
  onModule: (m: string) => void;
  projects: Project[];
  activeProject: string;
  onProject: (title: string) => void;
  onNewProject: () => void;
  onMore: () => void;
  profile: ProfileInfo;
}

const SHOWN = 5;

export function Sidebar({ view, go, collapsed, toggle, modules, activeModule, onModule, projects, activeProject, onProject, onNewProject, onMore, profile }: Props) {
  const name = profile.person ?? "PM seat";
  return (
    <aside className="side" aria-label="Main navigation">
      <button type="button" className="edge-toggle" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title="Toggle sidebar  [">
        <ChevronLeft size={15} />
      </button>
      <div className="brand">
        <span className="brand-text">Mesh</span>
      </div>
      <div className="side-label">Menu</div>
      {VIEWS.map((v) => (
        <button key={v.id} type="button" className={`nav-item${v.id === view ? " nav-active" : ""}`} onClick={() => go(v.id)} title={v.label}>
          <v.icon size={18} strokeWidth={1.8} />
          <span className="nav-text">{v.label}</span>
          <span className="nav-keys">{v.keys.split(" ").map((k) => <kbd key={k}>{k.toUpperCase()}</kbd>)}</span>
        </button>
      ))}
      <div className="side-projects">
        <div className="side-label side-label-gap side-label-row">
          <span>Projects</span>
          <button type="button" className="side-add" onClick={onNewProject} aria-label="New project" title="New project">
            <Plus size={14} strokeWidth={2.2} />
          </button>
        </div>
        {projects.length === 0 && <p className="side-hint">No projects yet</p>}
        {projects.slice(0, SHOWN).map((p) => (
          <button key={p.project_id} type="button" className={`nav-item${p.title === activeProject ? " nav-active" : ""}`} onClick={() => onProject(p.title === activeProject ? "" : p.title)} title={p.title}>
            <span className="ring" />
            <span className="nav-text">{p.title}</span>
          </button>
        ))}
        {projects.length > SHOWN && (
          <button type="button" className="nav-item nav-more" onClick={onMore}>
            <span className="nav-text">{projects.length - SHOWN} more…</span>
          </button>
        )}
      </div>
      {modules.length > 0 && (
        <div className="side-modules">
          <div className="side-label side-label-gap">Modules</div>
          {modules.slice(0, SHOWN).map((m) => (
            <button key={m} type="button" className={`nav-item${m === activeModule ? " nav-active" : ""}`} onClick={() => onModule(m === activeModule ? "" : m)} title={m}>
              <span className="ring" />
              <span className="nav-text">{m}</span>
            </button>
          ))}
          {modules.length > SHOWN && (
            <button type="button" className="nav-item nav-more" onClick={onMore}>
              <span className="nav-text">{modules.length - SHOWN} more…</span>
            </button>
          )}
        </div>
      )}
      <div className="side-fill" />
      <p className="privacy"><Lock size={13} />Shared reports only. Private sessions are never shown.</p>
      <Menu placement="up" align="left" trigger={(t) => (
        <button type="button" className="profile" onClick={t} aria-label={profile.person ? "Account menu" : "PM menu"}>
          <Avatar name={name} size={32} />
          <span className="profile-text"><strong>{name}</strong><span className="sub">{profile.person ? "Signed in" : "No repo needed"}</span></span>
          <ChevronDown size={16} className="profile-chev" />
        </button>
      )}>
        {(close) => <ProfileMenuBody profile={profile} close={close} />}
      </Menu>
    </aside>
  );
}
