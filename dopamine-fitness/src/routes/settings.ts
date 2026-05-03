import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../validators/validate.js";
import { settingsSchema } from "../validators/schemas.js";
import { prisma } from "../db/prisma.js";

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

settingsRoutes.use("*", authenticate());

settingsRoutes.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const settings = await prisma.userSettings.findUnique({ where: { user_id: userId } });
  return c.json({ success: true, data: settings });
});

settingsRoutes.patch("/", async (c) => {
  const userId = c.get("userId") as number;
  const input = validate(settingsSchema, await c.req.json());

  const data: {
    theme?: string;
    locale?: string;
    units?: string;
    notifications_enabled?: boolean;
  } = {};
  if (input.theme !== undefined) data.theme = input.theme;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.units !== undefined) data.units = input.units;
  if (input.notifications_enabled !== undefined) data.notifications_enabled = input.notifications_enabled;

  if (Object.keys(data).length === 0) {
    const settings = await prisma.userSettings.findUnique({ where: { user_id: userId } });
    return c.json({ success: true, data: settings });
  }

  const updated = await prisma.userSettings.update({ where: { user_id: userId }, data });

  // Invalidate KV cache for user settings
  await c.env.KV.delete(`settings:${userId}`);

  return c.json({ success: true, data: updated });
});


