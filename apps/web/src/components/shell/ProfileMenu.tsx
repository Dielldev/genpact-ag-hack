import { Keyboard, Lock, Wifi, WifiOff } from "lucide-react";

export function ProfileMenuBody({ online, demo, onHelp, close }: { online: boolean; demo: boolean; onHelp: () => void; close: () => void }) {
  return (
    <>
      <div className="menu-head">PM seat</div>
      <div className="menu-item" role="presentation">
        {online || demo ? <Wifi size={16} color="#1fa97a" /> : <WifiOff size={16} color="#e5484d" />}
        <span className="menu-item-text">
          <strong>{demo ? "Demo data" : online ? "Connected" : "Offline"}</strong>
          <span>{demo ? "Offline sample data, no live server" : online ? "Live from the Mesh server" : "Retrying every few seconds"}</span>
        </span>
      </div>
      <div className="menu-item" role="presentation">
        <Lock size={16} color="#6c3ff0" />
        <span className="menu-item-text">
          <strong>Shared reports only</strong>
          <span>Private sessions are never shown</span>
        </span>
      </div>
      <div className="menu-sep" />
      <button type="button" className="menu-item" onClick={() => { close(); onHelp(); }}>
        <Keyboard size={16} />
        <span className="menu-item-text"><strong>Keyboard shortcuts</strong></span>
        <kbd>?</kbd>
      </button>
    </>
  );
}
