import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { AuthService } from "../services/authService.js";
import { getAppConfig } from "../config/env.js";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const profileRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

profileRoutes.use("/me", authenticate());
profileRoutes.use("/me/patch", authenticate());

profileRoutes.get("/me", async (c) => {
  const config = getAppConfig(c.env);
  const userId = c.get("userId") as number;
  const service = new AuthService(
    config.jwt.secret,
    config.jwt.expiresInSeconds,
    config.auth.adminEmails
  );
  const user = await service.getMe(userId);

  const [profile, settings] = await Promise.all([
    prisma.userProfile.findUnique({ where: { user_id: userId } }),
    prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { theme: true, locale: true, units: true },
    }),
  ]);

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
    await prisma.user.update({ where: { id: userId }, data: { username: input.username } });
  }

  if (input.bio !== undefined || input.avatar_url !== undefined) {
    const profileData: { bio?: string; avatar_url?: string | null } = {};
    if (input.bio !== undefined) profileData.bio = input.bio;
    if (input.avatar_url !== undefined) profileData.avatar_url = input.avatar_url || null;

    await prisma.userProfile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...profileData },
      update: profileData,
    });
  }

  const [updatedUser, updatedProfile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } }),
    prisma.userProfile.findUnique({ where: { user_id: userId } }),
  ]);

  return c.json({ success: true, data: { ...updatedUser, profile: updatedProfile } });
});

// ─── Body Metrics ─────────────────────────────────────────────────────────────
profileRoutes.use("/me/body-metrics", authenticate());

profileRoutes.get("/me/body-metrics", async (c) => {
  const userId = c.get("userId") as number;
  const rows = await prisma.bodyMetric.findMany({
    where: { user_id: userId },
    orderBy: { measured_at: "desc" },
    take: 100,
  });
  return c.json({ success: true, data: rows });
});

profileRoutes.post("/me/body-metrics", async (c) => {
  const userId = c.get("userId") as number;
  const body = await c.req.json() as { weight_kg?: number; height_cm?: number };
  if (!body.weight_kg && !body.height_cm) return c.json({ success: false, error: "Нужен хотя бы один параметр" }, 400);

  const result = await prisma.bodyMetric.create({
    data: { user_id: userId, weight_kg: body.weight_kg ?? null, height_cm: body.height_cm ?? null },
  });

  // обновляем профиль последними значениями
  await prisma.userProfile.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      weight_kg: body.weight_kg ?? null,
      height_cm: body.height_cm ?? null,
    },
    update: {
      ...(body.weight_kg !== undefined && { weight_kg: body.weight_kg }),
      ...(body.height_cm !== undefined && { height_cm: body.height_cm }),
    },
  });

  return c.json({ success: true, data: result }, 201);
});

