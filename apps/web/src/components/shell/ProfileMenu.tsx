import { Keyboard, Lock, LogOut, Terminal, Wifi, WifiOff } from "lucide-react";

export interface ProfileInfo {
  person: string | null;
  online: boolean;
  demo: boolean;
  onHelp: () => void;
  onInstall: () => void;
  onSignOut: (() => void) | null;
}

export function ProfileMenuBody({ profile, close }: { profile: ProfileInfo; close: () => void }) {
  const { person, online, demo, onHelp, onInstall, onSignOut } = profile;
  return (
    <>
      <div className="menu-head">{person ?? "PM seat"}</div>
      <div className="menu-item" role="presentation">
        {online || demo ? <Wifi size={16} color="#21708a" /> : <WifiOff size={16} color="#e5484d" />}
        <span className="menu-item-text">
          <strong>{demo ? "Demo data" : online ? "Connected" : "Offline"}</strong>
          <span>{demo ? "Offline sample data, no live server" : online ? "Live from the Mesh server" : "Retrying every few seconds"}</span>
        </span>
      </div>
      <div className="menu-item" role="presentation">
        <Lock size={16} />
        <span className="menu-item-text">
          <strong>Shared reports only</strong>
          <span>Private sessions are never shown</span>
        </span>
      </div>
      <div className="menu-sep" />
      <button type="button" className="menu-item" onClick={() => { close(); onInstall(); }}>
        <Terminal size={16} />
        <span className="menu-item-text"><strong>Install the hook</strong></span>
      </button>
      <button type="button" className="menu-item" onClick={() => { close(); onHelp(); }}>
        <Keyboard size={16} />
        <span className="menu-item-text"><strong>Keyboard shortcuts</strong></span>
        <kbd>?</kbd>
      </button>
      {onSignOut && (
        <>
          <div className="menu-sep" />
          <button type="button" className="menu-item" onClick={() => { close(); onSignOut(); }}>
            <LogOut size={16} />
            <span className="menu-item-text"><strong>Sign out</strong></span>
          </button>
        </>
      )}
    </>
  );
}
