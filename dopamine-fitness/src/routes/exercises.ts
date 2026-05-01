import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { ExerciseService } from "../services/exerciseService.js";
import { validate } from "../validators/validate.js";
import { exerciseFilterSchema } from "../validators/schemas.js";

export const exerciseRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

exerciseRoutes.use("*", authenticate());

// GET /exercises?search=&target=&equipment=&body_part=&page=&limit=
exerciseRoutes.get("/", async (c) => {
  const url = new URL(c.req.url);
  const filters = validate(exerciseFilterSchema, Object.fromEntries(url.searchParams));

  const service = new ExerciseService(c.env);
  const result = await service.list(filters);
  return c.json({ success: true, data: result });
});

// GET /exercises/filters — list all available filter options
exerciseRoutes.get("/filters", async (c) => {
  const service = new ExerciseService(c.env);
  const filters = await service.getFilters();
  return c.json({ success: true, data: filters });
});

// GET /exercises/sync — admin: trigger sync from ExerciseDB/wger
exerciseRoutes.post("/sync", requireRole("admin"), async (c) => {
  const service = new ExerciseService(c.env);
  const result = await service.syncFromExternalAPIs();
  return c.json({ success: true, data: result });
});

// GET /exercises/:id
exerciseRoutes.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const service = new ExerciseService(c.env);
  const exercise = await service.getById(id);
  return c.json({ success: true, data: exercise });
});
