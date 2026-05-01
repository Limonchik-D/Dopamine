import type { Env } from "../types/index.js";

export type DependenciesHealth = {
  db: boolean;
  kv: boolean;
  ready: boolean;
};

export async function getDependenciesHealth(env: Env): Promise<DependenciesHealth> {
  let db = false;
  let kv = false;

  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    db = row?.ok === 1;
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
