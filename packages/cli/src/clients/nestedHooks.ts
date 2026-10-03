import { isMeshCommand } from "../config/paths.js";
import { asArray, asObject, type JsonObject } from "../util/jsonFile.js";

export function upsertNestedHook(settings: JsonObject, event: string, handler: JsonObject): JsonObject {
  const hooks = asObject(settings.hooks);
  const groups = withoutMesh(asArray(hooks[event]));
  groups.push({ hooks: [handler] });
  return { ...settings, hooks: { ...hooks, [event]: groups } };
}

export function removeNestedHook(settings: JsonObject, event: string): JsonObject {
  const hooks = { ...asObject(settings.hooks) };
  const groups = withoutMesh(asArray(hooks[event]));
  if (groups.length > 0) {
    hooks[event] = groups;
  } else {
    delete hooks[event];
  }
  const next: JsonObject = { ...settings, hooks };
  if (Object.keys(hooks).length === 0) delete next.hooks;
  return next;
}

export function hasNestedHook(settings: JsonObject, event: string): boolean {
  return asArray(asObject(settings.hooks)[event]).some((group) =>
    asArray(asObject(group).hooks).some((handler) => isMeshCommand(asObject(handler).command)),
  );
}

function withoutMesh(groups: unknown[]): unknown[] {
  return groups.flatMap((group) => {
    const entry = asObject(group);
    const handlers = asArray(entry.hooks);
    const kept = handlers.filter((handler) => !isMeshCommand(asObject(handler).command));
    if (kept.length === handlers.length) return [group];
    return kept.length > 0 ? [{ ...entry, hooks: kept }] : [];
  });
}
