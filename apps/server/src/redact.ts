export interface RedactionRule {
  type: string;
  pattern: RegExp;
  replace?: (match: string, ...groups: string[]) => string;
}

const tag = (type: string) => `[REDACTED:${type}]`;

function cardValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  if (!/^(4|5[1-5]|2[2-7]|3[47]|3[0689]|6[0245])/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function ibanValid(compact: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const value = code >= 65 ? String(code - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

function longestValidPrefix(
  match: string,
  separator: RegExp,
  normalize: (s: string) => string,
  valid: (s: string) => boolean,
  type: string,
): string {
  const parts = match.split(separator);
  const seps = match.match(new RegExp(separator.source, "g")) ?? [];
  for (let k = parts.length; k >= 1; k--) {
    const candidate = parts.slice(0, k).join("");
    if (valid(normalize(candidate))) {
      let rest = "";
      for (let i = k; i < parts.length; i++) rest += (seps[i - 1] ?? "") + parts[i];
      return tag(type) + rest;
    }
  }
  return match;
}

const BOOLEANISH = /^(true|false|null|none|undefined|required|optional|empty|missing|redacted)$/i;

function secretValue(value: string, assignment: boolean): boolean {
  if (/^\d+$/.test(value) || BOOLEANISH.test(value)) return false;
  if (assignment) return value.length >= 3;
  const mixed = /\d/.test(value) && /[a-z]/i.test(value);
  const symbol = /[^A-Za-z0-9]/.test(value);
  return value.length >= 6 && (mixed || symbol || value.length >= 16);
}

export const REDACTION_RULES: RedactionRule[] = [
  {
    type: "private_key",
    pattern:
      /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----|$)/g,
  },
  {
    type: "url_credentials",
    pattern: /\b([a-z][a-z0-9+.-]{1,20}:\/\/)[^\s:@/]*:[^\s@/]+@/gi,
    replace: (_m, scheme) => `${scheme}${tag("url_credentials")}@`,
  },
  {
    type: "aws_access_key",
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA|APKA|ASCA)[A-Z0-9]{16}\b/g,
  },
  { type: "github_token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})/g },
  { type: "slack_token", pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { type: "slack_webhook", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g },
  { type: "stripe_key", pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}|\bwhsec_[A-Za-z0-9]{16,}/g },
  { type: "api_key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { type: "google_api_key", pattern: /\bAIza[0-9A-Za-z_-]{35}/g },
  { type: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
  {
    type: "bearer_token",
    pattern: /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
    replace: (_m, word) => `${word} ${tag("bearer_token")}`,
  },
  {
    type: "basic_auth",
    pattern: /\b(Basic)\s+[A-Za-z0-9+/]{16,}={0,2}/g,
    replace: (_m, word) => `${word} ${tag("basic_auth")}`,
  },
  {
    type: "secret",
    pattern:
      /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*)(["']?\s*([:=])\s*)(["']?)([^\s"',;{}()[\]]+)\4/gi,
    replace: (match, key, sep, op, quote, value) =>
      secretValue(value, op === "=" || quote !== "")
        ? `${key}${sep}${quote}${tag("secret")}${quote}`
        : match,
  },
  {
    type: "iban",
    pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g,
    replace: (m) => longestValidPrefix(m, / /, (s) => s, ibanValid, "iban"),
  },
  {
    type: "card_number",
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    replace: (m) => longestValidPrefix(m, /[ -]/, (s) => s, cardValid, "card_number"),
  },
];

export function redact(text: string): string {
  if (!text) return text;
  let out = text;
  for (const rule of REDACTION_RULES) {
    rule.pattern.lastIndex = 0;
    out = out.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
      if (!rule.replace) return tag(rule.type);
      const groups = rest.filter((g) => typeof g === "string" || g === undefined) as string[];
      const captures = groups.slice(0, Math.max(0, groups.length - 1)).map((g) => g ?? "");
      return rule.replace(match, ...captures);
    });
  }
  return out;
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v);
    return out as T;
  }
  return value;
}
