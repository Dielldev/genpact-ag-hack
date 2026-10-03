import { parseArgs } from "node:util";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runUninstall } from "./commands/uninstall.js";

enum Command {
  init = "init",
  status = "status",
  uninstall = "uninstall",
  help = "help",
}

const USAGE = `Usage: mesh <command> [options]

Commands
  init        Connect this machine's agent CLIs to a Mesh server
  status      Show what is installed and whether the server is reachable
  uninstall   Remove the Mesh hook and MCP server from every agent CLI
  help        Show this message

Options for init
  --server <url>        Mesh server URL (default http://localhost:8787)
  --person <name>       Your name as teammates should see it
  --workspace <id>      Workspace to report into
  --clients <list>      Comma-separated: claude-code,codex,cursor,gemini (default: detected)
  -y, --yes             Accept defaults without prompting

Options for uninstall
  --purge               Also delete ~/.mesh (settings, hook runtime and logs)

Per project
  Put {"visibility": "private"} or {"enabled": false} in a .mesh.json file at the project root.`;

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: "string" },
      person: { type: "string" },
      workspace: { type: "string" },
      clients: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      purge: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const command = values.help ? Command.help : (positionals[0] ?? Command.help);

  switch (command) {
    case Command.init:
      return runInit({
        server: values.server,
        person: values.person,
        workspace: values.workspace,
        clients: values.clients,
        yes: values.yes ?? false,
      });
    case Command.status:
      return runStatus();
    case Command.uninstall:
      return runUninstall({ purge: values.purge ?? false });
    case Command.help:
      console.log(USAGE);
      return 0;
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
