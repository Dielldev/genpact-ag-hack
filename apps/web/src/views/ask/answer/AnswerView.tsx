import type { AskResponse } from "@mesh/server/api";
import { Info, SearchX } from "lucide-react";
import { useMemo, useRef } from "react";
import { BlockList } from "../blocks/BlockView";
import { AttentionCard } from "../cards/Attention";
import { compose } from "../cards/compose";
import { GlanceCard } from "../cards/Glance";
import { More, summaryOf } from "../cards/More";
import { WhoDidWhatCard } from "../cards/WhoDidWhat";
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
  const composed = useMemo(() => compose(blocks), [blocks]);
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
  const hasEvidence = answer.sources.length > 0 || answer.knowledge.length > 0;
  const hasMore = composed.rest.length > 0 || (blocks.length > 0 && hasEvidence);
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
      {composed.glance && <GlanceCard glance={composed.glance} />}
      {composed.attention && <AttentionCard rows={composed.attention} onOpen={onOpen} />}
      {composed.people && <WhoDidWhatCard rows={composed.people} onOpen={onOpen} />}
      {hasMore && (
        <More summary={summaryOf(composed.rest.map((b) => b.type), hasEvidence)}>
          <BlockList blocks={composed.rest} now={now} onOpen={onOpen} />
          <Evidence answer={answer} now={now} onOpen={onOpen} compact />
        </More>
      )}
      {blocks.length === 0 && <Evidence answer={answer} now={now} onOpen={onOpen} />}
    </div>
  );
}
