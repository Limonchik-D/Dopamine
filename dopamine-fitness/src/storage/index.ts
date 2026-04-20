export class R2Storage {
  constructor(private bucket: R2Bucket) {}

  async upload(
    key: string,
    data: ArrayBuffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    await this.bucket.put(key, data, {
      httpMetadata: { contentType },
      customMetadata: metadata,
    });
    return key;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const obj = await this.bucket.head(key);
    return obj != null;
  }

  /** Generate a consistent R2 key for user media */
  static userMediaKey(
    userId: number,
    category: "avatar" | "exercise",
    filename: string
  ): string {
    return `users/${userId}/${category}/${filename}`;
  }
}

export class KVStore {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    return this.kv.get<T>(key, "json");
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async getString(key: string): Promise<string | null> {
    return this.kv.get(key, "text");
  }

  async setString(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.kv.put(key, value, { expirationTtl: ttlSeconds });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static sessionKey(userId: number): string {
    return `session:${userId}`;
  }

  static settingsKey(userId: number): string {
    return `settings:${userId}`;
  }

  static exerciseCacheKey(source: string, id: string): string {
    return `exercise:${source}:${id}`;
  }

  static rateLimitKey(ip: string, windowStart: number): string {
    return `rl:${ip}:${windowStart}`;
  }
}
