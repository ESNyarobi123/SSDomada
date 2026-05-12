// Redis client for caching (Omada token, sessions, rate limiting)
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// In-memory fallback for environments without Redis
class MemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<void> {
    const expiresAt = mode === "EX" && duration ? Date.now() + duration * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let client: Redis | MemoryRedis;

try {
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null, // Don't retry on connection errors
  });

  (client as Redis).on("error", (err) => {
    console.warn("[Redis] Connection error, falling back to memory:", err.message);
  });
} catch (err) {
  console.warn("[Redis] Failed to initialize, using in-memory fallback");
  client = new MemoryRedis();
}

export const redis = client;
