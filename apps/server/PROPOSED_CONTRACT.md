# Proposed contract and database changes

Shapes the server needs that `@mesh/contract` and `docs/database.md` do not define yet. They are implemented locally and can move into the contract with a small PR.

## 1. Dashboard API types (`packages/contract`)

The REST shapes the web app uses live in `apps/server/src/api/` and the web imports them as `@mesh/server/api`. Proposal: move them into `@mesh/contract` and add these routes to `ApiRoute`:

| Route | Shape |
|---|---|
| `GET /api/v1/workspaces` | `WorkspacesResponse` |
| `GET /api/v1/people?workspace=` | `PeopleResponse` |
| `GET /api/v1/modules?workspace=` | `{ workspace, modules, tags, people }` |
| `GET /api/v1/feed?workspace=&person=&status=&module=&since=` | `FeedResponse` (`status` also accepts `active` for sessions that pinged but never reported) |
| `GET /api/v1/events/:id?workspace=` | `EventResponse` (`id` is a report id `evt_…` or a session key) |
| `GET /api/v1/warnings?workspace=&since=` | `WarningsResponse` |
| `POST /api/v1/ask` | `AskRequest` → `AskResponse` |
| `GET/POST /api/v1/tickets`, `GET /api/v1/tickets/:ref` | `Ticket[]`, `CreateTicketRequest` → `Ticket`, `TicketDetail` |
| `POST /api/v1/people/:person/status` | `SetPersonStatusRequest` |
| `GET /api/v1/exit-interview/:person`, `POST …/questions`, `POST …/answers` | `ExitInterviewResponse`, `GenerateQuestionsRequest`, `SaveExitAnswerRequest` → `KnowledgeEntry` |
| `GET /api/v1/onboarding/:module?workspace=` | `OnboardingResponse` |

## 2. MCP tool schemas for the open tools

- `list_my_tickets { workspace, person }` → `{ tickets: Ticket[] }`
- `get_ticket { workspace, ref }` → `TicketDetail & { found }`
- `create_ticket { workspace, title, created_by, description?, assignee?, ref? }` → `{ ticket }`
- `ask_team { workspace, question }` → `{ answer, no_record, citations }`

## 3. Database (`supabase/migrations/20261003150000_dashboard_api.sql`, additive)

- New table `exit_questions` and functions `session_records`, `list_warnings`, `list_workspaces`, `workspace_people`, `set_person_status`, `create_ticket`, `list_tickets`, `list_knowledge`, `list_exit_questions`, `replace_exit_questions`, `answer_exit_question`.
- **Privacy fix:** `workspace_vocabulary` listed every row of `people`, including people who only have private sessions (`report_progress` creates them). It is replaced so people come only from shared sessions. This list feeds the planner prompt.
- Not applied to the live Supabase project yet: paste the file into the SQL editor or run it with the CLI.

## 4. Requests for the database owner

- `report_progress` ignores the contract's `decisions[].area` (it only lands in `raw_json`). Add `report_items.decision_area`.
- `report_progress` always uses `now()`. An optional `p_now` (service role only) would let demo seed data carry real history dates; today all seeded history shows today's date.
- The hook person check makes `touch_session` fail for a session id reused by another person; the server answers `request_report: false` in that case.
