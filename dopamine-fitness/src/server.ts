import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import app from "./index.js";
import { LocalKV } from "./db/localKV.js";
import { LocalR2 } from "./db/localR2.js";
import type { Env } from "./types/index.js";

const kv = new LocalKV();
const r2 = new LocalR2();

const envBindings: Env = {
  KV: kv,
  R2_BUCKET: r2,
  ENVIRONMENT: (process.env.ENVIRONMENT ?? "development") as Env["ENVIRONMENT"],
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "604800",
  EXERCISE_CACHE_TTL: process.env.EXERCISE_CACHE_TTL ?? "3600",
  MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB ?? "5",
  EXERCISEDB_BASE_URL: process.env.EXERCISEDB_BASE_URL ?? "",
  EXERCISEDB_API_KEY: process.env.EXERCISEDB_API_KEY ?? "",
  WGER_BASE_URL: process.env.WGER_BASE_URL ?? "",
  APP_NAME: process.env.APP_NAME ?? "Dopamine Fitness",
  APP_ALLOWED_ORIGINS: process.env.APP_ALLOWED_ORIGINS ?? "",
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  STATS_CACHE_TTL: process.env.STATS_CACHE_TTL,
  CHECKINS_CACHE_TTL: process.env.CHECKINS_CACHE_TTL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  DATABASE_URL: process.env.DATABASE_URL,
};

// Serve built frontend static files if present
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = parseInt(process.env.PORT ?? "8787", 10);

serve(
  {
    fetch: (req) => app.fetch(req, envBindings),
    port,
  },
  (info) => {
    console.log(`✅ Dopamine Fitness server running at http://localhost:${info.port}`);
  }
);
