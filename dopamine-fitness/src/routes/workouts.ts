import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { WorkoutService } from "../services/workoutService.js";
import { validate } from "../validators/validate.js";
import {
  workoutSchema,
  workoutPatchSchema,
  workoutExerciseSchema,
  setSchema,
} from "../validators/schemas.js";
import { parsePagination } from "../utils/helpers.js";
import { invalidateStatsCache } from "../utils/cacheKeys.js";

export const workoutRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

workoutRoutes.use("*", authenticate());

workoutRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const { page, limit } = parsePagination(new URL(c.req.url));
  const service = new WorkoutService(c.env.DB);
  const result = await service.list(userId, page, limit);
  return c.json({ success: true, data: result });
});

workoutRoutes.post("/", async (c) => {
  const userId = c.get("userId") as number;
  const input = validate(workoutSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const workout = await service.create(userId, input);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: workout }, 201);
});

workoutRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  const service = new WorkoutService(c.env.DB);
  const workout = await service.get(id, userId);
  const exercises = await service.getExercises(id, userId);
  return c.json({ success: true, data: { ...workout, exercises } });
});

// Дублировать тренировку на новую дату (по умолчанию сегодня)
workoutRoutes.post("/:id/duplicate", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json().catch(() => ({})) as {
    workout_date?: string;
    name?: string;
  };

  const date = body.workout_date ?? new Date().toISOString().slice(0, 10);
  const service = new WorkoutService(c.env.DB);
  const duplicated = await service.duplicateWorkout(id, userId, date, body.name);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: duplicated }, 201);
});

workoutRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);
  const input = validate(workoutPatchSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const workout = await service.update(id, userId, input);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: workout });
});

workoutRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);
  const service = new WorkoutService(c.env.DB);
  await service.delete(id, userId);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, message: "���������� �������" });
});

workoutRoutes.post("/:id/exercises", async (c) => {
  const userId = c.get("userId") as number;
  const workoutId = parseInt(c.req.param("id"), 10);
  const input = validate(workoutExerciseSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const we = await service.addExercise(workoutId, userId, input);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: we }, 201);
});

workoutRoutes.post("/exercises/:weId/sets", async (c) => {
  const userId = c.get("userId") as number;
  const weId = parseInt(c.req.param("weId"), 10);
  const input = validate(setSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const set = await service.addSet(weId, userId, input);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: set }, 201);
});

workoutRoutes.patch("/exercises/:weId/sets/:setId", async (c) => {
  const userId = c.get("userId") as number;
  const setId = parseInt(c.req.param("setId"), 10);
  const input = validate(setSchema.partial(), await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const set = await service.updateSet(setId, userId, input);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, data: set });
});

workoutRoutes.delete("/exercises/:weId/sets/:setId", async (c) => {
  const userId = c.get("userId") as number;
  const setId = parseInt(c.req.param("setId"), 10);
  const service = new WorkoutService(c.env.DB);
  await service.deleteSet(setId, userId);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, message: "������ �����" });
});

workoutRoutes.delete("/exercises/:weId", async (c) => {
  const userId = c.get("userId") as number;
  const weId = parseInt(c.req.param("weId"), 10);
  const service = new WorkoutService(c.env.DB);
  await service.removeExercise(weId, userId);
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true, message: "���������� �������" });
});

// Завершить тренировку
workoutRoutes.post("/:id/complete", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json().catch(() => ({})) as { duration_minutes?: number };
  await c.env.DB
    .prepare("UPDATE workouts SET completed_at = datetime('now'), duration_minutes = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL")
    .bind(body.duration_minutes ?? null, id, userId)
    .run();
  await invalidateStatsCache(c.env, userId);
  return c.json({ success: true });
});
