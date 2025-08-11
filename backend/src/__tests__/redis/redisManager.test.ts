import { RedisManager } from '../../config/redisManager';
import { createClient } from 'redis';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
    on: jest.fn(),
    isReady: true,
  }))
}));

describe('RedisManager', () => {
  let manager: RedisManager;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (RedisManager as any).instance = undefined;
    manager = RedisManager.getInstance();
    mockClient = (createClient as jest.Mock).mock.results[0].value;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RedisManager.getInstance();
      const instance2 = RedisManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create client only once', () => {
      RedisManager.getInstance();
      RedisManager.getInstance();
      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      await manager.connect();
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(error);
      
      await expect(manager.connect()).rejects.toThrow('Connection failed');
    });

    it('should not reconnect if already connected', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      await manager.connect();
      await manager.connect();
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect properly', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.quit.mockResolvedValue(undefined);
      
      await manager.connect();
      await manager.disconnect();
      
      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('should force disconnect on quit failure', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.quit.mockRejectedValue(new Error('Quit failed'));
      mockClient.disconnect.mockResolvedValue(undefined);
      
      await manager.connect();
      await manager.disconnect();
      
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connected', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isReady = true;
      
      await manager.connect();
      expect(manager.isHealthy()).toBe(true);
    });

    it('should report unhealthy when not connected', () => {
      expect(manager.isHealthy()).toBe(false);
    });

    it('should ping successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.ping.mockResolvedValue('PONG');
      
      await manager.connect();
      const result = await manager.ping();
      
      expect(result).toBe(true);
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should handle ping failure', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.ping.mockRejectedValue(new Error('Ping failed'));
      
      await manager.connect();
      const result = await manager.ping();
      
      expect(result).toBe(false);
    });
  });

  describe('Fallback Mode', () => {
    it('should enable fallback mode on connection failure', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      try {
        await manager.connect();
      } catch {
        // Expected to throw
      }
      
      expect(manager.isInFallbackMode()).toBe(true);
    });

    it('should disable fallback mode when ready', async () => {
      // Simulate ready event
      const readyHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'ready'
      )?.[1];
      
      if (readyHandler) {
        readyHandler();
      }
      
      expect(manager.isInFallbackMode()).toBe(false);
    });
  });

  describe('Safe Operations', () => {
    it('should execute operation when healthy', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      await manager.connect();
      
      const operation = jest.fn().mockResolvedValue('result');
      const result = await manager.safeOperation(operation);
      
      expect(operation).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should use fallback when unhealthy', async () => {
      const operation = jest.fn();
      const fallback = jest.fn().mockReturnValue('fallback');
      
      const result = await manager.safeOperation(operation, fallback);
      
      expect(operation).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
      expect(result).toBe('fallback');
    });

    it('should handle operation errors with fallback', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      await manager.connect();
      
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockReturnValue('fallback');
      
      const result = await manager.safeOperation(operation, fallback);
      
      expect(result).toBe('fallback');
    });

    it('should return null on error without fallback', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      await manager.connect();
      
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      const result = await manager.safeOperation(operation);
      
      expect(result).toBeNull();
    });
  });

  describe('Event Handlers', () => {
    it('should register all event handlers', () => {
      const events = ['error', 'connect', 'ready', 'reconnecting', 'end'];
      
      events.forEach(event => {
        const handler = mockClient.on.mock.calls.find(call => call[0] === event);
        expect(handler).toBeDefined();
      });
    });

    it('should handle error events', () => {
      const errorHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      if (errorHandler) {
        errorHandler(new Error('Test error'));
      }
      
      expect(consoleError).toHaveBeenCalledWith(
        'Redis Client Error:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });

    it('should handle connect events', () => {
      const connectHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();
      
      if (connectHandler) {
        connectHandler();
      }
      
      expect(consoleLog).toHaveBeenCalledWith('Redis Client Connected');
      
      consoleLog.mockRestore();
    });
  });

  describe('Reconnection Strategy', () => {
    it('should calculate reconnection delay correctly', () => {
      const strategy = (manager as any).reconnectStrategy;
      
      expect(strategy.call(manager, 1)).toBe(100);
      expect(strategy.call(manager, 5)).toBe(500);
      expect(strategy.call(manager, 10)).toBe(3000);
    });

    it('should return error after max attempts', () => {
      const strategy = (manager as any).reconnectStrategy;
      const result = strategy.call(manager, 11);
      
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Redis connection failed');
      expect(manager.isInFallbackMode()).toBe(true);
    });

    it('should cap delay at 3000ms', () => {
      const strategy = (manager as any).reconnectStrategy;
      
      expect(strategy.call(manager, 50)).toBe(3000);
    });
  });
});