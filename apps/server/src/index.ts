import { startServer } from "./server.js";

const running = await startServer();
const { config, db, llm, log } = running.deps;

log(`listening on ${running.url} (MCP ${running.url}/mcp, REST ${running.url}/api/v1)`);
log(db.kind === "supabase" ? `database: Supabase ${config.supabaseUrl}` : `database: local PGlite ${config.pgliteDir ?? "(in memory)"}`);
log(llm ? `answers: ${config.answerModel}, planning: ${config.warnModel}` : "answers: no ANTHROPIC_API_KEY, so ask lists matching records and exit questions come from each person's own records");
log(config.members.length ? `access keys: ${config.members.length} members${config.workspace ? `, workspace fixed to ${config.workspace}` : ""}` : "access keys: none configured, every route is open");
if (config.allowedHosts.length) log(`/mcp Host allow-list: localhost + ${config.allowedHosts.join(", ")}`);

const shutdown = () => {
  void running.close().finally(() => {
    void db.close().finally(() => process.exit(0));
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
