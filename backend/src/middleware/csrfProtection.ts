import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { AppError, ErrorCode } from '../types';

interface CsrfToken {
  token: string;
  createdAt: Date;
  sessionId: string;
}

export class CsrfProtection {
  private static tokens = new Map<string, CsrfToken>();
  private static readonly TOKEN_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Generate CSRF token
   */
  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    
    this.tokens.set(token, {
      token,
      createdAt: new Date(),
      sessionId,
    });

    // Clean old tokens
    this.cleanExpiredTokens();

    return token;
  }

  /**
   * Verify CSRF token
   */
  static verifyToken(token: string, sessionId: string): boolean {
    const storedToken = this.tokens.get(token);

    if (!storedToken) {
      return false;
    }

    // Check if token belongs to the session
    if (storedToken.sessionId !== sessionId) {
      return false;
    }

    // Check if token is expired
    const age = Date.now() - storedToken.createdAt.getTime();
    if (age > this.TOKEN_TTL) {
      this.tokens.delete(token);
      return false;
    }

    // Token is valid, delete it (single use)
    this.tokens.delete(token);
    return true;
  }

  /**
   * Clean expired tokens
   */
  private static cleanExpiredTokens(): void {
    const now = Date.now();
    for (const [key, value] of this.tokens.entries()) {
      const age = now - value.createdAt.getTime();
      if (age > this.TOKEN_TTL) {
        this.tokens.delete(key);
      }
    }
  }

  /**
   * Middleware for CSRF protection
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET requests and auth endpoints
      if (
        req.method === 'GET' ||
        req.method === 'HEAD' ||
        req.method === 'OPTIONS' ||
        req.path.startsWith('/api/auth/google')
      ) {
        return next();
      }

      // Get CSRF token from header or body
      const token = req.headers['x-csrf-token'] as string || req.body._csrf;
      
      if (!token) {
        throw new AppError(
          ErrorCode.CSRF_TOKEN_MISSING,
          'CSRF token is required',
          403
        );
      }

      // Get session ID from request
      const sessionId = (req as any).sessionId || req.cookies?.sessionId;
      
      if (!sessionId) {
        throw new AppError(
          ErrorCode.SESSION_INVALID,
          'Session is required for CSRF protection',
          403
        );
      }

      // Verify token
      if (!this.verifyToken(token, sessionId)) {
        throw new AppError(
          ErrorCode.CSRF_TOKEN_INVALID,
          'Invalid CSRF token',
          403
        );
      }

      next();
    };
  }

  /**
   * Endpoint to get CSRF token
   */
  static getTokenEndpoint() {
    return (req: Request, res: Response) => {
      const sessionId = (req as any).sessionId || req.cookies?.sessionId;
      
      if (!sessionId) {
        throw new AppError(
          ErrorCode.SESSION_INVALID,
          'Session is required',
          401
        );
      }

      const token = this.generateToken(sessionId);
      
      res.json({
        success: true,
        data: { csrfToken: token },
      });
    };
  }
}