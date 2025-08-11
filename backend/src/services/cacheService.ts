import { RedisManager } from '../config/redisManager';

export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes in seconds
  private static memoryCache: Map<string, { value: any; expiresAt: number }> = new Map();

  /**
   * Get a value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        const cached = await redis.getClient().get(key);
        return cached ? JSON.parse(cached) : null;
      } else if (redis.isInFallbackMode()) {
        // Use memory cache as fallback
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }
        // Clean up expired entry
        if (cached) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
    }
    
    return null;
  }

  /**
   * Set a value in cache
   */
  static async set<T>(
    key: string, 
    value: T, 
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        await redis.getClient().setEx(
          key,
          ttl,
          JSON.stringify(value)
        );
      } else if (redis.isInFallbackMode()) {
        // Use memory cache as fallback
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + (ttl * 1000)
        });
        
        // Schedule cleanup
        setTimeout(() => {
          const cached = this.memoryCache.get(key);
          if (cached && cached.expiresAt <= Date.now()) {
            this.memoryCache.delete(key);
          }
        }, ttl * 1000);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a key from cache
   */
  static async del(key: string): Promise<void> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        await redis.getClient().del(key);
      }
      
      // Always remove from memory cache
      this.memoryCache.delete(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidate(pattern: string): Promise<void> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        const keys = await redis.getClient().keys(pattern);
        if (keys.length > 0) {
          await redis.getClient().del(keys);
        }
      }
      
      // Clear memory cache entries matching pattern
      if (redis.isInFallbackMode() || !redis.isHealthy()) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Check if a key exists in cache
   */
  static async exists(key: string): Promise<boolean> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        return (await redis.getClient().exists(key)) === 1;
      } else if (redis.isInFallbackMode()) {
        const cached = this.memoryCache.get(key);
        return cached !== undefined && cached.expiresAt > Date.now();
      }
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
    }
    
    return false;
  }

  /**
   * Get remaining TTL for a key
   */
  static async ttl(key: string): Promise<number> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        return await redis.getClient().ttl(key);
      } else if (redis.isInFallbackMode()) {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return Math.floor((cached.expiresAt - Date.now()) / 1000);
        }
      }
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
    }
    
    return -1;
  }

  /**
   * Clear all cache
   */
  static async flush(): Promise<void> {
    const redis = RedisManager.getInstance();
    
    try {
      if (redis.isHealthy()) {
        await redis.getClient().flushDb();
      }
      
      // Always clear memory cache
      this.memoryCache.clear();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  // Specialized cache methods for common use cases

  /**
   * Cache employee permissions
   */
  static async getEmployeePermissions(employeeId: number): Promise<any[] | null> {
    const key = `permissions:employee:${employeeId}`;
    const cached = await this.get<any[]>(key);
    
    if (cached) {
      console.debug(`Permission cache hit for employee ${employeeId}`);
    }
    
    return cached;
  }

  /**
   * Set employee permissions in cache
   */
  static async setEmployeePermissions(
    employeeId: number, 
    permissions: any[]
  ): Promise<void> {
    const key = `permissions:employee:${employeeId}`;
    await this.set(key, permissions, 600); // Cache for 10 minutes
  }

  /**
   * Invalidate employee permissions cache
   */
  static async invalidateEmployeePermissions(employeeId: number): Promise<void> {
    const key = `permissions:employee:${employeeId}`;
    await this.del(key);
  }

  /**
   * Cache employee roles
   */
  static async getEmployeeRoles(employeeId: number): Promise<any[] | null> {
    const key = `roles:employee:${employeeId}`;
    const cached = await this.get<any[]>(key);
    
    if (cached) {
      console.debug(`Role cache hit for employee ${employeeId}`);
    }
    
    return cached;
  }

  /**
   * Set employee roles in cache
   */
  static async setEmployeeRoles(
    employeeId: number, 
    roles: any[]
  ): Promise<void> {
    const key = `roles:employee:${employeeId}`;
    await this.set(key, roles, 600); // Cache for 10 minutes
  }

  /**
   * Invalidate employee roles cache
   */
  static async invalidateEmployeeRoles(employeeId: number): Promise<void> {
    const key = `roles:employee:${employeeId}`;
    await this.del(key);
  }

  /**
   * Clean up expired memory cache entries
   */
  static cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup of memory cache
   */
  static startCleanupScheduler(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    redisConnected: boolean;
    fallbackMode: boolean;
    memoryCacheSize: number;
    redisInfo?: any;
  }> {
    const redis = RedisManager.getInstance();
    
    const stats = {
      redisConnected: redis.isHealthy(),
      fallbackMode: redis.isInFallbackMode(),
      memoryCacheSize: this.memoryCache.size,
      redisInfo: undefined as any
    };

    if (redis.isHealthy()) {
      try {
        const info = await redis.getClient().info();
        stats.redisInfo = info;
      } catch (error) {
        console.error('Failed to get Redis info:', error);
      }
    }

    return stats;
  }
}