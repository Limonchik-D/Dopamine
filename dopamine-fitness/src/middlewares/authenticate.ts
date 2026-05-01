import { createMiddleware } from "hono/factory";
import type { Env, HonoVariables, JwtPayload } from "../types/index.js";
import { verifyJwt } from "../utils/jwt.js";
import { getAppConfig } from "../config/env.js";
import { isTokenRevoked } from "../utils/tokenBlocklist.js";
import { ErrorCodes } from "../utils/errorCodes.js";

export function authenticate() {
  return createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(async (c, next) => {
    const config = getAppConfig(c.env);
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return c.json({ success: false, error: "Unauthorized", code: ErrorCodes.Unauthorized, requestId: c.get("requestId") }, 401);
    }

    let payload: JwtPayload;
    try {
      payload = await verifyJwt(token, config.jwt.secret);
    } catch {
      return c.json({ success: false, error: "Invalid or expired token", code: ErrorCodes.InvalidToken, requestId: c.get("requestId") }, 401);
    }

    if (await isTokenRevoked(c.env, token)) {
      return c.json({ success: false, error: "Token has been revoked", code: ErrorCodes.TokenRevoked, requestId: c.get("requestId") }, 401);
    }

    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
    c.set("userRole", payload.role ?? "user");
    await next();
    return;
  });
}
