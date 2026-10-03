import type { FeedItem } from "@mesh/server/api";
import { useEffect, useRef, useState } from "react";

export function useChanged(items: FeedItem[] | undefined): Set<string> {
  const seen = useRef(new Map<string, string>());
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!items) return;
    const fresh = new Set<string>();
    for (const item of items) {
      const stamp = `${item.last_seen_at}|${item.report_count}|${item.status}`;
      const before = seen.current.get(item.key);
      if (before !== undefined && before !== stamp) fresh.add(item.key);
      seen.current.set(item.key, stamp);
    }
    if (fresh.size === 0) return;
    setChanged(fresh);
    const timer = setTimeout(() => setChanged(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [items]);
  return changed;
}
