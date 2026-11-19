interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

export function createTtlCache<T>(defaultTtlMs = 30_000): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T, ttlMs = defaultTtlMs): void {
      if (ttlMs <= 0) {
        store.delete(key);
        return;
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}
