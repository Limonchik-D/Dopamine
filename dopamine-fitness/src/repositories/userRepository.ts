import type { User } from "../types/index.js";
import type { UserRole } from "../types/index.js";

export class UserRepository {
  constructor(private db: D1Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT id, email, username, role, created_at, updated_at FROM users WHERE email = ?1 COLLATE NOCASE")
      .bind(email)
      .first<User>();
    return row ?? null;
  }

  async findById(id: number): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT id, email, username, role, created_at, updated_at FROM users WHERE id = ?1")
      .bind(id)
      .first<User>();
    return row ?? null;
  }

  async findPasswordHash(email: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT password_hash FROM users WHERE email = ?1 COLLATE NOCASE")
      .bind(email)
      .first<{ password_hash: string }>();
    return row?.password_hash ?? null;
  }

  async create(
    email: string,
    username: string,
    passwordHash: string,
    role: UserRole = "user",
    googleSub: string | null = null
  ): Promise<User> {
    const result = await this.db
      .prepare(
        `INSERT INTO users (email, username, password_hash, role, google_sub) VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING id, email, username, role, google_sub, created_at, updated_at`
      )
      .bind(email, username, passwordHash, role, googleSub)
      .first<User>();

    if (!result) throw new Error("Failed to create user");

    // Create default profile and settings
    await this.db.batch([
      this.db
        .prepare("INSERT INTO user_profiles (user_id) VALUES (?1)")
        .bind(result.id),
      this.db
        .prepare("INSERT INTO user_settings (user_id) VALUES (?1)")
        .bind(result.id),
    ]);

    return result;
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM users WHERE email = ?1 COLLATE NOCASE")
      .bind(email)
      .first();
    return row != null;
  }

  async usernameExists(username: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE")
      .bind(username)
      .first();
    return row != null;
  }

  async createWithDefaults(
    email: string,
    username: string,
    passwordHash: string
  ): Promise<User> {
    return this.create(email, username, passwordHash);
  }

  async createOAuthUser(email: string, username: string, googleSub: string, role: UserRole = "user"): Promise<User> {
    const randomPassword = crypto.randomUUID();
    const result = await this.db
      .prepare(
        `INSERT INTO users (email, username, password_hash, role, google_sub) VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING id, email, username, role, google_sub, created_at, updated_at`
      )
      .bind(email, username, randomPassword, role, googleSub)
      .first<User>();

    if (!result) throw new Error("Failed to create OAuth user");

    await this.db.batch([
      this.db.prepare("INSERT INTO user_profiles (user_id) VALUES (?1)").bind(result.id),
      this.db.prepare("INSERT INTO user_settings (user_id) VALUES (?1)").bind(result.id),
    ]);

    return result;
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT id, email, username, role, google_sub, created_at, updated_at FROM users WHERE google_sub = ?1")
      .bind(googleSub)
      .first<User>();
    return row ?? null;
  }

  async linkGoogleSub(userId: number, googleSub: string): Promise<void> {
    await this.db
      .prepare("UPDATE users SET google_sub = ?1, updated_at = datetime('now') WHERE id = ?2")
      .bind(googleSub, userId)
      .run();
  }

  async setRole(userId: number, role: UserRole): Promise<User> {
    const row = await this.db
      .prepare("UPDATE users SET role = ?1, updated_at = datetime('now') WHERE id = ?2 RETURNING id, email, username, role, google_sub, created_at, updated_at")
      .bind(role, userId)
      .first<User>();

    if (!row) throw new Error("Not found");
    return row;
  }
}
