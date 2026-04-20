import { createMiddleware } from "hono/factory";
import type { Env, HonoVariables } from "../types/index.js";
import { ErrorCodes } from "../utils/errorCodes.js";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  errorMessage: string;
  errorCode: string;
};

const API_DEFAULTS: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "rl:api",
  errorMessage: "Too many requests. Try again later.",
  errorCode: ErrorCodes.RateLimited,
};

const AUTH_DEFAULTS: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: "rl:auth",
  errorMessage: "Too many auth attempts. Try again in a minute.",
  errorCode: ErrorCodes.AuthRateLimited,
};

function createRateLimiter(options: RateLimitOptions) {
  return createMiddleware<{ Bindings: Env; Variables: HonoVariables }>(async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for") ??
      "unknown";

    const windowSlot = Math.floor(Date.now() / options.windowMs);
    const key = `${options.keyPrefix}:${ip}:${windowSlot}`;

    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= options.maxRequests) {
      return c.json(
        {
          success: false,
          error: options.errorMessage,
          code: options.errorCode,
          requestId: c.get("requestId"),
        },
        429
      );
    }

    await c.env.KV.put(key, String(count + 1), {
      expirationTtl: Math.ceil(options.windowMs / 1000) + 5,
    });

    c.header("X-RateLimit-Limit", String(options.maxRequests));
    c.header("X-RateLimit-Remaining", String(options.maxRequests - count - 1));

    await next();
    return;
  });
}

export function rateLimiter() {
  return createRateLimiter(API_DEFAULTS);
}

export function authRateLimiter() {
  return createRateLimiter(AUTH_DEFAULTS);
}
