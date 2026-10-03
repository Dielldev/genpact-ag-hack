export type ReasonKind = "Decision" | "Dead end";

interface Props {
  kind: ReasonKind;
  title: string;
  reason: string;
  meta: string;
  onClick: () => void;
}

export function ReasonRow({ kind, title, reason, meta, onClick }: Props) {
  return (
    <li>
      <button type="button" className="rep-issue" onClick={onClick}>
        <span className={`rep-chip ${kind === "Decision" ? "rep-chip-decision" : "rep-chip-dead"}`}>{kind}</span>
        <span className="rep-issue-main">
          <span className="rep-issue-text">{title}</span>
          <span className="rep-issue-why">{reason}</span>
          <span className="rep-issue-who"><span>{meta}</span></span>
        </span>
      </button>
    </li>
  );
}
