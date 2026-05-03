import type { Env } from "../types/index.js";
import { prisma } from "../db/prisma.js";

export type DependenciesHealth = {
  db: boolean;
  kv: boolean;
  ready: boolean;
};

export async function getDependenciesHealth(env: Env): Promise<DependenciesHealth> {
  let db = false;
  let kv = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  try {
    await env.KV.get("health:ping");
    kv = true;
  } catch {
    kv = false;
  }

  return {
    db,
    kv,
    ready: db && kv,
  };
}
