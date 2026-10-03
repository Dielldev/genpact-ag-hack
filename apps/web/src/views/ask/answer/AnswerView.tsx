import type { AskResponse } from "@mesh/server/api";
import { Info, SearchX } from "lucide-react";
import { useRef } from "react";
import { BlockList } from "../blocks/BlockView";
import { Evidence } from "./Evidence";
import { RichText } from "./richText";
import { Steps } from "./Steps";

interface Props {
  question: string;
  workspace: string;
  answer: AskResponse;
  now: number;
  onOpen: (id: string) => void;
}

export function AnswerView({ question, workspace, answer, now, onOpen }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const blocks = answer.blocks ?? [];
  if (answer.no_record && blocks.length === 0) {
    return (
      <div className="ask-norecord">
        <span className="ask-norecord-icon"><SearchX size={16} /></span>
        <div>
          <strong>No record</strong>
          <p>{answer.answer.replace(/^No record:?\s*/i, "")}</p>
          <p className="faint">Mesh only answers from shared reports and exit-interview answers. Try a person, a module or a time range, or ask for a sprint report.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="ask-answer" ref={root}>
      {answer.degraded && (
        <div className="ask-degraded" role="note">
          <Info size={14} />
          {answer.degraded}
        </div>
      )}
      {answer.answer.trim() && !(answer.no_record && blocks.length > 0) && <RichText text={answer.answer} sources={answer.sources} onOpen={onOpen} />}
      <Steps question={question} answer={answer} target={root} workspace={workspace} />
      {blocks.length > 0 && <BlockList blocks={blocks} now={now} onOpen={onOpen} />}
      <Evidence answer={answer} now={now} onOpen={onOpen} compact={blocks.length > 0} />
    </div>
  );
}
