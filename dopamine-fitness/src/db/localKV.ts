import type { AppKV } from "../types/index.js";

type KVEntry = { value: string; expiresAt: number | null };

/**
 * In-memory KV store for local Node.js development.
 * Compatible with the AppKV interface (subset of Cloudflare KVNamespace).
 */
export class LocalKV implements AppKV {
  private store = new Map<string, KVEntry>();

  private isExpired(entry: KVEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  async get(key: string, type?: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") {
      try {
        return JSON.parse(entry.value) as unknown as string;
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt =
      opts?.expirationTtl != null ? Date.now() + opts.expirationTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(opts?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = opts?.prefix ?? "";
    const keys: { name: string }[] = [];
    for (const [name, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(name);
        continue;
      }
      if (name.startsWith(prefix)) {
        keys.push({ name });
      }
    }
    return { keys, list_complete: true };
  }
}
