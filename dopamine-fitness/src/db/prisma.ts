import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

// Uses Neon serverless driver — works in CF Workers (edge) and Node.js.
function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ??
    (globalThis as unknown as Record<string, string>)["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaNeon({ connectionString } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const prisma = createPrismaClient();
