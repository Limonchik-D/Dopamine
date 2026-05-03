import { PrismaClient } from "@prisma/client";

// Single shared instance. Works in both Node.js (local dev) and
// Cloudflare Workers (nodejs_compat). The global pattern is intentionally
// omitted: CF Workers isolates don't share global state across requests.
export const prisma = new PrismaClient({
  log: ["error"],
});
