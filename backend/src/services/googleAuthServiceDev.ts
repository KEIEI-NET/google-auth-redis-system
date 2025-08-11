import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { config } from '../config/env';
import { SessionService } from './sessionService';

const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

// In-memory store for development
const oauthStateStore = new Map<string, {
  codeVerifier: string;
  ipAddress?: string;
  expiresAt: Date;
}>();

export class GoogleAuthServiceDev {
  private static generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private static generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  static async generateAuthUrl(ipAddress?: string): Promise<{ authUrl: string; state: string }> {
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Store in memory for development
    oauthStateStore.set(state, {
      codeVerifier,
      ipAddress,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    // Clean expired states
    for (const [key, value] of oauthStateStore.entries()) {
      if (value.expiresAt < new Date()) {
        oauthStateStore.delete(key);
      }
    }

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

    return { authUrl, state };
  }

  static async validateAuthCode(
    code: string,
    state: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    // Validate state
    const storedState = oauthStateStore.get(state);
    
    if (!storedState) {
      throw new Error('Invalid state parameter');
    }

    if (storedState.expiresAt < new Date()) {
      oauthStateStore.delete(state);
      throw new Error('State parameter expired');
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken({
      code,
      codeVerifier: storedState.codeVerifier,
    });

    oauth2Client.setCredentials(tokens);

    // Get user info
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Failed to get user information');
    }

    // Clean up used state
    oauthStateStore.delete(state);

    // Create session
    await SessionService.createSession(
      sessionId,
      1, // Mock employee ID for development
      ipAddress || '127.0.0.1',
      userAgent || 'Unknown'
    );

    // Return mock employee data
    return {
      employee: {
        id: 1,
        employeeId: 'EMP001',
        email: payload.email,
        firstName: payload.given_name || 'Test',
        lastName: payload.family_name || 'User',
        googleId: payload.sub,
        avatarUrl: payload.picture,
        roles: [{ name: 'EMPLOYEE', priority: 40 }],
        isActive: true,
      },
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
      },
    };
  }

  static async refreshAccessToken(refreshToken: string): Promise<any> {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiresIn: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  }
}