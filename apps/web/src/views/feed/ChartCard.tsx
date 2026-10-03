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
        <Menu trigger={(t) => <button type="button" className="period" onClick={t}>{period.label}<ChevronDown size={13} /></button>}>
          {(close) => PERIODS.map((p) => (
            <button key={p.id} type="button" className="menu-item" onClick={() => { onPeriod(p); close(); }}>{p.label}</button>
          ))}
        </Menu>
      </div>
      <div className="chart-body">
        <div className="chart-big">
          <strong>{big}</strong>
          <span className={`pill pill-${trend.dir}`}><i>{ARROW[trend.dir]}</i>{trend.text}</span>
        </div>
        <div className="chart">{children}</div>
      </div>
    </section>
  );
}
