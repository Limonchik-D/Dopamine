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
  const userId = c.get("userId");
  const input = validate(workoutSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const workout = await service.create(userId, input);
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

workoutRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  const input = validate(workoutPatchSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const workout = await service.update(id, userId, input);
  return c.json({ success: true, data: workout });
});

workoutRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  const service = new WorkoutService(c.env.DB);
  await service.delete(id, userId);
  return c.json({ success: true, message: "Тренировка удалена" });
});

workoutRoutes.post("/:id/exercises", async (c) => {
  const userId = c.get("userId");
  const workoutId = parseInt(c.req.param("id"), 10);
  const input = validate(workoutExerciseSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const we = await service.addExercise(workoutId, userId, input);
  return c.json({ success: true, data: we }, 201);
});

workoutRoutes.post("/exercises/:weId/sets", async (c) => {
  const userId = c.get("userId");
  const weId = parseInt(c.req.param("weId"), 10);
  const input = validate(setSchema, await c.req.json());
  const service = new WorkoutService(c.env.DB);
  const set = await service.addSet(weId, userId, input);
  return c.json({ success: true, data: set }, 201);
});
