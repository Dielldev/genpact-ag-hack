import { useEffect, useRef } from "react";

export interface Shortcut {
  keys: string;
  run: () => void;
}

export function useShortcuts(list: Shortcut[]): void {
  const ref = useRef(list);
  ref.current = list;
  useEffect(() => {
    let pending = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.key === "Shift" || e.key === "Meta" || e.key === "Control") return;
      const target = e.target as HTMLElement;
      const typing = Boolean(target.closest?.("input, textarea, select, [contenteditable]"));
      const mod = e.metaKey || e.ctrlKey;
      if (typing && !mod) return;
      if (!mod && document.querySelector("[data-modal]") && e.key !== "Escape") return;
      const key = `${mod ? "mod+" : ""}${e.key.toLowerCase()}`;
      const seq = pending ? `${pending} ${key}` : key;
      const hit = ref.current.find((s) => s.keys === seq);
      clearTimeout(timer);
      if (hit) {
        e.preventDefault();
        pending = "";
        hit.run();
        return;
      }
      if (!pending && ref.current.some((s) => s.keys.startsWith(`${key} `))) {
        pending = key;
        timer = setTimeout(() => (pending = ""), 1200);
        return;
      }
      pending = "";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
