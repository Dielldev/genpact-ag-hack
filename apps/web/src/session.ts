import type { MeResponse } from "@mesh/server/api";
import { useCallback, useEffect, useState } from "react";
import { api, clearKey, onUnauthorized } from "./api";
import { useLoad } from "./hooks";

export interface Session {
  me: MeResponse | null;
  loading: boolean;
  locked: boolean;
  signOut: () => void;
}

export function useSession(): Session {
  const me = useLoad(() => api.me(), [], 30_000);
  const [locked, setLocked] = useState(false);

  useEffect(() => onUnauthorized(() => setLocked(true)), []);

  const signOut = useCallback(() => {
    clearKey();
    setLocked(true);
  }, []);

  return { me: me.data ?? null, loading: me.loading && !me.data && !me.error, locked, signOut };
}
