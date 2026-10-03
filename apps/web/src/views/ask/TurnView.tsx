import { TriangleAlert } from "lucide-react";
import { AnswerView } from "./answer/AnswerView";
import type { Turn } from "./useThread";

function Pending() {
  return (
    <div className="ask-pending" role="status" aria-live="polite">
      <span className="ask-pending-label">
        <i className="ask-dots" />
        Searching the shared record…
      </span>
      <span className="skeleton ask-sk" style={{ width: "92%" }} />
      <span className="skeleton ask-sk" style={{ width: "78%" }} />
      <span className="skeleton ask-sk" style={{ width: "54%" }} />
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div className="ask-error" role="alert">
      <TriangleAlert size={14} />
      <div>
        <strong>That did not work</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

interface Props {
  turn: Turn;
  onOpen: (id: string) => void;
}

export function TurnView({ turn, onOpen }: Props) {
  const wide = Boolean(turn.answer?.blocks?.length);
  return (
    <div className={`ask-turn${wide ? " ask-turn-wide" : ""}`}>
      <div className="ask-q"><span>{turn.question}</span></div>
      <div className="ask-res">
        {turn.error ? <Failure message={turn.error} /> : turn.answer ? <AnswerView question={turn.question} answer={turn.answer} now={turn.at} onOpen={onOpen} /> : <Pending />}
      </div>
    </div>
  );
}
