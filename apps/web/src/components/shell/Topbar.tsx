import type { PeopleResponse, WarningsResponse, WorkspaceSummary } from "@mesh/server/api";
import { Bell, Check, ChevronDown, Search, UserRound } from "lucide-react";
import { Avatar } from "../bits";
import { Menu } from "../Menu";
import { ago, firstName, initials, minutesSince, plural } from "../../format";
import { ProfileMenuBody, type ProfileInfo } from "./ProfileMenu";

interface Props {
  workspaces: WorkspaceSummary[];
  workspace: string;
  onWorkspace: (w: string) => void;
  warnings: WarningsResponse | undefined;
  people: PeopleResponse | undefined;
  person: string;
  onPerson: (p: string) => void;
  onWarnings: () => void;
  onOpen: (id: string) => void;
  onSearch: () => void;
  profile: ProfileInfo;
  now: number;
}

export function Topbar({ workspaces, workspace, onWorkspace, warnings, people, person, onPerson, onWarnings, onOpen, onSearch, profile, now }: Props) {
  const current = workspaces.find((w) => w.workspace === workspace);
  const list = warnings?.warnings ?? [];
  const fresh = list.filter((w) => minutesSince(w.created_at, now) < 24 * 60).length;
  return (
    <header className="topbar">
      <button type="button" className="search" onClick={onSearch} aria-label="Search">
        <Search size={17} />
        <span>Search for a session, person or module</span>
        <kbd>⌘K</kbd>
      </button>
      <Menu align="left" trigger={(t) => (
        <button type="button" className="select" onClick={t} aria-label="Choose a workspace">
          {current ? <strong>{current.workspace}</strong> : <span>Choose a workspace</span>}
          <ChevronDown size={16} />
        </button>
      )}>
        {(close) => (
          <>
            <div className="menu-head">Workspaces</div>
            {workspaces.length === 0 && <div className="menu-empty">No workspace has shared reports yet</div>}
            {workspaces.map((w) => (
              <button key={w.workspace} type="button" className="menu-item" onClick={() => { onWorkspace(w.workspace); close(); }}>
                <span className="menu-item-text"><strong>{w.workspace}</strong><span>{plural(w.people, "person").replace("persons", "people")} · {plural(w.sessions, "session")}</span></span>
                {w.workspace === workspace && <Check size={16} className="menu-check" />}
              </button>
            ))}
          </>
        )}
      </Menu>
      <div className="topbar-fill" />
      <Menu trigger={(t) => (
        <button type="button" className="icon-btn" onClick={t} aria-label="Warnings">
          <Bell size={20} strokeWidth={1.8} />
          {fresh > 0 && <span className="badge-dot" />}
        </button>
      )} className="menu-wide">
        {(close) => (
          <>
            <div className="menu-head">Latest warnings</div>
            {list.length === 0 && <div className="menu-empty">Nothing yet. Collisions and rediscoveries show up here.</div>}
            <div className="menu-scroll">
              {list.slice(0, 6).map((w) => (
                <button key={w.warning_id} type="button" className="menu-item" onClick={() => { close(); w.reporter.event_id ? onOpen(w.reporter.event_id) : onWarnings(); }}>
                  <span className={`badge badge-${w.kind}`}>{w.kind === "collision" ? "Collision" : "Rediscovery"}</span>
                  <span className="menu-item-text"><strong style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.message}</strong><span>{ago(w.created_at, now)}</span></span>
                </button>
              ))}
            </div>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { close(); onWarnings(); }}><span className="menu-item-text"><strong>See all collisions</strong></span><kbd>G</kbd><kbd>C</kbd></button>
          </>
        )}
      </Menu>
      <span className="hide-sm">
        <Menu trigger={(t) => (
          <button type="button" className="icon-btn" onClick={t} aria-label="People">
            <UserRound size={20} strokeWidth={1.8} />
          </button>
        )}>
          {(close) => (
            <>
              <div className="menu-head">Team</div>
              <button type="button" className="menu-item" onClick={() => { onPerson(""); close(); }}>
                <span className="menu-item-text"><strong>Everyone</strong></span>
                {!person && <Check size={16} className="menu-check" />}
              </button>
              <div className="menu-scroll">
                {(people?.people ?? []).map((p) => (
                  <button key={p.person} type="button" className="menu-item" onClick={() => { onPerson(p.person); close(); }}>
                    <Avatar name={p.person} size={26} />
                    <span className="menu-item-text"><strong>{p.person}{p.status !== "active" ? ` · ${p.status}` : ""}</strong><span>{firstName(p.person)} · {plural(p.sessions, "session")}, {p.open_sessions} open</span></span>
                    {p.person === person && <Check size={16} className="menu-check" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </Menu>
      </span>
      <Menu trigger={(t) => <button type="button" className="me" onClick={t} aria-label={profile.person ? "Account menu" : "PM menu"}>{profile.person ? initials(profile.person) : "PM"}</button>}>
        {(close) => <ProfileMenuBody profile={profile} close={close} />}
      </Menu>
    </header>
  );
}
