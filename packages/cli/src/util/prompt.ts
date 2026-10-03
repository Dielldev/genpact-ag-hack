import { createInterface } from "node:readline/promises";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function ask(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (${fallback}): `);
    return answer.trim() === "" ? fallback : answer.trim();
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, fallback = true): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} ${fallback ? "[Y/n]" : "[y/N]"}: `)).trim().toLowerCase();
    if (answer === "") return fallback;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
