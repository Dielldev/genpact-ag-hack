export const SERVER_INSTRUCTIONS = `Mesh turns agent work into shared team knowledge.
After each response in which you made meaningful progress, call report_progress once. Skip it when the turn did no real work.
Never send secrets, source code, transcript excerpts or anything from a private context.
If report_progress returns warnings, tell the user about each one in one or two lines.`;

export const REPORT_PROGRESS_DESCRIPTION = `Report what you just did so your team (people and other agents) can see it without interrupting anyone.

When: call once after a response in which you made meaningful progress: you changed code or documents, made a decision, hit or cleared a blocker, or abandoned an approach. Skip it when the turn did no real work (a greeting, a quick factual answer, a clarification).

How: reuse the same session_id for the whole session. The server keeps one evolving record per session (in progress, then blocked, then done), so send what is true now. Lists are merged across reports; blockers means "blocking right now", so send [] once nothing blocks you.

Never include secrets (API keys, tokens, passwords, connection strings), source code, transcript excerpts or personal data. Write short plain-language summaries.

If the result contains warnings, tell the user about each one in one or two lines: a warning means another person is changing what you depend on, or already solved the problem you are hitting.`;

export const REPORT_FIELD_DESCRIPTIONS: Record<string, string> = {
  session_id:
    'Session id from the hook instruction, copied exactly. If none was given, make up one short id and reuse it for every report in this conversation. Example: "5f2c9e1a-77b0-4c1e-9d0a-3b8e2f6a1c44"',
  client: 'Which agent you are. Example: "claude-code"',
  person: 'The user from the hook instruction or local config. Example: "Ana Lee"',
  workspace: 'Team workspace from the hook instruction. It is the permission boundary. Example: "acme-dev"',
  visibility:
    '"private" if the instruction or the user says this session is private, otherwise "shared". Example: "shared"',
  ticket_ref: 'Ticket this work belongs to, if any. Example: "BILL-142"',
  task: 'What you are working on, in a few words. Example: "Add retry with backoff to the Stripe webhook handler"',
  status:
    'in_progress while working, blocked when you cannot continue without help or a fix, done when the task is finished. Example: "blocked"',
  summary:
    '1 to 2 sentences: what happened this turn and where things stand. Example: "Moved webhook processing to a queue; the handler now returns 200 in under 50ms. Duplicate deliveries still need an idempotency key."',
  artifacts:
    'Things you worked on, described generically: kind is file, doc, deal, client, model or similar; ref is a path or name. Example: [{"kind":"file","ref":"src/billing/webhooks.ts"},{"kind":"deal","ref":"Project Falcon"}]',
  modules:
    'Short, stable, lowercase slugs for the areas involved. Reuse the same slugs across reports. Example: ["billing","retry-logic","webhooks"]',
  tags: 'Optional extra keywords. Example: ["stripe","idempotency"]',
  decisions:
    'Optional. Only important technical or product decisions that were explicitly made and matter for future work, each with its reason. Usually omit. Example: [{"area":"technical","choice":"Process webhooks from a queue","reason":"Stripe times out after 10s and resends the event"}]',
  dead_ends:
    'Only approaches you tried and abandoned, with why they failed. Example: [{"attempt":"Retrying inline in the webhook handler","reason":"Stripe resent the event while we retried, causing duplicate charges"}]',
  human_corrections:
    'Only places where the human overrode or corrected you, with their reason. Example: [{"correction":"Use the existing retry helper instead of a new one","reason":"Ops monitors that helper\'s metrics"}]',
  blockers: 'What is blocking you right now; [] when nothing is. Example: ["Staging has no Stripe webhook signing key configured"]',
};

export const LIST_MY_TICKETS_DESCRIPTION = `List the open tickets assigned to a person, created by them, or referenced by their recent shared reports. Call it at the start of a task to find which ticket the work belongs to, then pass that ticket's ref as ticket_ref in report_progress.`;

export const GET_TICKET_DESCRIPTION = `Read a ticket before you start work on it: its description plus everything the team already recorded for it (past notes, decisions with reasons, dead ends to avoid, human corrections) and exit-interview knowledge for its modules. Use it to avoid repeating approaches that already failed. Also the fastest way to get up to speed on an area whose owner has left.`;

export const CREATE_TICKET_DESCRIPTION = `Create a lightweight ticket (a named container for reports) when the work has none. Returns the ticket ref to use as ticket_ref in report_progress. Call list_my_tickets first so you do not create a duplicate.`;

export const ASK_TEAM_DESCRIPTION = `Ask a question about your team's work and get an answer built only from shared reports and exit-interview knowledge, with the event ids it cites. Good for "what is Ana working on?", "why does billing retry read dunning_config?" or "what should I know before touching webhooks?". Says "no record" when nothing covers the question.`;
