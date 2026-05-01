import { createMiddleware } from "hono/factory";
import type { Env, HonoVariables, UserRole } from "../types/index.js";
import { ErrorCodes } from "../utils/errorCodes.js";

export function requireRole(role: UserRole) {
  return createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(async (c, next) => {
    const userRole = c.get("userRole") as UserRole | undefined;

    if (userRole !== role) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          code: ErrorCodes.Forbidden,
          requestId: c.get("requestId"),
        },
        403
      );
    }

    await next();
    return;
  });
}
