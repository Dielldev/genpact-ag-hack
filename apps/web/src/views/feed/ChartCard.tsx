import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Menu } from "../../components/Menu";
import { PERIODS, type Period, type Trend } from "./series";

interface Props {
  title: string;
  period: Period;
  onPeriod: (p: Period) => void;
  big: string;
  trend: { text: string; dir: Trend["dir"] };
  children: ReactNode;
}

const ARROW = { up: "↑", down: "↓", flat: "–" };

export function ChartCard({ title, period, onPeriod, big, trend, children }: Props) {
  return (
    <section className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <strong className="chart-total">{big}</strong>
        <span className={`pill pill-${trend.dir}`}>{ARROW[trend.dir]} {trend.text}</span>
        <Menu trigger={(t) => <button type="button" className="period" onClick={t}>{period.label}<ChevronDown size={12} /></button>}>
          {(close) => PERIODS.map((p) => (
            <button key={p.id} type="button" className="menu-item" onClick={() => { onPeriod(p); close(); }}>{p.label}</button>
          ))}
        </Menu>
      </div>
      <div className="chart">{children}</div>
    </section>
  );
}
