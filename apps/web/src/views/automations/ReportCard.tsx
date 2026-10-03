import { ChevronRight } from "lucide-react";
import { rangeLabel } from "../../automations/schedule";
import { RunTrigger, type AutoReport } from "../../automations/store";
import { dateTime } from "../../format";
import { AnswerView } from "../ask/answer/AnswerView";

interface Props {
  report: AutoReport;
  workspace: string;
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}

export function ReportCard({ report, workspace, open, onToggle, onOpen }: Props) {
  const title = `Weekly sprint report · ${rangeLabel(report.generatedAt)}`;
  const scheduled = report.trigger === RunTrigger.scheduled;
  return (
    <article className="auto-report">
      <button type="button" className="auto-report-head" aria-expanded={open} onClick={onToggle}>
        <ChevronRight size={16} className={open ? "is-open" : undefined} />
        <span className="auto-report-title">{title}</span>
        <span className={`tag${scheduled ? " tag-soft" : ""}`}>{scheduled ? "Automatic" : "Manual"}</span>
        <span className="faint small">{dateTime(new Date(report.generatedAt).toISOString())}</span>
      </button>
      {open && (
        <div className="auto-report-body">
          <AnswerView question={title} workspace={workspace} answer={report.answer} now={report.generatedAt} onOpen={onOpen} />
        </div>
      )}
    </article>
  );
}
