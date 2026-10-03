import { useState, type FormEvent } from "react";
import type { AskResponse } from "@mesh/server/api";
import { api } from "../api";
import { Avatar, Empty, ErrorState } from "../components/bits";
import { day } from "../format";
import { useLoad } from "../hooks";

interface Turn {
  question: string;
  answer?: AskResponse;
  error?: string;
}

export function Ask({ workspace, onOpen }: { workspace: string; onOpen: (id: string) => void }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const vocab = useLoad(() => Promise.all([api.modules(workspace), api.people(workspace)]), [workspace]);
  const [mods, people] = vocab.data ?? [undefined, undefined];
  const busiest = people?.people.find((p) => p.open_sessions > 0)?.person ?? people?.people[0]?.person;
  const left = people?.people.find((p) => p.status !== "active");
  const suggestions = [
    busiest && `What is ${busiest} working on?`,
    "Who is blocked right now, and on what?",
    mods?.modules[0] && `Why does ${mods.modules[0]} work the way it does?`,
    (left?.modules[0] ?? mods?.modules[1]) && `What should I know before touching ${left?.modules[0] ?? mods?.modules[1]}?`,
  ].filter((s): s is string => Boolean(s));

  const submit = async (text: string, e?: FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    setTurns((t) => [...t, { question: q }]);
    try {
      const answer = await api.ask(workspace, q);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, answer } : turn)));
    } catch (err) {
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: (err as Error).message } : turn)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view ask">
      {turns.length === 0 && (
        <Empty title="Ask about the team's work">Answers come only from shared reports and exit-interview answers, with the sessions they cite.</Empty>
      )}
      <div className="turns">
        {turns.map((t, i) => (
          <div key={i} className="turn">
            <p className="question">{t.question}</p>
            {!t.answer && !t.error && <p className="muted">Searching the shared record…</p>}
            {t.error && <ErrorState message={t.error} />}
            {t.answer?.no_record && <div className="no-record"><strong>No record</strong><p>{t.answer.answer.replace(/^No record:?\s*/i, "")}</p></div>}
            {t.answer && !t.answer.no_record && (
              <div className="answer">
                {t.answer.degraded && <p className="note">{t.answer.degraded}</p>}
                <p className="answer-text">{t.answer.answer}</p>
                <div className="citations">
                  {t.answer.sources.map((s) => (
                    <button key={s.session_pk} type="button" className="citation" onClick={() => onOpen(s.event_id ?? String(s.session_pk))}>
                      <Avatar name={s.person} />
                      <span><strong>{s.person}</strong> · {s.task ?? "session"} <span className="muted">{day(s.last_report_at ?? s.last_seen_at)}</span></span>
                    </button>
                  ))}
                  {t.answer.knowledge.map((k) => (
                    <span key={k.entry_id} className="citation citation-knowledge"><strong>Exit interview · {k.person}</strong> {k.question}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="suggestions">
        {suggestions.map((s) => <button key={s} type="button" className="chip chip-suggest" onClick={() => submit(s)}>{s}</button>)}
      </div>
      <form className="ask-box" onSubmit={(e) => submit(question, e)}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask what someone is doing, why something works the way it does, or what failed before" />
        <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>{busy ? "Asking…" : "Ask"}</button>
      </form>
    </div>
  );
}
