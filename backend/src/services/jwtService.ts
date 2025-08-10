import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../app';
import { config } from '../config/env';
import { 
  JwtPayload, 
  AppError, 
  ErrorCode,
  AuditEventType,
  AuditSeverity 
} from '../types';
import { auditService } from './auditService';

export class JwtService {
  /**
   * アクセストークンの生成
   */
  static generateAccessToken(payload: JwtPayload): string {
    // ペイロードから不要なフィールドを削除
    const cleanPayload = {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sessionId,
    };
    
    return jwt.sign(cleanPayload, config.jwt.secret, {
      expiresIn: config.jwt.accessTokenExpiresIn,
      issuer: 'google-auth-employee-system',
      audience: 'google-auth-employee-system',
    } as jwt.SignOptions);
  }

  /**
   * リフレッシュトークンの生成と保存
   */
  static async generateRefreshToken(
    employeeId: number,
    sessionId: string,
    clientInfo?: string,
    ipAddress?: string
  ): Promise<string> {
    // エントロピーを増やして128バイトのランダムトークンを生成
    const token = crypto.randomBytes(128).toString('base64url');
    
    // SHA-512を使用してより強力なハッシュを生成
    const hashedToken = crypto
      .createHash('sha512')
      .update(token)
      .digest('hex');

    // 有効期限を計算
    const expiresAt = new Date();
    const refreshDays = parseInt(config.jwt.refreshTokenExpiresIn) || 7;
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    // データベースに保存
    await prisma.refreshToken.create({
      data: {
        token: hashedToken,
        employeeId,
        clientInfo,
        ipAddress,
        expiresAt,
      },
    });

    // 古いトークンを削除
    await this.cleanupExpiredTokens();

    return token;
  }

  /**
   * アクセストークンの検証
   */
  static async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'google-auth-employee-system',
        audience: 'google-auth-employee-system',
      }) as JwtPayload;

      // セッションの存在確認
      const session = await prisma.session.findUnique({
        where: { sessionId: decoded.sessionId },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new AppError(
          ErrorCode.INVALID_TOKEN,
          'セッションが無効です',
          401
        );
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          ErrorCode.TOKEN_EXPIRED,
          'アクセストークンの有効期限が切れています',
          401
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        await auditService.log({
          eventType: AuditEventType.INVALID_TOKEN_USED,
          severity: AuditSeverity.HIGH,
          resource: 'auth',
          action: 'verify_token',
          result: 'failure',
          details: { error: error.message },
        });
        
        throw new AppError(
          ErrorCode.INVALID_TOKEN,
          '無効なアクセストークンです',
          401
        );
      }

      throw error;
    }
  }

  /**
   * リフレッシュトークンの検証と更新
   */
  static async verifyAndRefreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; payload: JwtPayload }> {
    // トークンのハッシュを計算（SHA-512を使用）
    const hashedToken = crypto
      .createHash('sha512')
      .update(refreshToken)
      .digest('hex');

    // タイミング攻撃を防ぐため、全ての有効なトークンを取得
    const tokenRecords = await prisma.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: {
        employee: {
          include: {
            employeeRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    // 定時間比較でトークンを検証
    const tokenRecord = tokenRecords.find(record => {
      try {
        const recordHash = Buffer.from(record.token, 'hex');
        const providedHash = Buffer.from(hashedToken, 'hex');
        return recordHash.length === providedHash.length && 
               crypto.timingSafeEqual(recordHash, providedHash);
      } catch {
        return false;
      }
    });

    if (!tokenRecord) {
      await auditService.log({
        eventType: AuditEventType.INVALID_TOKEN_USED,
        severity: AuditSeverity.HIGH,
        ipAddress,
        userAgent,
        resource: 'auth',
        action: 'refresh_token',
        result: 'failure',
        details: { error: 'Token not found' },
      });
      
      throw new AppError(
        ErrorCode.INVALID_TOKEN,
        '無効なリフレッシュトークンです',
        401
      );
    }

    // トークンが失効されているか確認
    if (tokenRecord.revokedAt) {
      await auditService.log({
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        severity: AuditSeverity.CRITICAL,
        employeeId: tokenRecord.employeeId,
        ipAddress,
        userAgent,
        resource: 'auth',
        action: 'refresh_token',
        result: 'failure',
        details: { error: 'Revoked token used' },
      });
      
      throw new AppError(
        ErrorCode.INVALID_TOKEN,
        'このトークンは失効されています',
        401
      );
    }

    // 有効期限を確認
    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'リフレッシュトークンの有効期限が切れています',
        401
      );
    }

    // IPアドレスの検証（オプション）
    if (tokenRecord.ipAddress && tokenRecord.ipAddress !== ipAddress) {
      await auditService.logSuspiciousActivity(
        'Refresh token used from different IP',
        {
          originalIp: tokenRecord.ipAddress,
          currentIp: ipAddress,
          tokenId: tokenRecord.id,
        },
        tokenRecord.employeeId,
        ipAddress,
        userAgent
      );
    }

    // 新しいセッションIDを生成
    const newSessionId = crypto.randomUUID();

    // JWTペイロードを作成
    const payload: JwtPayload = {
      sub: tokenRecord.employee.employeeId,
      email: tokenRecord.employee.email,
      roles: tokenRecord.employee.employeeRoles.map(er => er.role.roleCode),
      sessionId: newSessionId,
    };

    // 新しいアクセストークンを生成
    const newAccessToken = this.generateAccessToken(payload);

    // 古いトークンを失効化
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // 新しいリフレッシュトークンを生成
    const newRefreshToken = await this.generateRefreshToken(
      tokenRecord.employeeId,
      newSessionId,
      userAgent,
      ipAddress
    );

    // 新しいセッションを作成
    await this.createSession(
      tokenRecord.employeeId,
      newSessionId,
      ipAddress,
      userAgent
    );

    // 監査ログに記録
    await auditService.log({
      eventType: AuditEventType.TOKEN_REFRESH,
      severity: AuditSeverity.LOW,
      employeeId: tokenRecord.employeeId,
      ipAddress,
      userAgent,
      resource: 'auth',
      action: 'refresh_token',
      result: 'success',
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      payload,
    };
  }

  /**
   * セッションの作成
   */
  static async createSession(
    employeeId: number,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24時間

    await prisma.session.create({
      data: {
        sessionId,
        employeeId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });
  }

  /**
   * セッションの更新（最終アクティビティ）
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { sessionId },
      data: { lastActivity: new Date() },
    });
  }

  /**
   * トークンの失効化
   */
  static async revokeRefreshToken(token: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha512')
      .update(token)
      .digest('hex');

    await prisma.refreshToken.update({
      where: { token: hashedToken },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * ユーザーの全トークンを失効化
   */
  static async revokeAllUserTokens(employeeId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        employeeId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 期限切れトークンの削除
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30日以上古い

    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: cutoffDate } },
        ],
      },
    });

    // 期限切れセッションも削除
    await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}