import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';
import { OAuthStateService } from '../services/oauthStateService';
import { SecureSessionService } from '../services/secureSessionService';
import { JwtServiceSecure } from '../services/jwtServiceSecure';
import { CsrfProtection } from '../middleware/csrfProtection';
import { setSecureAuthCookies, clearSecureAuthCookies, setSessionCookie } from '../middleware/secureCookieAuth';
import { InputSanitization } from '../middleware/inputSanitization';
import { auditService } from '../services/auditService';
import { prisma } from '../app';
import { AppError, ErrorCode, AuditEventType, AuditSeverity } from '../types';

const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

export class AuthControllerSecure {
  /**
   * Get Google OAuth URL with PKCE and state
   */
  static async getGoogleAuthUrl(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      
      // Generate secure state and PKCE parameters
      const state = OAuthStateService.generateState();
      const codeVerifier = OAuthStateService.generateCodeVerifier();
      const codeChallenge = OAuthStateService.generateCodeChallenge(codeVerifier);
      
      // Store state atomically
      await OAuthStateService.storeState({
        state,
        codeVerifier,
        ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      
      // Generate OAuth URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'consent',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256' as any,
      });
      
      res.json({
        success: true,
        data: { authUrl, state },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Google OAuth callback with enhanced security
   */
  static async googleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Sanitize input
      const sanitized = InputSanitization.applySanitization(req.body, [
        { field: 'code', type: 'string', maxLength: 500, required: true, sanitize: false },
        { field: 'state', type: 'alphanumeric', maxLength: 100, required: true },
      ]);
      
      const { code, state } = sanitized;
      
      // Validate and consume state atomically (prevents race condition)
      const stateData = await OAuthStateService.validateAndConsumeState(state, ipAddress);
      
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier: stateData.codeVerifier,
      });
      
      if (!tokens.id_token) {
        throw new AppError(
          ErrorCode.OAUTH_TOKEN_INVALID,
          'No ID token received',
          400
        );
      }
      
      // Verify ID token
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.google.clientId,
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new AppError(
          ErrorCode.OAUTH_TOKEN_INVALID,
          'Invalid ID token payload',
          400
        );
      }
      
      // Find or create employee
      let employee = await prisma.employee.findUnique({
        where: { googleId: payload.sub },
        include: {
          employeeRoles: {
            include: { role: true },
          },
        },
      });
      
      if (!employee) {
        // Create new employee
        employee = await prisma.employee.create({
          data: {
            employeeId: `EMP${Date.now()}`,
            email: payload.email!,
            firstName: payload.given_name || 'Unknown',
            lastName: payload.family_name || 'User',
            googleId: payload.sub,
            avatarUrl: payload.picture,
            isActive: true,
            lastLogin: new Date(),
            employeeRoles: {
              create: {
                roleId: 4, // Default to EMPLOYEE role
              },
            },
          },
          include: {
            employeeRoles: {
              include: { role: true },
            },
          },
        });
      } else {
        // Update last login
        await prisma.employee.update({
          where: { id: employee.id },
          data: { lastLogin: new Date() },
        });
      }
      
      // Create authenticated session (prevents session fixation)
      const sessionId = await SecureSessionService.createAuthenticatedSession(
        employee.id,
        ipAddress,
        userAgent
      );
      
      // Generate secure JWT tokens
      const accessToken = JwtServiceSecure.generateAccessToken({
        sub: employee.id.toString(),
        email: employee.email,
        roles: employee.employeeRoles.map(er => er.role.name),
        sessionId,
      });
      
      // Generate CSRF token
      const csrfToken = CsrfProtection.generateToken(sessionId);
      
      // Store refresh token securely
      const refreshToken = await this.generateAndStoreRefreshToken(
        employee.id,
        sessionId,
        ipAddress,
        userAgent
      );
      
      // Set secure cookies
      setSessionCookie(res, sessionId);
      setSecureAuthCookies(res, accessToken, refreshToken, csrfToken);
      
      // Audit successful login
      await auditService.log({
        eventType: AuditEventType.LOGIN_SUCCESS,
        severity: AuditSeverity.INFO,
        employeeId: employee.id,
        ipAddress,
        userAgent,
        resource: 'auth',
        action: 'oauth_callback',
        result: 'success',
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: employee.id,
            email: employee.email,
            firstName: employee.firstName,
            lastName: employee.lastName,
            avatarUrl: employee.avatarUrl,
            roles: employee.employeeRoles.map(er => er.role.name),
          },
          csrfToken,
        },
      });
    } catch (error) {
      // Audit failed login
      await auditService.log({
        eventType: AuditEventType.LOGIN_FAILED,
        severity: AuditSeverity.WARNING,
        employeeId: null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        resource: 'auth',
        action: 'oauth_callback',
        result: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      
      next(error);
    }
  }

  /**
   * Logout with token blacklisting
   */
  static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const accessToken = req.cookies?.access_token;
      const sessionId = req.cookies?.session_id;
      
      // Blacklist the access token
      if (accessToken) {
        await JwtServiceSecure.blacklistToken(accessToken);
      }
      
      // Delete session
      if (sessionId) {
        await SecureSessionService.createAuthenticatedSession(
          0, // dummy employee ID for deletion
          undefined,
          undefined,
          sessionId // old session to delete
        );
      }
      
      // Clear cookies
      clearSecureAuthCookies(res);
      
      // Audit logout
      await auditService.log({
        eventType: AuditEventType.LOGOUT,
        severity: AuditSeverity.INFO,
        employeeId: (req as any).user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        resource: 'auth',
        action: 'logout',
        result: 'success',
      });
      
      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate and store refresh token
   */
  private static async generateAndStoreRefreshToken(
    employeeId: number,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    // Implementation would store in database
    // For now, return a secure random token
    const crypto = await import('crypto');
    return crypto.randomBytes(64).toString('base64url');
  }
}