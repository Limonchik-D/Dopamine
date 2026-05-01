import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { StatsService } from "../services/statsService.js";
import { getAppConfig } from "../config/env.js";
import { statsCacheKey } from "../utils/cacheKeys.js";

export const statsRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

statsRoutes.use("*", authenticate());

type StatsPeriod = "week" | "month" | "3months" | "year";
type AppContext = Context<{ Bindings: Env; Variables: HonoVariables }>;

async function handleStatsPeriod(c: AppContext, period: StatsPeriod) {
  const userId = c.get("userId") as number;
  const cacheKey = statsCacheKey(userId, period);
  const config = getAppConfig(c.env);

  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) {
    c.header("Cache-Control", "private, max-age=30");
    c.header("X-Cache", "HIT");
    return c.json({ success: true, data: cached });
  }

  const service = new StatsService(c.env.DB);
  const data = await service.getStats(userId, period);

  await c.env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: config.cache.statsTtlSeconds,
  });

  c.header("Cache-Control", "private, max-age=30");
  c.header("X-Cache", "MISS");
  return c.json({ success: true, data });
}

statsRoutes.get("/week", async (c) => {
  return handleStatsPeriod(c, "week");
});

statsRoutes.get("/month", async (c) => {
  return handleStatsPeriod(c, "month");
});

statsRoutes.get("/3months", async (c) => {
  return handleStatsPeriod(c, "3months");
});

statsRoutes.get("/year", async (c) => {
  return handleStatsPeriod(c, "year");
});

// GET /stats/exercise/:id?period=week|month|3months|year
statsRoutes.get("/exercise/:id", async (c) => {
  const userId = c.get("userId") as number;
  const exerciseId = parseInt(c.req.param("id"), 10);
  const period = (c.req.query("period") ?? "month") as StatsPeriod;
  const config = getAppConfig(c.env);

  const cacheKey = `stats:exercise:${userId}:${exerciseId}:${period}`;
  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) {
    c.header("X-Cache", "HIT");
    return c.json({ success: true, data: cached });
  }

  const service = new StatsService(c.env.DB);
  const data = await service.getExerciseProgress(userId, exerciseId, period);

  await c.env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: config.cache.statsTtlSeconds,
  });

  c.header("X-Cache", "MISS");
  return c.json({ success: true, data });
});

// GET /stats/summary — общая сводка (кол-во тренировок, суммарный объём, рекорд)
statsRoutes.get("/summary", async (c) => {
  const userId = c.get("userId") as number;
  const cacheKey = `stats:summary:${userId}`;
  const cached = await c.env.KV.get(cacheKey, "json");
  if (cached) return c.json({ success: true, data: cached });

  const service = new StatsService(c.env.DB);
  const data = await service.getSummary(userId);

  await c.env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
  return c.json({ success: true, data });
});
