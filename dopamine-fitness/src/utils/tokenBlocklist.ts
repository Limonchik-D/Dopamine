import type { Env } from "../types/index.js";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tokenFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(new Uint8Array(digest));
}

function blocklistKey(fingerprint: string): string {
  return `jwt:block:${fingerprint}`;
}

export async function isTokenRevoked(env: Env, token: string): Promise<boolean> {
  const fingerprint = await tokenFingerprint(token);
  const blocked = await env.KV.get(blocklistKey(fingerprint));
  return blocked === "1";
}

export async function revokeToken(
  env: Env,
  token: string,
  expUnixSeconds: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(1, expUnixSeconds - now);
  const fingerprint = await tokenFingerprint(token);
  await env.KV.put(blocklistKey(fingerprint), "1", { expirationTtl: ttl });
}
