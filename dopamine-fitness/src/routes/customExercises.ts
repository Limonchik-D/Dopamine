import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../validators/validate.js";
import { customExerciseSchema } from "../validators/schemas.js";
import { prisma } from "../db/prisma.js";

export const customExerciseRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

customExerciseRoutes.use("*", authenticate());

// GET /custom-exercises
customExerciseRoutes.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const rows = await prisma.customExercise.findMany({
    where: { user_id: userId, deleted_at: null },
    orderBy: { created_at: "desc" },
  });
  return c.json({ success: true, data: rows });
});

// POST /custom-exercises
customExerciseRoutes.post("/", async (c) => {
  const userId = c.get("userId") as number;
  const input = validate(customExerciseSchema, await c.req.json());

  const row = await prisma.customExercise.create({
    data: {
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      target: input.target ?? null,
      equipment: input.equipment ?? null,
    },
  });
  return c.json({ success: true, data: row }, 201);
});

// PATCH /custom-exercises/:id
customExerciseRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);
  const input = validate(customExerciseSchema.partial(), await c.req.json());

  const existing = await prisma.customExercise.findFirst({
    where: { id, user_id: userId, deleted_at: null },
  });
  if (!existing) throw new Error("Not found");

  const data: { name?: string; description?: string | null; target?: string | null; equipment?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.target !== undefined) data.target = input.target ?? null;
  if (input.equipment !== undefined) data.equipment = input.equipment ?? null;

  if (Object.keys(data).length === 0) return c.json({ success: true, data: existing });

  const updated = await prisma.customExercise.update({ where: { id }, data });
  return c.json({ success: true, data: updated });
});

// DELETE /custom-exercises/:id
customExerciseRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"), 10);

  const result = await prisma.customExercise.updateMany({
    where: { id, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date() },
  });

  if (result.count === 0) throw new Error("Not found");
  return c.json({ success: true, message: "Упражнение удалено" });
});


