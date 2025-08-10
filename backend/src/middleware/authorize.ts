import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, AppError, ErrorCode } from '../types';
import { prisma } from '../app';
import { auditService } from '../services/auditService';

/**
 * ロールベースの認可ミドルウェア
 */
export function requireRole(...allowedRoles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          '認証が必要です',
          401
        );
      }

      const userRoles = req.user.roles || [];
      const hasRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRole) {
        // アクセス拒否の記録
        const employee = await prisma.employee.findUnique({
          where: { employeeId: req.user.sub },
        });

        if (employee) {
          await auditService.logAccessDenied(
            employee.id,
            req.path,
            req.method,
            `Required roles: ${allowedRoles.join(', ')}, User roles: ${userRoles.join(', ')}`,
            req.ip || req.socket.remoteAddress,
            req.headers['user-agent']
          );
        }

        throw new AppError(
          ErrorCode.FORBIDDEN,
          'この操作を実行する権限がありません',
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 権限ベースの認可ミドルウェア
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          '認証が必要です',
          401
        );
      }

      // ユーザーの権限を取得
      const employee = await prisma.employee.findUnique({
        where: { employeeId: req.user.sub },
        include: {
          employeeRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) {
        throw new AppError(
          ErrorCode.NOT_FOUND,
          'ユーザーが見つかりません',
          404
        );
      }

      // ユーザーの権限を集約
      const userPermissions = new Set<string>();
      employee.employeeRoles.forEach(er => {
        er.role.rolePermissions.forEach(rp => {
          if (rp.permission.isActive) {
            userPermissions.add(rp.permission.permissionCode);
          }
        });
      });

      // 必要な権限を持っているか確認
      const hasAllPermissions = requiredPermissions.every(perm => 
        userPermissions.has(perm)
      );

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter(
          perm => !userPermissions.has(perm)
        );

        await auditService.logAccessDenied(
          employee.id,
          req.path,
          req.method,
          `Missing permissions: ${missingPermissions.join(', ')}`,
          req.ip || req.socket.remoteAddress,
          req.headers['user-agent']
        );

        throw new AppError(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          '必要な権限がありません',
          403,
          { required: requiredPermissions, missing: missingPermissions }
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * リソースオーナーチェックミドルウェア
 * ユーザーが特定のリソースのオーナーであるか確認
 */
export function requireOwnership(resourceIdParam: string = 'id') {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          '認証が必要です',
          401
        );
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.sub;

      // リソースオーナーチェックのロジックはリソースによって異なる
      // ここでは簡単な例を示す
      if (resourceId !== userId) {
        // 管理者はアクセスを許可
        const userRoles = req.user.roles || [];
        if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN')) {
          const employee = await prisma.employee.findUnique({
            where: { employeeId: userId },
          });

          if (employee) {
            await auditService.logAccessDenied(
              employee.id,
              req.path,
              req.method,
              'Not resource owner',
              req.ip || req.socket.remoteAddress,
              req.headers['user-agent']
            );
          }

          throw new AppError(
            ErrorCode.FORBIDDEN,
            'このリソースにアクセスする権限がありません',
            403
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}