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

function parseOptionalPositiveInt(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resetIfOriginMismatch(env: Env) {
  const expectedFingerprint = `${env.ENVIRONMENT}|${env.APP_NAME}|${env.APP_ALLOWED_ORIGINS}|${env.GOOGLE_CLIENT_ID ?? ""}|${env.GOOGLE_REDIRECT_URI ?? ""}|${env.ADMIN_EMAILS ?? ""}`;
  const marker = (globalThis as unknown as { __df_cfg_marker?: string }).__df_cfg_marker;
  if (marker && marker !== expectedFingerprint) {
    cachedConfig = null;
  }
  (globalThis as unknown as { __df_cfg_marker?: string }).__df_cfg_marker = expectedFingerprint;
}

let cachedConfig: AppConfig | null = null;

function requireString(name: keyof Env, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required env variable: ${String(name)}`);
  }
  return normalized;
}

function parseCsv(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requirePositiveInt(name: keyof Env, value: string | undefined): number {
  const parsed = Number.parseInt(requireString(name, value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid env variable ${String(name)}. Expected positive integer.`);
  }
  return parsed;
}

export function getAppConfig(env: Env): AppConfig {
  resetIfOriginMismatch(env);
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    environment: env.ENVIRONMENT,
    appName: requireString("APP_NAME", env.APP_NAME),
    jwt: {
      secret: requireString("JWT_SECRET", env.JWT_SECRET),
      expiresInSeconds: requirePositiveInt("JWT_EXPIRES_IN", env.JWT_EXPIRES_IN),
    },
    exercise: {
      cacheTtlSeconds: requirePositiveInt("EXERCISE_CACHE_TTL", env.EXERCISE_CACHE_TTL),
      exerciseDbBaseUrl: requireString("EXERCISEDB_BASE_URL", env.EXERCISEDB_BASE_URL),
      exerciseDbApiKey: env.EXERCISEDB_API_KEY?.trim() ?? "",
      wgerBaseUrl: requireString("WGER_BASE_URL", env.WGER_BASE_URL),
    },
    cache: {
      statsTtlSeconds: parseOptionalPositiveInt(env.STATS_CACHE_TTL, 120),
      checkinsTtlSeconds: parseOptionalPositiveInt(env.CHECKINS_CACHE_TTL, 60),
    },
    uploads: {
      maxSizeMb: requirePositiveInt("MAX_UPLOAD_SIZE_MB", env.MAX_UPLOAD_SIZE_MB),
    },
    cors: {
      allowedOrigins: parseCsv(env.APP_ALLOWED_ORIGINS),
    },
    auth: {
      adminEmails: parseCsv(env.ADMIN_EMAILS).map((email) => email.toLowerCase()),
      google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
        ? {
            clientId: requireString("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID),
            clientSecret: requireString("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET),
            redirectUri: requireString("GOOGLE_REDIRECT_URI", env.GOOGLE_REDIRECT_URI),
          }
        : undefined,
    },
  };

  return cachedConfig;
}
