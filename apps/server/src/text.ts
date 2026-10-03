export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

export function slugify(value: string, max = 60): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function normText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before
being below between both but by can could did do does doing done down during each few for from
further had has have having he her here hers him his how i if in into is it its itself just let
me more most my no nor not now of off on once only or other our out over own same she should so
some such than that the their them then there these they this those through to too under until
up very was we were what when where which while who whom why will with would you your yours
via per vs etc use used using make made new still get got set put add added adds adding update
updated updates updating change changed changes changing fix fixed fixes fixing work works
worked working implement implemented implementing start started starting continue continued
finish finished try tried trying need needs needed want wants code file files test tests
testing thing things stuff way ways able one two first last next today yesterday seems`.split(/\s+/),
);

export function stem(word: string): string {
  let w = word;
  for (const suffix of ["ations", "ation", "ings", "ing", "ied", "ies", "ed", "es", "s", "ly"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.endsWith("i") ? `${w.slice(0, -1)}y` : w;
}

export function keywords(text: string, max = 24): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

export function termOverlap(a: string, b: string): number {
  const left = new Set(keywords(a, 200).map(stem));
  let count = 0;
  for (const word of new Set(keywords(b, 400).map(stem))) if (left.has(word)) count++;
  return count;
}

export function orQuery(text: string, max = 24): string | null {
  const terms = keywords(text, max);
  return terms.length > 0 ? terms.join(" or ") : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function hoursBefore(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

export function shortDate(iso: string): string {
  return iso.slice(0, 10);
}
