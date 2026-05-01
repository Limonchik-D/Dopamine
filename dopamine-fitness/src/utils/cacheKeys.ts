import type { Env } from "../types/index.js";

export type StatsPeriod = "week" | "month" | "3months" | "year";

const STATS_PERIODS: StatsPeriod[] = ["week", "month", "3months", "year"];

export function statsCacheKey(userId: number, period: StatsPeriod) {
  return `stats:${userId}:${period}`;
}

export function checkinsCacheKey(userId: number) {
  return `checkins:${userId}`;
}

export async function invalidateStatsCache(env: Env, userId: number) {
  await Promise.all(STATS_PERIODS.map((period) => env.KV.delete(statsCacheKey(userId, period))));
}
