import { useCallback, useEffect, useRef, useState } from "react";

export interface Loadable<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

export function useLoad<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number): Loadable<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setData(undefined);
    setLoading(true);
  }, deps);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (document.hidden) return;
      loadRef
        .current()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setError(undefined);
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false));
    };
    run();
    const timer = pollMs ? setInterval(run, pollMs) : undefined;
    const onVisible = () => !document.hidden && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [...deps, tick, pollMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useHashRoute(): [string, (route: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, "") || "feed";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return [route, (next) => (window.location.hash = `/${next}`)];
}

export function useStored(key: string, initial: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (next: string) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      return;
    }
  };
  return [value, set];
}
