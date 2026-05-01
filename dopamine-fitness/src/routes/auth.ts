import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { AuthService } from "../services/authService.js";
import { validate } from "../validators/validate.js";
import { registerSchema, loginSchema } from "../validators/schemas.js";
import { getAppConfig } from "../config/env.js";
import { authRateLimiter } from "../middlewares/rateLimiter.js";
import { authenticate } from "../middlewares/authenticate.js";
import { revokeToken } from "../utils/tokenBlocklist.js";
import { verifyJwt } from "../utils/jwt.js";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
};

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="));
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

authRoutes.use("/register", authRateLimiter());
authRoutes.use("/login", authRateLimiter());

authRoutes.post("/register", async (c) => {
  const config = getAppConfig(c.env);
  const body = await c.req.json();
  const input = validate(registerSchema, body);

  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds,
    config.auth.adminEmails
  );
  const { user, token } = await service.register(input);

  return c.json({ success: true, data: { user, token } }, 201);
});

authRoutes.post("/login", async (c) => {
  const config = getAppConfig(c.env);
  const body = await c.req.json();
  const input = validate(loginSchema, body);

  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds,
    config.auth.adminEmails
  );
  const { user, token } = await service.login(input);

  return c.json({ success: true, data: { user, token } });
});

authRoutes.post("/logout", authenticate(), async (c) => {
  const config = getAppConfig(c.env);
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    try {
      const payload = await verifyJwt(token, config.jwt.secret);
      await revokeToken(c.env, token, payload.exp);
    } catch {
      // Ignore invalid token on logout to keep endpoint idempotent for client.
    }
  }

  return c.json({ success: true, message: "Выход выполнен" });
});

authRoutes.get("/google/start", async (c) => {
  const config = getAppConfig(c.env);

  if (!config.auth.google) {
    return c.json({ success: false, error: "Google OAuth is not configured" }, 503);
  }

  const statePayload = JSON.stringify({
    ts: Date.now(),
    origin: c.req.query("origin") || null,
  });
  const state = base64UrlEncode(statePayload);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.auth.google.clientId);
  url.searchParams.set("redirect_uri", config.auth.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  return c.redirect(url.toString(), 302);
});

authRoutes.get("/google/callback", async (c) => {
  const config = getAppConfig(c.env);
  if (!config.auth.google) {
    return c.json({ success: false, error: "Google OAuth is not configured" }, 503);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ success: false, error: "Missing OAuth callback params" }, 400);
  }

  let originFromState: string | null = null;
  try {
    const decoded = JSON.parse(base64UrlDecode(state)) as { origin?: string | null; ts?: number };
    originFromState = decoded.origin ?? null;
  } catch {
    originFromState = null;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.auth.google.clientId,
      client_secret: config.auth.google.clientSecret,
      redirect_uri: config.auth.google.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const tokenJson = await tokenResponse.json<GoogleTokenResponse>();
  if (!tokenResponse.ok || !tokenJson.access_token) {
    return c.json({ success: false, error: tokenJson.error_description || tokenJson.error || "Failed to exchange code" }, 400);
  }

  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  const userInfo = await userInfoResponse.json<GoogleUserInfo>();
  if (!userInfoResponse.ok || !userInfo.sub || !userInfo.email) {
    return c.json({ success: false, error: "Failed to fetch Google profile" }, 400);
  }

  const service = new AuthService(
    c.env.DB,
    config.jwt.secret,
    config.jwt.expiresInSeconds,
    config.auth.adminEmails
  );

  const { token } = await service.loginWithGoogle({
    sub: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
  });

  const targetOrigin = originFromState && config.cors.allowedOrigins.includes(originFromState)
    ? originFromState
    : config.cors.allowedOrigins[0] ?? new URL(c.req.url).origin;

  const redirect = new URL("/auth", targetOrigin);
  redirect.searchParams.set("token", token);

  return c.redirect(redirect.toString(), 302);
});
