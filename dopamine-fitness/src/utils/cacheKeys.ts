import type { Env } from "../types/index.js";

export type StatsPeriod = "week" | "month" | "3months" | "year";

const STATS_PERIODS: StatsPeriod[] = ["week", "month", "3months", "year"];

export function statsCacheKey(userId: number, period: StatsPeriod) {
  return `stats:${userId}:${period}`;
}

export function checkinsCacheKey(userId: number) {
  return `checkins:${userId}`;
}

async function deleteByPrefix(env: Env, prefix: string) {
  let cursor: string | undefined;

  do {
    const page = await env.KV.list({ prefix, cursor });
    if (page.keys.length > 0) {
      await Promise.all(page.keys.map((item) => env.KV.delete(item.name)));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export async function invalidateStatsCache(env: Env, userId: number) {
  await Promise.all([
    ...STATS_PERIODS.map((period) => env.KV.delete(statsCacheKey(userId, period))),
    env.KV.delete(`stats:summary:${userId}`),
    deleteByPrefix(env, `stats:exercise:${userId}:`),
  ]);
}
