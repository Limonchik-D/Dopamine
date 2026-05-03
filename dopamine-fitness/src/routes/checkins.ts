import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../validators/validate.js";
import { checkinSchema } from "../validators/schemas.js";
import { getAppConfig } from "../config/env.js";
import { checkinsCacheKey } from "../utils/cacheKeys.js";
import { prisma } from "../db/prisma.js";

export const checkinRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

checkinRoutes.use("*", authenticate());

function formatDateKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

checkinRoutes.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const config = getAppConfig(c.env);
  const cacheKey = checkinsCacheKey(userId);

  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) {
    c.header("Cache-Control", "private, max-age=30");
    c.header("X-Cache", "HIT");
    return c.json({ success: true, data: cached });
  }

  const rows = await prisma.dailyCheckin.findMany({
    where: { user_id: userId },
    orderBy: { checkin_date: "asc" },
  });

  const data = {
    checkins: rows,
    total: rows.length,
  };

  await c.env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: config.cache.checkinsTtlSeconds,
  });

  c.header("Cache-Control", "private, max-age=30");
  c.header("X-Cache", "MISS");

  return c.json({
    success: true,
    data,
  });
});

checkinRoutes.post("/", async (c) => {
  const userId = c.get("userId") as number;
  const payload = validate(checkinSchema, await c.req.json().catch(() => ({})));

  const today = new Date();
  const fallbackDate = formatDateKeyUtc(today);
  const checkinDate = payload.date ?? fallbackDate;

  await prisma.dailyCheckin.upsert({
    where: { user_id_checkin_date: { user_id: userId, checkin_date: checkinDate } },
    create: { user_id: userId, checkin_date: checkinDate },
    update: {},
  });

  await c.env.KV.delete(checkinsCacheKey(userId));

  const checkin = await prisma.dailyCheckin.findUnique({
    where: { user_id_checkin_date: { user_id: userId, checkin_date: checkinDate } },
  });

  return c.json({
    success: true,
    data: checkin,
  });
});
