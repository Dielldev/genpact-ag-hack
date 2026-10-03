import { ArrowUp, CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Command } from "./commands";
import { PERIODS, PeriodId } from "./intent";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  period: PeriodId;
  onPeriod: (p: PeriodId) => void;
  chips: Command[];
  onChip: (c: Command) => void;
}

const MAX_HEIGHT = 168;

export function Composer({ value, onChange, onSend, busy, period, onPeriod, chips, onChip }: Props) {
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => box.current?.focus(), []);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onSend();
  };

  const ready = value.trim().length > 0 && !busy;

  return (
    <div className="ask-composer">
      <textarea
        ref={box}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder="Ask for a sprint report, today's standup, or what anyone is working on…"
        aria-label="Ask Mesh"
      />
      <div className="ask-composer-foot">
        <label className="ask-period" title="Period used for reports">
          <CalendarDays size={13} />
          <select value={period} onChange={(e) => onPeriod(e.target.value as PeriodId)} aria-label="Report period">
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <div className="ask-chips">
          {chips.map((c) => (
            <button key={c.id} type="button" className="ask-chip" onClick={() => onChip(c)} disabled={busy}>
              <c.icon size={12} />
              {c.chip ?? c.label}
            </button>
          ))}
        </div>
        <kbd className="ask-send-kbd">↵</kbd>
        <button type="button" className="btn btn-primary ask-send" onClick={onSend} disabled={!ready} aria-label="Send">
          <ArrowUp size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
