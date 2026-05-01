import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env, HonoVariables } from "./types/index.js";
import { authRoutes } from "./routes/auth.js";
import { workoutRoutes } from "./routes/workouts.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { customExerciseRoutes } from "./routes/customExercises.js";
import { uploadRoutes } from "./routes/uploads.js";
import { statsRoutes } from "./routes/stats.js";
import { settingsRoutes } from "./routes/settings.js";
import { profileRoutes } from "./routes/profile.js";
import { favoritesRoutes } from "./routes/favorites.js";
import { checkinRoutes } from "./routes/checkins.js";
import { adminRoutes } from "./routes/admin.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requestId } from "./middlewares/requestId.js";
import { rateLimiter } from "./middlewares/rateLimiter.js";
import { getAppConfig } from "./config/env.js";

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use("*", requestId());
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = getAppConfig(c.env).cors.allowedOrigins;
      if (allowed.length === 0) return origin;
      if (!origin) return "";
      return allowed.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);
app.use("/api/*", rateLimiter());

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  {
    const config = getAppConfig(c.env);
    return c.json({
      status: "ok",
      app: config.appName,
      env: config.environment,
      ts: new Date().toISOString(),
    });
  }
);

app.get("/health/dependencies", async (c) => {
  const config = getAppConfig(c.env);

  let dbOk = false;
  let kvOk = false;

  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    dbOk = row?.ok === 1;
  } catch {
    dbOk = false;
  }

  try {
    await c.env.KV.get("health:ping");
    kvOk = true;
  } catch {
    kvOk = false;
  }

  const ready = dbOk && kvOk;

  return c.json(
    {
      status: ready ? "ok" : "degraded",
      ready,
      app: config.appName,
      env: config.environment,
      dependencies: {
        db: dbOk,
        kv: kvOk,
      },
      ts: new Date().toISOString(),
    },
    ready ? 200 : 503
  );
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.route("/api/auth", authRoutes);
app.route("/api", profileRoutes);
app.route("/api/workouts", workoutRoutes);
app.route("/api/exercises", exerciseRoutes);
app.route("/api/custom-exercises", customExerciseRoutes);
app.route("/api/uploads", uploadRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/favorites", favoritesRoutes);
app.route("/api/checkins", checkinRoutes);
app.route("/api/admin", adminRoutes);

app.get("*", async (c) => {
  if (!c.env.ASSETS) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError(errorHandler);
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

export default app;
