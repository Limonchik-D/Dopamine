import { Hono } from "hono";
import type { Env, HonoVariables, UserProfile } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { AuthService } from "../services/authService.js";
import { getAppConfig } from "../config/env.js";
import { z } from "zod";

export const profileRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

profileRoutes.use("/me", authenticate());
profileRoutes.use("/me/patch", authenticate());

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

const patchMeSchema = z.object({
  username: z.string().min(2).max(40).optional(),
  bio: z.string().max(300).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

profileRoutes.patch("/me", async (c) => {
  const userId = c.get("userId") as number;
  const body = await c.req.json();
  const input = patchMeSchema.parse(body);

  if (input.username !== undefined) {
    await c.env.DB
      .prepare("UPDATE users SET username = ?1 WHERE id = ?2")
      .bind(input.username, userId)
      .run();
  }

  if (input.bio !== undefined || input.avatar_url !== undefined) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.bio !== undefined) { sets.push(`bio = ?${i++}`); vals.push(input.bio); }
    if (input.avatar_url !== undefined) { sets.push(`avatar_url = ?${i++}`); vals.push(input.avatar_url || null); }
    if (sets.length > 0) {
      vals.push(userId);
      await c.env.DB
        .prepare(
          `INSERT INTO user_profiles (user_id) VALUES (?${i}) ON CONFLICT(user_id) DO UPDATE SET ${sets.join(", ")}`
        )
        .bind(...vals)
        .run();
    }
  }

  const updatedUser = await c.env.DB
    .prepare("SELECT id, email, username FROM users WHERE id = ?1")
    .bind(userId)
    .first<{ id: number; email: string; username: string }>();

  const updatedProfile = await c.env.DB
    .prepare("SELECT * FROM user_profiles WHERE user_id = ?1")
    .bind(userId)
    .first<UserProfile>();

  return c.json({ success: true, data: { ...updatedUser, profile: updatedProfile } });
});


