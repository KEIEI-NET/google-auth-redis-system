import * as crypto from 'crypto';
import { SessionService } from './sessionService';
import { AppError, ErrorCode } from '../types';

export class SecureSessionService {
  /**
   * Generate session ID only after successful authentication
   */
  static generateSessionId(): string {
    // Use 256 bits of entropy for session ID
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create session with regeneration (prevents session fixation)
   */
  static async createAuthenticatedSession(
    employeeId: number,
    ipAddress?: string,
    userAgent?: string,
    oldSessionId?: string
  ): Promise<string> {
    // Invalidate old session if exists
    if (oldSessionId) {
      await SessionService.deleteSession(oldSessionId);
    }

    // Generate new session ID after authentication
    const newSessionId = this.generateSessionId();

    // Create new session
    await SessionService.createSession(
      newSessionId,
      employeeId,
      ipAddress || '127.0.0.1',
      userAgent || 'Unknown'
    );

    return newSessionId;
  }

  /**
   * Rotate session ID (for privilege escalation)
   */
  static async rotateSessionId(
    oldSessionId: string,
    employeeId: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    // Get old session data
    const oldSession = await SessionService.getSession(oldSessionId);
    
    if (!oldSession || oldSession.employeeId !== employeeId) {
      throw new AppError(
        ErrorCode.SESSION_INVALID,
        'Invalid session for rotation',
        401
      );
    }

    // Create new session with same data but new ID
    const newSessionId = await this.createAuthenticatedSession(
      employeeId,
      ipAddress || oldSession.ipAddress,
      userAgent || oldSession.userAgent,
      oldSessionId
    );

    return newSessionId;
  }

  /**
   * Validate session with additional security checks
   */
  static async validateSession(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    const session = await SessionService.getSession(sessionId);

    if (!session) {
      return false;
    }

    // Check session expiry
    if (session.expiresAt && session.expiresAt < new Date()) {
      await SessionService.deleteSession(sessionId);
      return false;
    }

    // Validate IP address (optional strict mode)
    if (process.env.STRICT_SESSION_VALIDATION === 'true') {
      if (ipAddress && session.ipAddress !== ipAddress) {
        console.warn(`Session IP mismatch: expected ${session.ipAddress}, got ${ipAddress}`);
        return false;
      }

      // Validate User-Agent
      if (userAgent && session.userAgent !== userAgent) {
        console.warn(`Session User-Agent mismatch`);
        return false;
      }
    }

    // Update last activity
    await SessionService.updateSessionActivity(sessionId);

    return true;
  }
}