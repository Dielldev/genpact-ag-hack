import { Check, ChevronDown, X } from "lucide-react";
import { Menu } from "./Menu";

interface Props {
  label: string;
  value: string;
  options: string[];
  onPick: (v: string) => void;
}

export function FilterChip({ label, value, options, onPick }: Props) {
  return (
    <Menu align="right" trigger={(t) => (
      <button type="button" className={`chip-filter${value ? " chip-filter-on" : ""}`} onClick={t}>
        {label}{value && <>: <strong>{value}</strong></>}
        {value ? <X size={12} onClick={(e) => { e.stopPropagation(); onPick(""); }} /> : <ChevronDown size={12} />}
      </button>
    )}>
      {(close) => (
        <div className="menu-scroll">
          <button type="button" className="menu-item" onClick={() => { onPick(""); close(); }}>Any{!value && <Check size={15} className="menu-check" />}</button>
          {options.map((o) => (
            <button key={o} type="button" className="menu-item" onClick={() => { onPick(o); close(); }}>
              <span className="menu-item-text"><strong style={{ fontWeight: 500 }}>{o}</strong></span>
              {o === value && <Check size={15} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}
