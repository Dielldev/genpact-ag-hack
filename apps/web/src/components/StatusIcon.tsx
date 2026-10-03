import type { Tone } from "../format";

const COLOR: Record<Tone, string> = {
  active: "#a09fb4",
  progress: "#6c3ff0",
  blocked: "#e8870b",
  stuck: "#e5484d",
  done: "#1fa97a",
};

export function StatusIcon({ tone, size = 16 }: { tone: Tone; size?: number }) {
  const c = COLOR[tone];
  return (
    <svg className="sicon" width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      {tone === "active" && <circle cx="7" cy="7" r="5.6" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="2.2 2.2" />}
      {tone === "progress" && (
        <>
          <circle cx="7" cy="7" r="5.6" fill="none" stroke={c} strokeWidth="1.6" />
          <path d="M7 3.6 A3.4 3.4 0 0 1 7 10.4 Z" fill={c} />
        </>
      )}
      {tone === "blocked" && (
        <>
          <circle cx="7" cy="7" r="5.6" fill="none" stroke={c} strokeWidth="1.6" />
          <rect x="4.4" y="6.2" width="5.2" height="1.6" rx="0.8" fill={c} />
        </>
      )}
      {tone === "stuck" && (
        <>
          <circle cx="7" cy="7" r="6.4" fill={c} />
          <rect x="6.2" y="3.4" width="1.6" height="4.2" rx="0.8" fill="#fff" />
          <circle cx="7" cy="9.8" r="0.95" fill="#fff" />
        </>
      )}
      {tone === "done" && (
        <>
          <circle cx="7" cy="7" r="6.4" fill={c} />
          <path d="M4.2 7.2 6.2 9.1 9.9 5.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
