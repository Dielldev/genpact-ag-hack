import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, parseMembers, type Config } from "../src/config.js";
import type { AppDeps } from "../src/deps.js";
import { HttpError } from "../src/http/errors.js";
import { authorize, identityOf, memberFor, tokenOf, withIdentity } from "../src/http/auth.js";
import { restoreUrl } from "../src/vercel.js";
import { ANA, BO, WORKSPACE } from "./harness.js";

const depsWith = (config: Partial<Config>) => ({ config: { members: [], workspace: undefined, ...config } }) as unknown as AppDeps;

describe("parseMembers", () => {
  it("parses name and key pairs", () => {
    assert.deepEqual(parseMembers(`${ANA.name}:${ANA.key},${BO.name}:${BO.key}`), [ANA, BO]);
  });

  it("keeps spaces inside names and trims the edges", () => {
    assert.deepEqual(parseMembers(`  Ana Maria  Lee : ${ANA.key} , ${BO.name}:${BO.key}  `), [{ name: "Ana Maria  Lee", key: ANA.key }, BO]);
  });

  it("returns nothing for an empty or missing value", () => {
    assert.deepEqual(parseMembers(undefined), []);
    assert.deepEqual(parseMembers(""), []);
    assert.deepEqual(parseMembers("  ,  , "), []);
  });

  it("ignores a trailing comma", () => {
    assert.deepEqual(parseMembers(`${ANA.name}:${ANA.key},`), [ANA]);
  });

  it("splits on the last colon so a name may contain one", () => {
    assert.deepEqual(parseMembers(`Acme: Ana Lee:${ANA.key}`), [{ name: "Acme: Ana Lee", key: ANA.key }]);
  });

  it("accepts a key of exactly 16 characters and rejects 15", () => {
    assert.equal(parseMembers(`Ana:${"k".repeat(16)}`)[0]?.key.length, 16);
    assert.throws(() => parseMembers(`Ana:${"k".repeat(15)}`), /at least 16 characters/);
  });

  it("rejects a short key without echoing it", () => {
    assert.throws(
      () => parseMembers("Ana:short-secret"),
      (error: Error) => /MESH_MEMBERS/.test(error.message) && !error.message.includes("short-secret"),
    );
  });

  it("rejects entries without a colon, a name or a key", () => {
    for (const value of [`Ana${ANA.key}`, ANA.key, `:${ANA.key}`, `   :${ANA.key}`, "Ana:", "Ana:   "]) {
      assert.throws(() => parseMembers(value), /MESH_MEMBERS/, value);
    }
  });

  it("rejects the whole list when one entry is bad", () => {
    assert.throws(() => parseMembers(`${ANA.name}:${ANA.key},Bo Chen:short`), /MESH_MEMBERS/);
  });

  it("loadConfig reads members and workspace from the environment", () => {
    const config = loadConfig({ MESH_MEMBERS: `${ANA.name}:${ANA.key}`, MESH_WORKSPACE: ` ${WORKSPACE} ` });
    assert.deepEqual(config.members, [ANA]);
    assert.equal(config.workspace, WORKSPACE);
    const bare = loadConfig({});
    assert.deepEqual(bare.members, []);
    assert.equal(bare.workspace, undefined);
    assert.equal(loadConfig({ MESH_WORKSPACE: "   " }).workspace, undefined);
    assert.throws(() => loadConfig({ MESH_MEMBERS: "Ana:short" }), /MESH_MEMBERS/);
  });
});

describe("bearer token helpers", () => {
  it("tokenOf reads a bearer token in any case", () => {
    assert.equal(tokenOf("Bearer abc"), "abc");
    assert.equal(tokenOf("bearer    abc  "), "abc");
    assert.equal(tokenOf("BEARER abc"), "abc");
  });

  it("tokenOf returns nothing for other schemes or no header", () => {
    for (const value of [undefined, "", "Bearer", "Basic abc", "abc", "Token abc"]) assert.equal(tokenOf(value), undefined, String(value));
  });

  it("memberFor matches the exact key only", () => {
    const members = [ANA, BO];
    assert.equal(memberFor(members, ANA.key), ANA);
    assert.equal(memberFor(members, BO.key), BO);
    assert.equal(memberFor(members, undefined), null);
    assert.equal(memberFor(members, ""), null);
    assert.equal(memberFor(members, `${ANA.key}x`), null);
    assert.equal(memberFor(members, ANA.key.toUpperCase()), null);
    assert.equal(memberFor([], ANA.key), null);
  });

  it("authorize lets everything through when no members are configured", () => {
    assert.doesNotThrow(() => authorize(depsWith({}), undefined));
    assert.doesNotThrow(() => authorize(depsWith({}), "Bearer whatever"));
  });

  it("authorize throws a 401 HttpError when members are configured", () => {
    const deps = depsWith({ members: [ANA] });
    assert.doesNotThrow(() => authorize(deps, `Bearer ${ANA.key}`));
    for (const header of [undefined, "Bearer nope", `Basic ${ANA.key}`]) {
      assert.throws(
        () => authorize(deps, header),
        (error: unknown) => error instanceof HttpError && error.status === 401 && error.code === "unauthorized",
      );
    }
  });

  it("identityOf combines the key owner and the forced workspace", () => {
    const deps = depsWith({ members: [ANA], workspace: WORKSPACE });
    assert.deepEqual(identityOf(deps, `Bearer ${ANA.key}`), { person: ANA.name, workspace: WORKSPACE });
    assert.deepEqual(identityOf(deps, undefined), { workspace: WORKSPACE });
    assert.deepEqual(identityOf(depsWith({ members: [ANA] }), `Bearer ${ANA.key}`), { person: ANA.name });
    assert.deepEqual(identityOf(depsWith({}), `Bearer ${ANA.key}`), {});
  });

  it("withIdentity overrides object bodies and leaves anything else alone", () => {
    assert.deepEqual(withIdentity({ person: "Mallory", workspace: "evil", task: "t" }, { person: ANA.name }), { person: ANA.name, workspace: "evil", task: "t" });
    assert.deepEqual(withIdentity({ a: 1 }, {}), { a: 1 });
    assert.equal(withIdentity(null, { person: ANA.name }), null);
    assert.equal(withIdentity("text", { person: ANA.name }), "text");
    const list = [1, 2];
    assert.equal(withIdentity(list, { person: ANA.name }), list);
  });
});

describe("restoreUrl", () => {
  it("maps the rewritten function url back to the original path and query", () => {
    assert.equal(restoreUrl("/api?__path=api/v1/me&x=1"), "/api/v1/me?x=1");
  });

  it("returns a bare path when only __path is present", () => {
    assert.equal(restoreUrl("/api?__path=api/v1/health"), "/api/v1/health");
    assert.equal(restoreUrl("/api?__path=mcp"), "/mcp");
  });

  it("leaves urls without __path untouched", () => {
    assert.equal(restoreUrl("/api/v1/me?x=1"), "/api/v1/me?x=1");
    assert.equal(restoreUrl("/api/v1/health"), "/api/v1/health");
    assert.equal(restoreUrl("/mcp"), "/mcp");
  });

  it("defaults to the root when there is no url", () => {
    assert.equal(restoreUrl(undefined), "/");
    assert.equal(restoreUrl(""), "/");
  });

  it("keeps every other query parameter, in any position, with repeats", () => {
    const restored = new URL(`http://mesh.test${restoreUrl("/api?workspace=gen%20pact&__path=api/v1/feed&tag=a&tag=b&person=Ana+Lee")}`);
    assert.equal(restored.pathname, "/api/v1/feed");
    assert.equal(restored.searchParams.get("workspace"), "gen pact");
    assert.equal(restored.searchParams.get("person"), "Ana Lee");
    assert.deepEqual(restored.searchParams.getAll("tag"), ["a", "b"]);
    assert.equal(restored.searchParams.has("__path"), false);
  });

  it("decodes an encoded __path and never produces a protocol-relative url", () => {
    assert.equal(restoreUrl("/api?__path=api%2Fv1%2Fme"), "/api/v1/me");
    assert.equal(restoreUrl("/api?__path=/api/v1/me"), "/api/v1/me");
    assert.equal(restoreUrl("/api?__path=//evil.example/x"), "/evil.example/x");
  });
});

describe("parseMembers duplicates", () => {
  it("rejects a repeated name or key", () => {
    const a = "a".repeat(20);
    const b = "b".repeat(20);
    assert.throws(() => parseMembers(`Ana:${a},ana:${b}`), /repeat/);
    assert.throws(() => parseMembers(`Ana:${a},Bo:${a}`), /repeat/);
    assert.equal(parseMembers(`Ana:${a},Bo:${b}`).length, 2);
  });
});
