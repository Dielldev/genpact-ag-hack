import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

export function defaultPersonName(): string {
  try {
    const name = execFileSync("git", ["config", "--global", "user.name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    if (name) return name;
  } catch {
    return userInfo().username;
  }
  return userInfo().username;
}
