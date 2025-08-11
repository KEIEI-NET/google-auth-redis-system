import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OAuthStateService } from '../../services/oauthStateService';
import { SecureSessionService } from '../../services/secureSessionService';
import { JwtServiceSecure } from '../../services/jwtServiceSecure';
import { CsrfProtection } from '../../middleware/csrfProtection';
import { InputSanitization } from '../../middleware/inputSanitization';
import { AppError, ErrorCode } from '../../types';

describe('Security Tests', () => {
  
  describe('OAuth State Race Condition Prevention', () => {
    it('should prevent race condition in state validation', async () => {
      const state = OAuthStateService.generateState();
      const codeVerifier = OAuthStateService.generateCodeVerifier();
      
      // Store state
      await OAuthStateService.storeState({
        state,
        codeVerifier,
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      
      // Try to validate same state twice (simulating race condition)
      const firstValidation = OAuthStateService.validateAndConsumeState(state, '127.0.0.1');
      const secondValidation = OAuthStateService.validateAndConsumeState(state, '127.0.0.1');
      
      // First should succeed
      await expect(firstValidation).resolves.toHaveProperty('state', state);
      
      // Second should fail (state already consumed)
      await expect(secondValidation).rejects.toThrow(AppError);
    });
    
    it('should validate IP address in state', async () => {
      const state = OAuthStateService.generateState();
      
      await OAuthStateService.storeState({
        state,
        codeVerifier: 'test',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      
      // Different IP should fail
      await expect(
        OAuthStateService.validateAndConsumeState(state, '192.168.1.2')
      ).rejects.toThrow(AppError);
    });
  });
  
  describe('Session Fixation Prevention', () => {
    it('should generate new session ID after authentication', async () => {
      const oldSessionId = 'old-session-123';
      
      // Create authenticated session
      const newSessionId = await SecureSessionService.createAuthenticatedSession(
        1,
        '127.0.0.1',
        'Mozilla/5.0',
        oldSessionId
      );
      
      // New session ID should be different
      expect(newSessionId).not.toBe(oldSessionId);
      expect(newSessionId).toHaveLength(43); // Base64url of 32 bytes
    });
    
    it('should rotate session ID on privilege escalation', async () => {
      const sessionId = SecureSessionService.generateSessionId();
      
      // Create initial session
      await SecureSessionService.createAuthenticatedSession(
        1,
        '127.0.0.1',
        'Mozilla/5.0'
      );
      
      // Rotate session
      const newSessionId = await SecureSessionService.rotateSessionId(
        sessionId,
        1,
        '127.0.0.1',
        'Mozilla/5.0'
      );
      
      expect(newSessionId).not.toBe(sessionId);
    });
  });
  
  describe('JWT Token Replay Prevention', () => {
    it('should include unique jti in tokens', () => {
      const token1 = JwtServiceSecure.generateAccessToken({
        sub: '1',
        email: 'test@example.com',
        roles: ['USER'],
        sessionId: 'session-123',
      });
      
      const token2 = JwtServiceSecure.generateAccessToken({
        sub: '1',
        email: 'test@example.com',
        roles: ['USER'],
        sessionId: 'session-123',
      });
      
      // Decode tokens to check jti
      const decoded1 = JSON.parse(Buffer.from(token1.split('.')[1], 'base64').toString());
      const decoded2 = JSON.parse(Buffer.from(token2.split('.')[1], 'base64').toString());
      
      expect(decoded1.jti).toBeDefined();
      expect(decoded2.jti).toBeDefined();
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
    
    it('should blacklist revoked tokens', async () => {
      const token = JwtServiceSecure.generateAccessToken({
        sub: '1',
        email: 'test@example.com',
        roles: ['USER'],
        sessionId: 'session-123',
      });
      
      // Blacklist token
      await JwtServiceSecure.blacklistToken(token);
      
      // Verification should fail
      await expect(
        JwtServiceSecure.verifyAccessToken(token)
      ).rejects.toThrow(AppError);
    });
  });
  
  describe('CSRF Protection', () => {
    it('should generate unique CSRF tokens', () => {
      const token1 = CsrfProtection.generateToken('session-123');
      const token2 = CsrfProtection.generateToken('session-123');
      
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
    
    it('should validate CSRF token with correct session', () => {
      const sessionId = 'session-123';
      const token = CsrfProtection.generateToken(sessionId);
      
      // Valid token and session
      expect(CsrfProtection.verifyToken(token, sessionId)).toBe(true);
      
      // Invalid session
      expect(CsrfProtection.verifyToken(token, 'wrong-session')).toBe(false);
    });
    
    it('should enforce single-use tokens', () => {
      const sessionId = 'session-123';
      const token = CsrfProtection.generateToken(sessionId);
      
      // First use should succeed
      expect(CsrfProtection.verifyToken(token, sessionId)).toBe(true);
      
      // Second use should fail
      expect(CsrfProtection.verifyToken(token, sessionId)).toBe(false);
    });
  });
  
  describe('Input Sanitization', () => {
    it('should sanitize email addresses', () => {
      const result = InputSanitization.applySanitization(
        { email: 'TEST@EXAMPLE.COM  ' },
        [{ field: 'email', type: 'email', required: true }]
      );
      
      expect(result.email).toBe('test@example.com');
    });
    
    it('should reject SQL injection attempts', () => {
      const middleware = InputSanitization.preventSqlInjection();
      const req = {
        query: { search: "'; DROP TABLE users; --" },
        body: {},
      } as any;
      const res = {} as any;
      const next = jest.fn();
      
      expect(() => middleware(req, res, next)).toThrow(AppError);
    });
    
    it('should escape HTML entities', () => {
      const result = InputSanitization.applySanitization(
        { name: '<script>alert("XSS")</script>' },
        [{ field: 'name', type: 'string', required: true }]
      );
      
      expect(result.name).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
    
    it('should validate alphanumeric fields', () => {
      expect(() => 
        InputSanitization.applySanitization(
          { code: 'abc123!@#' },
          [{ field: 'code', type: 'alphanumeric', required: true }]
        )
      ).toThrow(AppError);
      
      const valid = InputSanitization.applySanitization(
        { code: 'abc123_-' },
        [{ field: 'code', type: 'alphanumeric', required: true }]
      );
      expect(valid.code).toBe('abc123_-');
    });
  });
  
  describe('Timing Attack Prevention', () => {
    it('should use constant-time comparison for tokens', async () => {
      const token1 = 'a'.repeat(64);
      const token2 = 'b'.repeat(64);
      
      const start1 = process.hrtime.bigint();
      CsrfProtection.verifyToken(token1, 'session');
      const end1 = process.hrtime.bigint();
      
      const start2 = process.hrtime.bigint();
      CsrfProtection.verifyToken(token2, 'session');
      const end2 = process.hrtime.bigint();
      
      const time1 = Number(end1 - start1);
      const time2 = Number(end2 - start2);
      
      // Times should be similar (within 20% difference)
      const diff = Math.abs(time1 - time2);
      const avg = (time1 + time2) / 2;
      expect(diff / avg).toBeLessThan(0.2);
    });
  });
});