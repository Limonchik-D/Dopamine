import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../validators/validate.js";
import { checkinSchema } from "../validators/schemas.js";
import { getAppConfig } from "../config/env.js";

export const checkinRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

checkinRoutes.use("*", authenticate());

function formatDateKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

checkinRoutes.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const config = getAppConfig(c.env);
  const cacheKey = `checkins:${userId}`;

  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) {
    c.header("Cache-Control", "private, max-age=30");
    c.header("X-Cache", "HIT");
    return c.json({ success: true, data: cached });
  }

  const rows = await c.env.DB
    .prepare(
      `SELECT id, user_id, checkin_date, created_at
       FROM daily_checkins
       WHERE user_id = ?1
       ORDER BY checkin_date ASC`
    )
    .bind(userId)
    .all();

  const data = {
    checkins: rows.results,
    total: rows.results.length,
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

  await c.env.DB
    .prepare(
      `INSERT OR IGNORE INTO daily_checkins (user_id, checkin_date)
       VALUES (?1, ?2)`
    )
    .bind(userId, checkinDate)
    .run();

  await c.env.KV.delete(`checkins:${userId}`);

  const checkin = await c.env.DB
    .prepare(
      `SELECT id, user_id, checkin_date, created_at
       FROM daily_checkins
       WHERE user_id = ?1 AND checkin_date = ?2`
    )
    .bind(userId, checkinDate)
    .first();

  return c.json({
    success: true,
    data: checkin,
  });
});
