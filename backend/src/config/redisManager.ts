import { createClient, RedisClientType } from 'redis';
import { config } from './env';

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private fallbackMode: boolean = false;

  private constructor() {
    // Use config.redis.url which handles password presence/absence correctly
    const redisUrl = process.env.REDIS_URL || config.redis.url;

    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: this.reconnectStrategy.bind(this),
      },
    });

    this.setupEventHandlers();
  }

  private reconnectStrategy(retries: number): number | Error {
    this.reconnectAttempts = retries;
    
    if (retries > 10) {
      console.error('Redis connection failed after 10 attempts');
      this.enableFallbackMode();
      return new Error('Redis connection failed');
    }
    
    const delay = Math.min(retries * 100, 3000);
    console.warn(`Redis reconnection attempt ${retries}, retrying in ${delay}ms`);
    return delay;
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('Redis Client Ready');
      this.disableFallbackMode();
    });

    this.client.on('reconnecting', () => {
      console.log('Redis Client Reconnecting...');
    });

    this.client.on('end', () => {
      console.log('Redis Client Connection Closed');
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.enableFallbackMode();
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
      await this.client.disconnect();
    }
  }

  public getClient(): RedisClientType {
    if (!this.isConnected && !this.fallbackMode) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client.isReady;
  }

  public isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  private enableFallbackMode(): void {
    this.fallbackMode = true;
    console.warn('Redis fallback mode enabled - using in-memory storage');
  }

  private disableFallbackMode(): void {
    this.fallbackMode = false;
    console.info('Redis fallback mode disabled - using Redis storage');
  }

  // Health check method
  public async ping(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }

  // Utility method for safe operations
  public async safeOperation<T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T | null> {
    if (!this.isHealthy() && fallback) {
      return fallback();
    }

    try {
      return await operation();
    } catch (error) {
      console.error('Redis operation failed:', error);
      if (fallback) {
        return fallback();
      }
      return null;
    }
  }
}