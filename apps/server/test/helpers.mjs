import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "supabase", "migrations");
export const CONTRACT_SRC = join(here, "..", "..", "..", "packages", "contract", "src");

export async function createDb() {
  const db = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return {
    db,
    q: async (sql, params = []) => (await db.query(sql, params)).rows,
    rpc: async (fn, payload) => {
      const result = await db.query(`select ${fn}($1::jsonb) as r`, [JSON.stringify(payload)]);
      return result.rows[0].r;
    },
  };
}

export async function rejects(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (code && error.code !== code) {
      throw new Error(`expected error code ${code}, got ${error.code}: ${error.message}`);
    }
    return error;
  }
  throw new Error("expected the call to fail");
}

export function parseContractEnums() {
  const source = readFileSync(join(CONTRACT_SRC, "enums.ts"), "utf8");
  const enums = {};
  for (const match of source.matchAll(/export enum (\w+) \{([^}]*)\}/g)) {
    enums[match[1]] = [...match[2].matchAll(/=\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  }
  return enums;
}
