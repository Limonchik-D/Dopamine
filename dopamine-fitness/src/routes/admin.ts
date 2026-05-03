import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { getDependenciesHealth } from "../utils/health.js";
import { prisma } from "../db/prisma.js";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

adminRoutes.use("*", authenticate(), requireRole("admin"));

adminRoutes.get("/overview", async (c) => {
  const [users, workouts, customExercises] = await Promise.all([
    prisma.user.count(),
    prisma.workout.count({ where: { deleted_at: null } }),
    prisma.customExercise.count({ where: { deleted_at: null } }),
  ]);

  return c.json({
    success: true,
    data: { users, workouts, customExercises },
  });
});

adminRoutes.get("/diagnostics", async (c) => {
  const [health, users, workouts, checkins] = await Promise.all([
    getDependenciesHealth(c.env),
    prisma.user.count(),
    prisma.workout.count({ where: { deleted_at: null } }),
    prisma.dailyCheckin.count(),
  ]);

  return c.json({
    success: true,
    data: {
      ready: health.ready,
      dependencies: {
        db: health.db,
        kv: health.kv,
      },
      counters: { users, workouts, checkins },
      ts: new Date().toISOString(),
    },
  });
});

adminRoutes.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, created_at: true },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  return c.json({
    success: true,
    data: {
      users,
      total: users.length,
    },
  });
});
