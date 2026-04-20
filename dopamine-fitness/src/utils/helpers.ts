import type { PaginationParams } from "../types/index.js";

export function parsePagination(
  url: URL,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(defaultLimit), 10))
  );
  return { page, limit, offset: (page - 1) * limit };
}

export function ok<T>(data: T, status = 200) {
  return { success: true as const, data, status };
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);
}

export function calcOneRM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  // Epley formula
  return Math.round(weight * (1 + reps / 30));
}

export function calcVolume(weight: number, reps: number): number {
  return weight * reps;
}

export function dateRangeForPeriod(
  period: "week" | "month" | "3months" | "year"
): { from: string; to: string } {
  const to = new Date();
  const from = new Date();

  switch (period) {
    case "week":
      from.setDate(from.getDate() - 7);
      break;
    case "month":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3months":
      from.setMonth(from.getMonth() - 3);
      break;
    case "year":
      from.setFullYear(from.getFullYear() - 1);
      break;
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}
