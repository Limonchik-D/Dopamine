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

// ─── Body Metrics ─────────────────────────────────────────────────────────────
profileRoutes.use("/me/body-metrics", authenticate());

profileRoutes.get("/me/body-metrics", async (c) => {
  const userId = c.get("userId") as number;
  const rows = await c.env.DB
    .prepare("SELECT * FROM body_metrics WHERE user_id = ?1 ORDER BY measured_at DESC LIMIT 100")
    .bind(userId).all<{ id: number; weight_kg: number | null; height_cm: number | null; measured_at: string }>();
  return c.json({ success: true, data: rows.results });
});

profileRoutes.post("/me/body-metrics", async (c) => {
  const userId = c.get("userId") as number;
  const body = await c.req.json() as { weight_kg?: number; height_cm?: number };
  if (!body.weight_kg && !body.height_cm) return c.json({ success: false, error: "Нужен хотя бы один параметр" }, 400);
  const result = await c.env.DB
    .prepare("INSERT INTO body_metrics (user_id, weight_kg, height_cm) VALUES (?1, ?2, ?3) RETURNING *")
    .bind(userId, body.weight_kg ?? null, body.height_cm ?? null)
    .first<{ id: number; weight_kg: number | null; height_cm: number | null; measured_at: string }>();
  // обновляем профиль последними значениями
  await c.env.DB
    .prepare(`INSERT INTO user_profiles (user_id, weight_kg, height_cm) VALUES (?1, ?2, ?3)
      ON CONFLICT(user_id) DO UPDATE SET
        weight_kg = COALESCE(?2, weight_kg),
        height_cm = COALESCE(?3, height_cm)`)
    .bind(userId, body.weight_kg ?? null, body.height_cm ?? null).run();
  return c.json({ success: true, data: result }, 201);
});
