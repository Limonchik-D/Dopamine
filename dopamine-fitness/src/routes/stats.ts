import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { StatsService } from "../services/statsService.js";
import { getAppConfig } from "../config/env.js";

export const statsRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

statsRoutes.use("*", authenticate());

type StatsPeriod = "week" | "month" | "3months" | "year";
type AppContext = Context<{ Bindings: Env; Variables: HonoVariables }>;

async function handleStatsPeriod(c: AppContext, period: StatsPeriod) {
  const userId = c.get("userId") as number;
  const cacheKey = `stats:${userId}:${period}`;
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
