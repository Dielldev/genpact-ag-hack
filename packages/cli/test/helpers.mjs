import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
export const HOOK_BIN = join(dist, "hook.mjs");
export const CLI_BIN = join(dist, "cli.mjs");

export function makeHome() {
  return mkdtempSync(join(tmpdir(), "mesh-test-"));
}

export function writeConfig(home, serverUrl) {
  mkdirSync(join(home, ".mesh"), { recursive: true });
  writeFileSync(
    join(home, ".mesh", "config.json"),
    JSON.stringify({ serverUrl, person: "Test User", workspace: "demo" }),
  );
}

export function run(bin, args, { home, stdin = "", env = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, MESH_HOME: home, MESH_DISABLED: "", MESH_PRIVATE: "", ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

export function runHook(client, payload, options) {
  return run(HOOK_BIN, ["--client", client], { ...options, stdin: JSON.stringify(payload) });
}

export async function startStubServer(response = { request_report: true }) {
  const pings = [];
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/api/v1/health") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/turns") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        pings.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(response));
      });
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    pings,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
