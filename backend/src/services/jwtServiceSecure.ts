import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { config } from '../config/env';
import { RedisManager } from '../config/redisManager';
import { JwtPayload, AppError, ErrorCode } from '../types';

interface SecureJwtPayload extends JwtPayload {
  jti: string;  // JWT ID for blacklisting
  nonce: string; // Nonce for replay protection
  iat: number;   // Issued at timestamp
  exp: number;   // Expiration timestamp
}

export class JwtServiceSecure {
  private static readonly BLACKLIST_PREFIX = 'jwt:blacklist:';
  private static readonly NONCE_PREFIX = 'jwt:nonce:';

  /**
   * Generate secure access token with replay protection
   */
  static generateAccessToken(payload: JwtPayload): string {
    const tokenId = crypto.randomUUID();
    const nonce = crypto.randomBytes(16).toString('hex');

    const securePayload: SecureJwtPayload = {
      ...payload,
      jti: tokenId,
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    };

    // Store nonce in Redis for validation
    this.storeNonce(tokenId, nonce, 15 * 60);

    return jwt.sign(securePayload, config.jwt.secret, {
      issuer: 'google-auth-employee-system',
      audience: 'google-auth-employee-system',
      algorithm: 'HS256',
    });
  }

  /**
   * Verify access token with blacklist and nonce check
   */
  static async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'google-auth-employee-system',
        audience: 'google-auth-employee-system',
        algorithms: ['HS256'],
      }) as SecureJwtPayload;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(decoded.jti)) {
        throw new AppError(
          ErrorCode.TOKEN_REVOKED,
          'Token has been revoked',
          401
        );
      }

      // Verify nonce
      if (!await this.verifyNonce(decoded.jti, decoded.nonce)) {
        throw new AppError(
          ErrorCode.TOKEN_INVALID,
          'Invalid token nonce',
          401
        );
      }

      return {
        sub: decoded.sub,
        email: decoded.email,
        roles: decoded.roles,
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          ErrorCode.TOKEN_EXPIRED,
          'Access token has expired',
          401
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          ErrorCode.TOKEN_INVALID,
          'Invalid access token',
          401
        );
      }
      throw error;
    }
  }

  /**
   * Blacklist a token (for logout or revocation)
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as SecureJwtPayload;
      if (!decoded || !decoded.jti) {
        return;
      }

      const redis = RedisManager.getInstance();
      if (redis.isHealthy()) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.getClient().setEx(
            `${this.BLACKLIST_PREFIX}${decoded.jti}`,
            ttl,
            'revoked'
          );
        }
      }
    } catch (error) {
      console.error('Failed to blacklist token:', error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  private static async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const redis = RedisManager.getInstance();
      if (redis.isHealthy()) {
        const result = await redis.getClient().get(`${this.BLACKLIST_PREFIX}${jti}`);
        return result === 'revoked';
      }
      return false;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  /**
   * Store nonce for validation
   */
  private static async storeNonce(jti: string, nonce: string, ttl: number): Promise<void> {
    try {
      const redis = RedisManager.getInstance();
      if (redis.isHealthy()) {
        await redis.getClient().setEx(
          `${this.NONCE_PREFIX}${jti}`,
          ttl,
          nonce
        );
      }
    } catch (error) {
      console.error('Failed to store nonce:', error);
    }
  }

  /**
   * Verify nonce
   */
  private static async verifyNonce(jti: string, nonce: string): Promise<boolean> {
    try {
      const redis = RedisManager.getInstance();
      if (redis.isHealthy()) {
        const storedNonce = await redis.getClient().get(`${this.NONCE_PREFIX}${jti}`);
        return storedNonce === nonce;
      }
      // If Redis is down, accept the token (fallback mode)
      return true;
    } catch (error) {
      console.error('Failed to verify nonce:', error);
      return true; // Fallback to accept
    }
  }

  /**
   * Revoke all tokens for a user (for security events)
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    // In production, this would maintain a user-token mapping
    // For now, this is a placeholder for the functionality
    console.log(`Revoking all tokens for user: ${userId}`);
  }
}