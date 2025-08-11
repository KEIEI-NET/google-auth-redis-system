import { SessionService } from '../../services/sessionService';
import { RedisManager } from '../../config/redisManager';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../../config/redisManager');
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  })),
}));

describe('SessionService', () => {
  let mockRedisManager: jest.Mocked<RedisManager>;
  let mockRedisClient: any;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Redis mock
    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };
    
    mockRedisManager = {
      isHealthy: jest.fn().mockReturnValue(true),
      isInFallbackMode: jest.fn().mockReturnValue(false),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      connect: jest.fn(),
      disconnect: jest.fn(),
      ping: jest.fn(),
      safeOperation: jest.fn(),
    } as any;
    
    (RedisManager.getInstance as jest.Mock).mockReturnValue(mockRedisManager);
    
    // Setup Prisma mock
    mockPrisma = new PrismaClient();
    
    // Clear memory store
    (SessionService as any).memoryStore.clear();
  });

  describe('createSession', () => {
    const sessionData = {
      sessionId: 'test-session-123',
      employeeId: 1,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should create session in Redis and database', async () => {
      mockPrisma.session.create.mockResolvedValue({
        ...sessionData,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await SessionService.createSession(
        sessionData.sessionId,
        sessionData.employeeId,
        sessionData.ipAddress,
        sessionData.userAgent
      );

      // Check Redis call
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        `session:${sessionData.sessionId}`,
        24 * 60 * 60,
        expect.stringContaining('"employeeId":1')
      );

      // Check database call
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: sessionData.sessionId,
          employeeId: sessionData.employeeId,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
        }),
      });
    });

    it('should use memory store when Redis is in fallback mode', async () => {
      mockRedisManager.isHealthy.mockReturnValue(false);
      mockRedisManager.isInFallbackMode.mockReturnValue(true);

      await SessionService.createSession(
        sessionData.sessionId,
        sessionData.employeeId,
        sessionData.ipAddress,
        sessionData.userAgent
      );

      // Check memory store
      const memoryStore = (SessionService as any).memoryStore;
      expect(memoryStore.has(sessionData.sessionId)).toBe(true);
      
      const storedSession = memoryStore.get(sessionData.sessionId);
      expect(storedSession.employeeId).toBe(sessionData.employeeId);

      // Should not call Redis
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();

      // Should still save to database
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
      mockPrisma.session.create.mockRejectedValue(new Error('Database error'));

      await expect(
        SessionService.createSession(
          sessionData.sessionId,
          sessionData.employeeId,
          sessionData.ipAddress,
          sessionData.userAgent
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('getSession', () => {
    const sessionId = 'test-session-123';
    const sessionData = {
      employeeId: 1,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    };

    it('should get session from Redis cache', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await SessionService.getSession(sessionId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(result).toEqual(sessionData);
      expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
    });

    it('should get session from memory store in fallback mode', async () => {
      mockRedisManager.isHealthy.mockReturnValue(false);
      mockRedisManager.isInFallbackMode.mockReturnValue(true);

      const memoryStore = (SessionService as any).memoryStore;
      memoryStore.set(sessionId, sessionData);

      const result = await SessionService.getSession(sessionId);

      expect(result).toEqual(sessionData);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should fallback to database when not in cache', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        sessionId,
        employeeId: sessionData.employeeId,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: new Date(sessionData.expiresAt),
      });

      const result = await SessionService.getSession(sessionId);

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { sessionId },
      });
      expect(result).toMatchObject({
        employeeId: sessionData.employeeId,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
      });

      // Should re-cache in Redis
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should return null for expired sessions', async () => {
      const expiredSession = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expiredSession));

      const result = await SessionService.getSession(sessionId);

      expect(result).toBeNull();
    });

    it('should handle errors and fallback to database', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      mockPrisma.session.findUnique.mockResolvedValue({
        sessionId,
        employeeId: sessionData.employeeId,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: new Date(sessionData.expiresAt),
      });

      const result = await SessionService.getSession(sessionId);

      expect(result).toBeTruthy();
      expect(mockPrisma.session.findUnique).toHaveBeenCalled();
    });
  });

  describe('invalidateSession', () => {
    const sessionId = 'test-session-123';

    it('should remove session from Redis and database', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockPrisma.session.delete.mockResolvedValue({});

      await SessionService.invalidateSession(sessionId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { sessionId },
      });
    });

    it('should remove from memory store in fallback mode', async () => {
      mockRedisManager.isHealthy.mockReturnValue(false);
      mockRedisManager.isInFallbackMode.mockReturnValue(true);

      const memoryStore = (SessionService as any).memoryStore;
      memoryStore.set(sessionId, { employeeId: 1 });

      await SessionService.invalidateSession(sessionId);

      expect(memoryStore.has(sessionId)).toBe(false);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle database deletion errors gracefully', async () => {
      mockPrisma.session.delete.mockRejectedValue(new Error('Not found'));

      // Should not throw
      await expect(
        SessionService.invalidateSession(sessionId)
      ).resolves.not.toThrow();
    });
  });

  describe('refreshSession', () => {
    const sessionId = 'test-session-123';
    const sessionData = {
      employeeId: 1,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    it('should refresh session expiration', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockPrisma.session.update.mockResolvedValue({});

      const result = await SessionService.refreshSession(sessionId);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { sessionId },
        data: { expiresAt: expect.any(Date) },
      });
    });

    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await SessionService.refreshSession(sessionId);

      expect(result).toBe(false);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
      expect(mockPrisma.session.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await SessionService.refreshSession(sessionId);

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions from database', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await SessionService.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should clean memory store in fallback mode', async () => {
      mockRedisManager.isInFallbackMode.mockReturnValue(true);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

      const memoryStore = (SessionService as any).memoryStore;
      // Add expired session
      memoryStore.set('expired-1', {
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });
      // Add valid session
      memoryStore.set('valid-1', {
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const result = await SessionService.cleanupExpiredSessions();

      expect(memoryStore.has('expired-1')).toBe(false);
      expect(memoryStore.has('valid-1')).toBe(true);
      expect(result).toBe(3); // 2 from DB + 1 from memory
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.session.deleteMany.mockRejectedValue(new Error('Database error'));

      const result = await SessionService.cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });

  describe('startCleanupScheduler', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule periodic cleanup', () => {
      const cleanupSpy = jest.spyOn(SessionService, 'cleanupExpiredSessions');
      cleanupSpy.mockResolvedValue(0);

      SessionService.startCleanupScheduler();

      // Fast-forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(cleanupSpy).toHaveBeenCalled();

      cleanupSpy.mockRestore();
    });
  });
});