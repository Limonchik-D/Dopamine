import { Hono } from "hono";
import type { Env, HonoVariables, UserProfile } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { AuthService } from "../services/authService.js";
import { getAppConfig } from "../config/env.js";

export const profileRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

profileRoutes.use("/me", authenticate());

profileRoutes.get("/me", async (c) => {
  const config = getAppConfig(c.env);
  const userId = c.get("userId") as number;
  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds,
    config.auth.adminEmails
  );
  const user = await service.getMe(userId);

  const profile = await c.env.DB
    .prepare("SELECT * FROM user_profiles WHERE user_id = ?1")
    .bind(userId)
    .first<UserProfile>();

  const settings = await c.env.DB
    .prepare("SELECT theme, locale, units FROM user_settings WHERE user_id = ?1")
    .bind(userId)
    .first<Pick<UserProfile, "theme" | "locale" | "units">>();

  return c.json({
    success: true,
    data: { ...user, profile, settings },
  });
});


