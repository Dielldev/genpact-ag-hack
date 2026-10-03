import type { Context } from "hono";

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "bad_json", "Request body must be valid JSON");
  }
}
