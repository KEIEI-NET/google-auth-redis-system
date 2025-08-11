import * as crypto from 'crypto';
import { prisma } from '../app';
import { AppError, ErrorCode } from '../types';

interface OAuthStateData {
  state: string;
  codeVerifier: string;
  ipAddress?: string;
  expiresAt: Date;
  used?: boolean;
}

export class OAuthStateService {
  private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate secure random state
   */
  static generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code verifier
   */
  static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  static generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Store OAuth state with atomic operation
   */
  static async storeState(data: Omit<OAuthStateData, 'used'>): Promise<void> {
    await prisma.oAuthState.create({
      data: {
        state: data.state,
        codeVerifier: data.codeVerifier,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
      },
    });

    // Clean expired states
    await this.cleanExpiredStates();
  }

  /**
   * Validate and consume state atomically
   */
  static async validateAndConsumeState(
    state: string,
    ipAddress?: string
  ): Promise<OAuthStateData> {
    // Use transaction for atomic validation and consumption
    const result = await prisma.$transaction(async (tx) => {
      // Find the state
      const oauthState = await tx.oAuthState.findUnique({
        where: { state },
      });

      if (!oauthState) {
        throw new AppError(
          ErrorCode.OAUTH_STATE_INVALID,
          'Invalid state parameter',
          400
        );
      }

      // Check if already used (prevents race condition)
      if (oauthState.used) {
        throw new AppError(
          ErrorCode.OAUTH_STATE_INVALID,
          'State has already been used',
          400
        );
      }

      // Check expiration
      if (oauthState.expiresAt < new Date()) {
        throw new AppError(
          ErrorCode.OAUTH_STATE_EXPIRED,
          'State parameter has expired',
          400
        );
      }

      // Validate IP address if provided
      if (ipAddress && oauthState.ipAddress && oauthState.ipAddress !== ipAddress) {
        throw new AppError(
          ErrorCode.OAUTH_STATE_INVALID,
          'State validation failed - IP mismatch',
          400
        );
      }

      // Mark as used atomically
      await tx.oAuthState.update({
        where: { id: oauthState.id },
        data: { used: true },
      });

      return {
        state: oauthState.state,
        codeVerifier: oauthState.codeVerifier,
        ipAddress: oauthState.ipAddress || undefined,
        expiresAt: oauthState.expiresAt,
        used: true,
      };
    });

    return result;
  }

  /**
   * Clean expired states
   */
  static async cleanExpiredStates(): Promise<void> {
    try {
      await prisma.oAuthState.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              used: true,
              createdAt: { lt: new Date(Date.now() - this.STATE_TTL_MS) }
            },
          ],
        },
      });
    } catch (error) {
      console.error('Failed to clean expired states:', error);
    }
  }
}