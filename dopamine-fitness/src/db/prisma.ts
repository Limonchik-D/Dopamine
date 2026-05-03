import { neon } from "@neondatabase/serverless";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

let _client: PrismaClient | undefined;
let _url: string | undefined;

/**
 * Initialize Prisma with Neon HTTP adapter (synchronous, no WebSocket).
 * Works in Cloudflare Workers. Idempotent: same URL is a no-op.
 */
export function initPrisma(databaseUrl: string): void {
  if (_client && _url === databaseUrl) return;
  _url = databaseUrl;
  // neon() creates an HTTP query function — no TCP/WebSocket required
  const sql = neon(databaseUrl);
  const adapter = new PrismaNeonHTTP(sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client = new PrismaClient({ adapter } as any);
}

function getClient(): PrismaClient {
  if (!_client) throw new Error("Prisma not initialized. Call `await initPrisma(url)` first.");
  return _client;
}

// Proxy forwards all property accesses to the lazily-created client.
// Methods are bound to the client to preserve `this` context.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const val = Reflect.get(client as object, prop);
    return typeof val === "function" ? (val as Function).bind(client) : val;
  },
});
