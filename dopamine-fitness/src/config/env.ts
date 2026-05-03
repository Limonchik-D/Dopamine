import type { Env } from "../types/index.js";

export interface AppConfig {
  environment: Env["ENVIRONMENT"];
  appName: string;
  jwt: {
    secret: string;
    expiresInSeconds: number;
  };
  exercise: {
    cacheTtlSeconds: number;
    exerciseDbBaseUrl: string;
    exerciseDbApiKey: string;
    wgerBaseUrl: string;
  };
  cache: {
    statsTtlSeconds: number;
    checkinsTtlSeconds: number;
  };
  uploads: {
    maxSizeMb: number;
  };
  cors: {
    allowedOrigins: string[];
  };
  auth: {
    adminEmails: string[];
    google?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read a key from the Hono/CF env object OR from process.env as fallback.
 * Safe in both Cloudflare Workers (no process) and Node.js environments.
 */
function envVar(envObj: Partial<Env> | undefined, key: string): string | undefined {
  const fromObj = (envObj as Record<string, unknown> | undefined)?.[key];
  if (typeof fromObj === "string" && fromObj.trim()) return fromObj.trim();

  // Fallback: process.env (Node.js only — not available in CF Workers)
  try {
    const fromProcess = (globalThis as unknown as { process?: { env: Record<string, string> } })
      .process?.env?.[key];
    if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();
  } catch {
    // CF Workers — process is not defined, ignore
  }
  return undefined;
}

function requireString(envObj: Partial<Env> | undefined, key: string): string {
  const value = envVar(envObj, key);
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
}

function requirePositiveInt(envObj: Partial<Env> | undefined, key: string): number {
  const parsed = Number.parseInt(requireString(envObj, key), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`Invalid env variable ${key}. Expected positive integer.`);
  return parsed;
}

function parseOptionalPositiveInt(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseCsv(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ─── Cached config ────────────────────────────────────────────────────────────

let cachedConfig: AppConfig | null = null;
let cachedFingerprint: string | null = null;

export function getAppConfig(env?: Partial<Env>): AppConfig {
  const fingerprint = JSON.stringify({
    env: env?.ENVIRONMENT,
    app: env?.APP_NAME,
    origins: env?.APP_ALLOWED_ORIGINS,
  });

  if (cachedConfig && cachedFingerprint === fingerprint) return cachedConfig;

  const e = env;
  cachedConfig = {
    environment: (envVar(e, "ENVIRONMENT") ?? "development") as Env["ENVIRONMENT"],
    appName: requireString(e, "APP_NAME"),
    jwt: {
      secret: requireString(e, "JWT_SECRET"),
      expiresInSeconds: requirePositiveInt(e, "JWT_EXPIRES_IN"),
    },
    exercise: {
      cacheTtlSeconds: requirePositiveInt(e, "EXERCISE_CACHE_TTL"),
      exerciseDbBaseUrl: requireString(e, "EXERCISEDB_BASE_URL"),
      exerciseDbApiKey: envVar(e, "EXERCISEDB_API_KEY") ?? "",
      wgerBaseUrl: requireString(e, "WGER_BASE_URL"),
    },
    cache: {
      statsTtlSeconds: parseOptionalPositiveInt(envVar(e, "STATS_CACHE_TTL"), 120),
      checkinsTtlSeconds: parseOptionalPositiveInt(envVar(e, "CHECKINS_CACHE_TTL"), 60),
    },
    uploads: {
      maxSizeMb: requirePositiveInt(e, "MAX_UPLOAD_SIZE_MB"),
    },
    cors: {
      allowedOrigins: parseCsv(envVar(e, "APP_ALLOWED_ORIGINS")),
    },
    auth: {
      adminEmails: parseCsv(envVar(e, "ADMIN_EMAILS")).map((email) => email.toLowerCase()),
      google:
        envVar(e, "GOOGLE_CLIENT_ID") &&
        envVar(e, "GOOGLE_CLIENT_SECRET") &&
        envVar(e, "GOOGLE_REDIRECT_URI")
          ? {
              clientId: requireString(e, "GOOGLE_CLIENT_ID"),
              clientSecret: requireString(e, "GOOGLE_CLIENT_SECRET"),
              redirectUri: requireString(e, "GOOGLE_REDIRECT_URI"),
            }
          : undefined,
    },
  };

  cachedFingerprint = fingerprint;
  return cachedConfig;
}
