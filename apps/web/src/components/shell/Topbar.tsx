import type { PeopleResponse, WarningsResponse } from "@mesh/server/api";
import { Bell, Check, Search, UserRound, type LucideIcon } from "lucide-react";
import { Avatar } from "../bits";
import { Menu } from "../Menu";
import { ago, firstName, initials, minutesSince, plural } from "../../format";
import { ProfileMenuBody, type ProfileInfo } from "./ProfileMenu";

interface Props {
  workspace: string;
  title: string;
  icon: LucideIcon;
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

export function Topbar({ workspace, title, icon: Icon, warnings, people, person, onPerson, onWarnings, onOpen, onSearch, profile, now }: Props) {
  const list = warnings?.warnings ?? [];
  const fresh = list.filter((w) => minutesSince(w.created_at, now) < 24 * 60).length;
  return (
    <header className="topbar">
      <div className="crumbs">
        {workspace && <><span>{workspace}</span><span>/</span></>}
        <strong><Icon size={14} />{title}</strong>
      </div>
      <div className="topbar-fill" />
      <button type="button" className="search" onClick={onSearch} aria-label="Search">
        <Search size={14} />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
      <Menu trigger={(t) => (
        <button type="button" className="icon-btn" onClick={t} aria-label="Warnings">
          <Bell size={16} strokeWidth={1.8} />
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
            <UserRound size={16} strokeWidth={1.8} />
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
                    <Avatar name={p.person} size={22} />
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
