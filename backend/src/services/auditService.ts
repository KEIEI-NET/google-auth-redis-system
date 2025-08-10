import { prisma } from '../app';
import { AuditEventType, AuditSeverity } from '../types';

interface AuditLogParams {
  eventType: AuditEventType;
  severity: AuditSeverity;
  employeeId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  action?: string | null;
  result?: string | null;
  details?: Record<string, unknown>;
  stackTrace?: string | null;
}

export class AuditService {
  /**
   * 監査ログの記録
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          eventType: params.eventType,
          severity: params.severity,
          employeeId: params.employeeId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          resource: params.resource,
          action: params.action,
          result: params.result,
          details: params.details as any,
          stackTrace: params.stackTrace,
        },
      });
    } catch (error) {
      // 監査ログの記録に失敗してもアプリケーションの動作を停止しない
      // eslint-disable-next-line no-console
      console.error('監査ログの記録に失敗しました:', error);
    }
  }

  /**
   * ログイン成功の記録
   */
  static async logLoginSuccess(
    employeeId: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGIN_SUCCESS,
      severity: AuditSeverity.LOW,
      employeeId,
      ipAddress,
      userAgent,
      resource: 'auth',
      action: 'login',
      result: 'success',
    });
  }

  /**
   * ログイン失敗の記録
   */
  static async logLoginFailed(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGIN_FAILED,
      severity: AuditSeverity.MEDIUM,
      employeeId: null,
      ipAddress,
      userAgent,
      resource: 'auth',
      action: 'login',
      result: 'failure',
      details: { email, reason },
    });
  }

  /**
   * アクセス拒否の記録
   */
  static async logAccessDenied(
    employeeId: number,
    resource: string,
    action: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.ACCESS_DENIED,
      severity: AuditSeverity.MEDIUM,
      employeeId,
      ipAddress,
      userAgent,
      resource,
      action,
      result: 'denied',
      details: { reason },
    });
  }

  /**
   * 疑わしいアクティビティの記録
   */
  static async logSuspiciousActivity(
    description: string,
    details: Record<string, unknown>,
    employeeId?: number | null,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.HIGH,
      employeeId,
      ipAddress,
      userAgent,
      resource: 'security',
      action: 'detect',
      result: 'alert',
      details: { description, ...details },
    });
  }

  /**
   * レートリミット超過の記録
   */
  static async logRateLimitExceeded(
    ipAddress: string,
    endpoint: string,
    employeeId?: number | null
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      severity: AuditSeverity.MEDIUM,
      employeeId,
      ipAddress,
      resource: 'api',
      action: 'rate_limit',
      result: 'blocked',
      details: { endpoint },
    });
  }

  /**
   * 監査ログの検索
   */
  static async search(params: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    employeeId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Array<{
    id: number;
    eventType: string;
    severity: string;
    employeeId: number | null;
    ipAddress: string | null;
    userAgent: string | null;
    resource: string | null;
    action: string | null;
    result: string | null;
    details: unknown;
    stackTrace: string | null;
    timestamp: Date;
    employee: {
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
  }>> {
    const where: Record<string, unknown> = {};

    if (params.eventType) where.eventType = params.eventType;
    if (params.severity) where.severity = params.severity;
    if (params.employeeId) where.employeeId = params.employeeId;
    
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) (where.timestamp as any).gte = params.startDate;
      if (params.endDate) (where.timestamp as any).lte = params.endDate;
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
      include: {
        employee: {
          select: {
            employeeId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * 古い監査ログの削除（データ保持ポリシーに基づく）
   */
  static async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

export const auditService = AuditService;