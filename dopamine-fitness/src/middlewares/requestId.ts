import { createMiddleware } from "hono/factory";
import type { HonoVariables } from "../types/index.js";

export function requestId() {
  return createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
    const id =
      c.req.header("cf-ray") ??
      crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
    return;
  });
}
