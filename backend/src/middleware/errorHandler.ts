import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ApiResponse } from '../types';
import { auditService } from '../services/auditService';
import { AuditEventType, AuditSeverity } from '../types';
import { ValidationError } from 'express-validator';

/**
 * グローバルエラーハンドラー
 */
export async function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  // 既にレスポンスが送信されている場合はnextに委譲
  if (res.headersSent) {
    return next(err);
  }

  // AppErrorの場合
  if (err instanceof AppError) {
    // セキュリティ関連のエラーを特別に処理
    const securityErrors = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.OAUTH_STATE_INVALID,
      ErrorCode.INVALID_TOKEN,
      ErrorCode.TOKEN_EXPIRED,
      ErrorCode.FORBIDDEN,
    ];

    const isSecurityError = securityErrors.includes(err.code);
    const severity = isSecurityError ? AuditSeverity.HIGH : 
                    err.statusCode >= 500 ? AuditSeverity.HIGH : 
                    AuditSeverity.MEDIUM;

    // 重大なエラーまたはセキュリティエラーの場合は監査ログに記録
    if (err.statusCode >= 500 || isSecurityError) {
      await auditService.log({
        eventType: isSecurityError ? AuditEventType.SUSPICIOUS_ACTIVITY : AuditEventType.SUSPICIOUS_ACTIVITY,
        severity,
        employeeId: (req as any).user?.employeeId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        resource: req.path,
        action: req.method,
        result: 'error',
        details: {
          errorCode: err.code,
          errorMessage: err.message,
          errorDetails: err.details,
        },
        stackTrace: err.statusCode >= 500 ? err.stack : undefined,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        ...(err.code === ErrorCode.RATE_LIMIT_EXCEEDED && {
          retryAfter: res.getHeader('Retry-After'),
        }),
      },
    });
    return;
  }

  // CORSエラーの処理
  if (err.message === 'CORS policy violation') {
    await auditService.log({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.MEDIUM,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      resource: req.path,
      action: req.method,
      result: 'blocked',
      details: {
        origin: req.headers.origin,
        error: 'CORS policy violation',
      },
    });

    res.status(403).json({
      success: false,
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'アクセスが拒否されました',
      },
    });
    return;
  }

  // バリデーションエラーの処理（express-validator）
  if (err.name === 'ValidationError' || (err as any).errors?.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: '入力データが不正です',
        details: (err as any).errors,
      },
    });
    return;
  }

  // 予期しないエラー
  console.error('予期しないエラー:', err);
  
  // 監査ログに記録
  await auditService.log({
    eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
    severity: AuditSeverity.CRITICAL,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    resource: req.path,
    action: req.method,
    result: 'error',
    details: {
      errorMessage: err.message,
      errorName: err.name,
    },
    stackTrace: err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'サーバーエラーが発生しました',
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          message: err.message,
          stack: err.stack,
        },
      }),
    },
  });
}