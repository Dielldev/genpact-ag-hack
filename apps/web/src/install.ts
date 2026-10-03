export type InstallShell = "posix" | "powershell";

const SAFE = /^[A-Za-z0-9._:/@+=-]+$/;

const posixWord = (value: string): string => (SAFE.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`);
const psString = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const psWord = (value: string): string => (SAFE.test(value) ? value : psString(value));

export function installCommand(shell: InstallShell, origin: string, key: string): string {
  if (shell === "posix") {
    const env = key ? `MESH_KEY=${posixWord(key)} ` : "";
    return `curl -fsSL ${posixWord(`${origin}/install.sh`)} | ${env}sh`;
  }
  const env = key ? `$env:MESH_KEY=${psString(key)}; ` : "";
  return `${env}irm ${psWord(`${origin}/install.ps1`)} | iex`;
}
