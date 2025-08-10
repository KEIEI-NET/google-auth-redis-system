import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { prisma } from '../app';
import { config } from '../config/env';
import { 
  GoogleTokenResponse, 
  GoogleUserInfo, 
  AppError,
  ErrorCode,
  AuditEventType,
  AuditSeverity
} from '../types';
import { auditService } from './auditService';

// Google OAuth2 クライアントの作成
const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

export class GoogleAuthService {
  /**
   * PKCE code_verifier の生成
   * 43-128文字のBase64URL文字列
   */
  static generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  /**
   * PKCE code_challenge の生成
   * code_verifierのSHA256ハッシュのBase64URL表現
   */
  static generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    return hash.digest('base64url');
  }

  /**
   * CSRF防止用のstateパラメータ生成
   */
  static generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Google OAuth認証URLの生成
   * PKCEとstate検証を含む
   */
  static async generateAuthUrl(ipAddress?: string): Promise<{ authUrl: string; state: string }> {
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // stateとcodeVerifierをデータベースに保存（CSRF対策）
    await prisma.oAuthState.create({
      data: {
        state,
        codeVerifier,
        redirectUri: config.google.redirectUri,
        ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分後に期限切れ
      },
    });

    // 期限切れのstateを削除
    await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

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
      // hd パラメータを設定する場合（Google Workspace限定）
      // hd: 'example.com'
    });

    return { authUrl, state };
  }

  /**
   * 認証コードの検証とトークン交換
   */
  static async validateAuthCode(
    code: string,
    state: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<GoogleTokenResponse> {
    try {
      // トランザクションでstate検証と更新を原子的に実行（レースコンディション対策）
      const oauthState = await prisma.$transaction(async (tx) => {
        const foundState = await tx.oAuthState.findUnique({
          where: { state },
        });

        if (!foundState) {
          await auditService.log({
            eventType: AuditEventType.LOGIN_FAILED,
            severity: AuditSeverity.HIGH,
            employeeId: null,
            ipAddress,
            userAgent,
            resource: 'auth',
            action: 'oauth_callback',
            result: 'failure',
            details: { error: 'Invalid state parameter' },
          });
          throw new AppError(
            ErrorCode.OAUTH_STATE_INVALID,
            '無効な認証リクエストです',
            400
          );
        }

        // state使用済みチェック
        if (foundState.used) {
          await auditService.log({
            eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
            severity: AuditSeverity.CRITICAL,
            employeeId: null,
            ipAddress,
            userAgent,
            resource: 'auth',
            action: 'oauth_callback',
            result: 'failure',
            details: { error: 'State already used' },
          });
          throw new AppError(
            ErrorCode.OAUTH_STATE_INVALID,
            '認証リクエストは既に使用されています',
            400
          );
        }

        // state期限チェック
        if (foundState.expiresAt < new Date()) {
          await auditService.log({
            eventType: AuditEventType.LOGIN_FAILED,
            severity: AuditSeverity.MEDIUM,
            employeeId: null,
            ipAddress,
            userAgent,
            resource: 'auth',
            action: 'oauth_callback',
            result: 'failure',
            details: { error: 'State expired' },
          });
          throw new AppError(
            ErrorCode.OAUTH_STATE_INVALID,
            '認証リクエストの有効期限が切れています',
            400
          );
        }

        // IPアドレス検証（オプション）
        if (foundState.ipAddress && foundState.ipAddress !== ipAddress) {
          await auditService.log({
            eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
            severity: AuditSeverity.HIGH,
            employeeId: null,
            ipAddress,
            userAgent,
            resource: 'auth',
            action: 'oauth_callback',
            result: 'failure',
            details: { 
              error: 'IP address mismatch',
              originalIp: foundState.ipAddress,
              currentIp: ipAddress
            },
          });
          // 本番環境では例外をスローすることを検討
          console.warn('OAuth state IP mismatch detected');
        }

        // トランザクション内でstateを使用済みに更新
        const updatedState = await tx.oAuthState.update({
          where: { id: foundState.id },
          data: { used: true },
        });

        return updatedState;
      });

      // 認証コードをトークンに交換（PKCEを含む）
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier: oauthState.codeVerifier,
      });

      if (!tokens.access_token || !tokens.id_token) {
        throw new AppError(
          ErrorCode.GOOGLE_AUTH_FAILED,
          'Googleからのトークン取得に失敗しました',
          500
        );
      }

      return {
        access_token: tokens.access_token,
        token_type: tokens.token_type || 'Bearer',
        expires_in: tokens.expiry_date ? 
          Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
        refresh_token: tokens.refresh_token || undefined,
        scope: tokens.scope || '',
        id_token: tokens.id_token,
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      await auditService.log({
        eventType: AuditEventType.LOGIN_FAILED,
        severity: AuditSeverity.HIGH,
        employeeId: null,
        ipAddress,
        userAgent,
        resource: 'auth',
        action: 'oauth_callback',
        result: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });

      throw new AppError(
        ErrorCode.GOOGLE_AUTH_FAILED,
        'Google認証に失敗しました',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Googleユーザー情報の取得
   */
  static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      // IDトークンを検証してユーザー情報を取得
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const response = await oauth2Client.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });

      const userInfo = response.data as GoogleUserInfo;

      // メールアドレスの検証
      if (!userInfo.email || !userInfo.verified_email) {
        throw new AppError(
          ErrorCode.GOOGLE_AUTH_FAILED,
          'メールアドレスが確認されていません',
          400
        );
      }

      return userInfo;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Googleユーザー情報の取得に失敗しました',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * IDトークンの検証
   */
  static async verifyIdToken(idToken: string): Promise<any> {
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new AppError(
          ErrorCode.INVALID_TOKEN,
          '無効なIDトークンです',
          401
        );
      }

      // hdクレームの検証（Google Workspace限定の場合）
      // if (payload.hd !== 'example.com') {
      //   throw new AppError(
      //     ErrorCode.FORBIDDEN,
      //     '組織外のアカウントはアクセスできません',
      //     403
      //   );
      // }

      return payload;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.INVALID_TOKEN,
        'IDトークンの検証に失敗しました',
        401,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * リフレッシュトークンを使用したアクセストークンの更新
   */
  static async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    try {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();

      return {
        access_token: credentials.access_token || '',
        token_type: credentials.token_type || 'Bearer',
        expires_in: credentials.expiry_date ? 
          Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
        refresh_token: credentials.refresh_token || undefined,
        scope: credentials.scope || '',
        id_token: credentials.id_token || '',
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.GOOGLE_AUTH_FAILED,
        'アクセストークンの更新に失敗しました',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}