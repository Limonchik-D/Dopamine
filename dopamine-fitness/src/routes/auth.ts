import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { AuthService } from "../services/authService.js";
import { validate } from "../validators/validate.js";
import { registerSchema, loginSchema } from "../validators/schemas.js";
import { getAppConfig } from "../config/env.js";
import { authRateLimiter } from "../middlewares/rateLimiter.js";
import { authenticate } from "../middlewares/authenticate.js";
import { revokeToken } from "../utils/tokenBlocklist.js";
import { verifyJwt } from "../utils/jwt.js";

export const authRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

authRoutes.use("/register", authRateLimiter());
authRoutes.use("/login", authRateLimiter());

authRoutes.post("/register", async (c) => {
  const config = getAppConfig(c.env);
  const body = await c.req.json();
  const input = validate(registerSchema, body);

  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds
  );
  const { user, token } = await service.register(input);

  return c.json({ success: true, data: { user, token } }, 201);
});

authRoutes.post("/login", async (c) => {
  const config = getAppConfig(c.env);
  const body = await c.req.json();
  const input = validate(loginSchema, body);

  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds
  );
  const { user, token } = await service.login(input);

  return c.json({ success: true, data: { user, token } });
});

authRoutes.post("/logout", authenticate(), async (c) => {
  const config = getAppConfig(c.env);
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    try {
      const payload = await verifyJwt(token, config.jwt.secret);
      await revokeToken(c.env, token, payload.exp);
    } catch {
      // Ignore invalid token on logout to keep endpoint idempotent for client.
    }
  }

  return c.json({ success: true, message: "Выход выполнен" });
});
