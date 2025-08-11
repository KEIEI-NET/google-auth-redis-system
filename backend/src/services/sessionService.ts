import { RedisManager } from '../config/redisManager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SessionData {
  employeeId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
}

export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private static memoryStore: Map<string, SessionData> = new Map();

  static async createSession(
    sessionId: string,
    employeeId: number,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<void> {
    const redis = RedisManager.getInstance();
    
    const sessionData: SessionData = {
      employeeId,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000).toISOString(),
    };

    try {
      // Try to save to Redis first
      if (redis.isHealthy()) {
        await redis.getClient().setEx(
          `${this.SESSION_PREFIX}${sessionId}`,
          this.SESSION_TTL,
          JSON.stringify(sessionData)
        );
      } else if (redis.isInFallbackMode()) {
        // Use in-memory store as fallback
        this.memoryStore.set(sessionId, sessionData);
        // Schedule cleanup
        setTimeout(() => {
          this.memoryStore.delete(sessionId);
        }, this.SESSION_TTL * 1000);
      }

      // Always save to database as backup
      await prisma.session.create({
        data: {
          sessionId,
          employeeId,
          ipAddress,
          userAgent,
          expiresAt: new Date(sessionData.expiresAt),
        },
      });
    } catch (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    const redis = RedisManager.getInstance();
    
    try {
      // Try Redis first
      if (redis.isHealthy()) {
        const cached = await redis.getClient().get(
          `${this.SESSION_PREFIX}${sessionId}`
        );
        
        if (cached) {
          const sessionData = JSON.parse(cached) as SessionData;
          // Check if session is expired
          if (new Date(sessionData.expiresAt) > new Date()) {
            return sessionData;
          } else {
            // Clean up expired session
            await this.invalidateSession(sessionId);
            return null;
          }
        }
      } else if (redis.isInFallbackMode()) {
        // Check in-memory store
        const sessionData = this.memoryStore.get(sessionId);
        if (sessionData && new Date(sessionData.expiresAt) > new Date()) {
          return sessionData;
        }
      }

      // Fallback to database
      const session = await prisma.session.findUnique({
        where: { sessionId },
      });

      if (session && session.expiresAt > new Date()) {
        const sessionData: SessionData = {
          employeeId: session.employeeId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        };

        // Re-cache in Redis if available
        if (redis.isHealthy()) {
          const ttl = Math.floor(
            (session.expiresAt.getTime() - Date.now()) / 1000
          );
          if (ttl > 0) {
            await redis.getClient().setEx(
              `${this.SESSION_PREFIX}${sessionId}`,
              ttl,
              JSON.stringify(sessionData)
            );
          }
        }

        return sessionData;
      }

      return null;
    } catch (error) {
      console.error('Session retrieval error:', error);
      
      // Last resort: try database directly
      try {
        const session = await prisma.session.findUnique({
          where: { sessionId },
        });
        
        if (session && session.expiresAt > new Date()) {
          return {
            employeeId: session.employeeId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt.toISOString(),
            expiresAt: session.expiresAt.toISOString(),
          };
        }
      } catch (dbError) {
        console.error('Database fallback failed:', dbError);
      }
      
      return null;
    }
  }

  static async invalidateSession(sessionId: string): Promise<void> {
    const redis = RedisManager.getInstance();
    
    try {
      // Remove from Redis
      if (redis.isHealthy()) {
        await redis.getClient().del(`${this.SESSION_PREFIX}${sessionId}`);
      }

      // Remove from memory store
      if (redis.isInFallbackMode()) {
        this.memoryStore.delete(sessionId);
      }

      // Remove from database
      await prisma.session.delete({
        where: { sessionId },
      }).catch(() => {
        // Ignore error if session doesn't exist
      });
    } catch (error) {
      console.error('Session invalidation error:', error);
      throw error;
    }
  }

  static async refreshSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    const redis = RedisManager.getInstance();
    
    try {
      // Update expiration time
      const newExpiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);
      session.expiresAt = newExpiresAt.toISOString();

      // Update in Redis
      if (redis.isHealthy()) {
        await redis.getClient().setEx(
          `${this.SESSION_PREFIX}${sessionId}`,
          this.SESSION_TTL,
          JSON.stringify(session)
        );
      } else if (redis.isInFallbackMode()) {
        // Update in memory store
        this.memoryStore.set(sessionId, session);
      }

      // Update in database
      await prisma.session.update({
        where: { sessionId },
        data: { expiresAt: newExpiresAt },
      });

      return true;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
    const redis = RedisManager.getInstance();
    let cleanedCount = 0;

    try {
      // Clean up database sessions
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      cleanedCount = result.count;

      // Clean up memory store
      if (redis.isInFallbackMode()) {
        const now = new Date();
        for (const [key, session] of this.memoryStore.entries()) {
          if (new Date(session.expiresAt) < now) {
            this.memoryStore.delete(key);
            cleanedCount++;
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  // Schedule periodic cleanup
  static startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
    }, 60 * 60 * 1000);
  }
}