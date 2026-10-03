import { DoorOpen } from "lucide-react";
import { useState } from "react";
import { PersonStatus } from "@mesh/contract";
import type { ExitQuestion } from "@mesh/server/api";
import { api } from "../api";
import { Empty, ErrorState, Loading, Section } from "../components/bits";
import { day } from "../format";
import { useLoad } from "../hooks";

function QuestionCard({ q, onSave }: { q: ExitQuestion; onSave: (answer: string) => Promise<void> }) {
  const [text, setText] = useState(q.answer?.answer ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(q.answer ? "saved" : "idle");
  const save = async () => {
    setState("saving");
    try {
      await onSave(text);
      setState("saved");
    } catch {
      setState("error");
    }
  };
  return (
    <article className={`question-card${state === "saved" ? " question-saved" : ""}`}>
      <div className="question-head">
        {q.module && <span className="tag tag-mono">{q.module}</span>}
        <span className="muted small">based on {q.source_event_ids.length} report{q.source_event_ids.length === 1 ? "" : "s"}</span>
      </div>
      <p className="question-text">{q.question}</p>
      {q.rationale && <p className="muted small">{q.rationale}</p>}
      <textarea value={text} onChange={(e) => { setText(e.target.value); if (state === "saved") setState("idle"); }} rows={3} placeholder="Their answer, in their words" />
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!text.trim() || state === "saving"} onClick={save}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save answer"}
        </button>
        {state === "error" && <span className="error-text">Could not save. Try again.</span>}
      </div>
    </article>
  );
}

export function ExitInterview({ workspace }: { workspace: string }) {
  const people = useLoad(() => api.people(workspace), [workspace]);
  const [person, setPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const interview = useLoad(() => (person ? api.exitInterview(workspace, person) : Promise.resolve(undefined)), [workspace, person]);
  const data = interview.data;

  const markLeaving = async () => {
    setBusy(true);
    try {
      await api.setStatus(workspace, person, PersonStatus.leaving);
      await api.generateQuestions(workspace, person, false);
      interview.reload();
    } finally {
      setBusy(false);
    }
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      await api.generateQuestions(workspace, person, true);
      interview.reload();
    } finally {
      setBusy(false);
    }
  };
  const markLeft = async () => {
    await api.setStatus(workspace, person, PersonStatus.left);
    interview.reload();
  };

  return (
    <div className="view">
      <div className="filters">
        <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
          <option value="">Choose who is leaving…</option>
          {(people.data?.people ?? []).map((p) => <option key={p.person} value={p.person}>{p.person}{p.status !== "active" ? ` (${p.status})` : ""}</option>)}
        </select>
        {data && data.status === PersonStatus.active && <button type="button" className="btn btn-primary" disabled={busy} onClick={markLeaving}>{busy ? "Preparing questions…" : "Mark as leaving"}</button>}
        {data && data.status !== PersonStatus.active && (
          <>
            <span className={`badge badge-${data.status}`}>{data.status === PersonStatus.left ? "Has left" : "Leaving"}</span>
            {data.questions.length === 0 ? <button type="button" className="btn btn-primary" disabled={busy} onClick={regenerate}>{busy ? "Preparing…" : "Generate questions"}</button> : <button type="button" className="btn btn-ghost" disabled={busy} onClick={regenerate}>{busy ? "Preparing…" : "New questions"}</button>}
            {data.status === PersonStatus.leaving && <button type="button" className="btn btn-ghost" onClick={markLeft}>Mark as left</button>}
          </>
        )}
      </div>
      {people.error && <ErrorState message={people.error} onRetry={people.reload} />}
      {!person && <Empty icon={DoorOpen} title="Capture what a departing person knows">Pick someone to see the areas only they know well and the questions built from their own reports.</Empty>}
      {person && interview.loading && !data && <Loading />}
      {interview.error && <ErrorState message={interview.error} onRetry={interview.reload} />}
      {data && (
        <>
          <Section title="Where the knowledge sits" count={data.coverage.length}>
            {data.coverage.length === 0 ? <p className="muted">{person} is not the main contributor to any module yet.</p> : (
              <div className="coverage">
                {data.coverage.map((c) => (
                  <div key={c.module} className={`coverage-row${c.thin ? " coverage-thin" : ""}`}>
                    <div className="coverage-name"><strong>{c.module}</strong>{c.thin && <span className="badge badge-thin">little reasoning recorded</span>}</div>
                    <div className="bar"><span style={{ width: `${Math.round(c.share * 100)}%` }} /></div>
                    <p className="muted small">{c.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
          {data.questions.length > 0 && (
            <Section title="Questions from their own history" count={data.questions.length}>
              {data.questions.map((q) => (
                <QuestionCard key={q.question_id} q={q} onSave={async (answer) => { await api.saveAnswer(workspace, person, q.question_id, answer); interview.reload(); }} />
              ))}
            </Section>
          )}
          <Section title="Saved knowledge" count={data.entries.length}>
            {data.entries.length === 0 ? <p className="muted">No answers saved yet.</p> : (
              <ul className="reasons">{data.entries.map((k) => <li key={k.entry_id}><strong>{k.question}</strong><span>{k.answer}</span><time>{k.module ?? ""} · {day(k.created_at)}</time></li>)}</ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
