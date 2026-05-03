import { prisma } from "../db/prisma.js";
import type { User, UserRole } from "../types/index.js";

function mapUser(row: {
  id: number;
  email: string;
  username: string;
  role: string;
  google_sub: string | null;
  created_at: Date;
  updated_at: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role as UserRole,
    google_sub: row.google_sub,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, username: true, role: true, google_sub: true, created_at: true, updated_at: true },
    });
    return row ? mapUser(row) : null;
  }

  async findById(id: number): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, role: true, google_sub: true, created_at: true, updated_at: true },
    });
    return row ? mapUser(row) : null;
  }

  async findPasswordHash(email: string): Promise<string | null> {
    const row = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { password_hash: true },
    });
    return row?.password_hash ?? null;
  }

  async create(
    email: string,
    username: string,
    passwordHash: string,
    role: UserRole = "user",
    googleSub: string | null = null
  ): Promise<User> {
    const result = await prisma.user.create({
      data: {
        email,
        username,
        password_hash: passwordHash,
        role: role as import("@prisma/client").UserRole,
        google_sub: googleSub,
        profile: { create: {} },
        settings: { create: {} },
      },
      select: { id: true, email: true, username: true, role: true, google_sub: true, created_at: true, updated_at: true },
    });
    return mapUser(result);
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    return count > 0;
  }

  async usernameExists(username: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    return count > 0;
  }

  async createWithDefaults(email: string, username: string, passwordHash: string): Promise<User> {
    return this.create(email, username, passwordHash);
  }

  async createOAuthUser(
    email: string,
    username: string,
    googleSub: string,
    role: UserRole = "user"
  ): Promise<User> {
    const randomPassword = crypto.randomUUID();
    return this.create(email, username, randomPassword, role, googleSub);
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where: { google_sub: googleSub },
      select: { id: true, email: true, username: true, role: true, google_sub: true, created_at: true, updated_at: true },
    });
    return row ? mapUser(row) : null;
  }

  async linkGoogleSub(userId: number, googleSub: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { google_sub: googleSub },
    });
  }

  async setRole(userId: number, role: UserRole): Promise<User> {
    const row = await prisma.user.update({
      where: { id: userId },
      data: { role: role as import("@prisma/client").UserRole },
      select: { id: true, email: true, username: true, role: true, google_sub: true, created_at: true, updated_at: true },
    });
    return mapUser(row);
  }
}
