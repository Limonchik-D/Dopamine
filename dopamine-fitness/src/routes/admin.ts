import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

adminRoutes.use("*", authenticate(), requireRole("admin"));

adminRoutes.get("/overview", async (c) => {
  const users = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  const workouts = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM workouts WHERE deleted_at IS NULL").first<{ count: number }>();
  const customExercises = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM custom_exercises WHERE deleted_at IS NULL").first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      users: users?.count ?? 0,
      workouts: workouts?.count ?? 0,
      customExercises: customExercises?.count ?? 0,
    },
  });
});

adminRoutes.get("/users", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT id, email, username, role, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all();

  return c.json({
    success: true,
    data: {
      users: rows.results,
      total: rows.results.length,
    },
  });
});
