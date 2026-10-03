const STORAGE_KEY = "mesh.key";

type Listener = () => void;

const listeners = new Set<Listener>();

export function getKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    return;
  }
}

export function clearKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUnauthorized(): void {
  for (const listener of [...listeners]) listener();
}
