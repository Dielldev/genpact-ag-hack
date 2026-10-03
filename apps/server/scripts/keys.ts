import { randomBytes } from "node:crypto";

const names = process.argv.slice(2).filter(Boolean);
const people = names.length > 0 ? names : [1, 2, 3, 4, 5].map((n) => `Member ${n}`);
const members = people.map((name) => ({ name: name.replace(/[,:]/g, " ").trim(), key: `mesh_${randomBytes(20).toString("hex")}` }));

console.log(`MESH_MEMBERS=${members.map((m) => `${m.name}:${m.key}`).join(",")}`);
console.log("");
for (const m of members) console.log(`${m.name.padEnd(24)} ${m.key}`);
