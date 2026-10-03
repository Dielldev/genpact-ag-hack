import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeReport, parseReport } from "../src/ingest/normalize.js";
import { redact } from "../src/redact.js";
import { ValidationError } from "../src/schemas.js";

const secrets: Array<[string, string]> = [
  ["deploy used AKIAIOSFODNN7EXAMPLE", "aws_access_key"],
  ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", "github_token"],
  ["xoxb-1234567890-abcdefghijklmnop", "slack_token"],
  ["sk_live_51HabcdefGHIJKLmnop", "stripe_key"],
  ["sk-ant-api03-abcdefghijklmnopqrstuvwxyz", "api_key"],
  ["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "jwt"],
  ["Authorization: Bearer abcdef1234567890abcdef", "bearer_token"],
  ["postgres://admin:hunter2@db.internal:5432/app", "url_credentials"],
  ["set password=hunter2 in env", "secret"],
  ["charged 4111 1111 1111 1111 twice", "card_number"],
  ["wire to DE89 3704 0044 0532 0130 00", "iban"],
  ["-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----", "private_key"],
];

const base = {
  session_id: "s1",
  client: "claude-code",
  person: "Ana Lee",
  workspace: "acme-dev",
  visibility: "shared",
  task: "Task",
  status: "in_progress",
  summary: "Summary",
};

describe("redaction", () => {
  for (const [input, type] of secrets) {
    it(type, () => assert.match(redact(input), new RegExp(`\\[REDACTED:${type}\\]`)));
  }
  it("leaves normal prose alone", () => {
    for (const text of ["Fixed token refresh: tokens rotate hourly.", "max_tokens = 4096", "order 4111 1111 1111 1112", "ts 20261003140211"]) {
      assert.equal(redact(text), text);
    }
  });
});

describe("report validation and normalization", () => {
  it("rejects values outside the enums and lists the allowed values", () => {
    assert.throws(() => parseReport({ ...base, status: "finished" }), (e: unknown) => e instanceof ValidationError && /status must be one of: in_progress, blocked, done/.test(e.message));
    assert.throws(() => parseReport({ ...base, visibility: "public" }), /visibility must be one of: shared, private/);
  });
  it("strips unknown keys, defaults arrays, truncates, slugs modules and redacts", () => {
    const r = normalizeReport(parseReport({ ...base, mood: "great", task: "x".repeat(5000), modules: [" Retry Logic ", "retry_logic", "Billing"], blockers: ["key sk-ant-api03-abcdefghijklmnopqrstuvwxyz rejected"] }));
    assert.equal("mood" in r, false);
    assert.deepEqual(r.dead_ends, []);
    assert.ok(r.task.length <= 300);
    assert.deepEqual(r.modules, ["retry-logic", "billing"]);
    assert.match(r.blockers[0]!, /\[REDACTED:api_key\]/);
  });
});
