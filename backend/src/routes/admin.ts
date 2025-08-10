import express from 'express';
import { authenticateTokenFromCookie } from '../middleware/cookieAuth';
import { auditService } from '../services/auditService';
import { prisma } from '../app';
import { 
  AuthenticatedRequest,
  ApiResponse,
  AuditEventType,
  AuditSeverity
} from '../types';

const router = express.Router();

// 全てのルートに認証を適用
router.use(authenticateTokenFromCookie);

// 簡単な権限チェックミドルウェア
const requireAdminRole = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
  const userRoles = req.user?.roles || [];
  if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '管理者権限が必要です',
      },
    });
    return;
  }
  next();
};

/**
 * 監査ログ取得
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', requireAdminRole, async (
  req: AuthenticatedRequest,
  res: express.Response<ApiResponse>
): Promise<void> => {
  try {
    const {
      eventType,
      severity,
      employeeId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const auditLogs = await auditService.search({
      eventType: eventType as AuditEventType,
      severity: severity as AuditSeverity,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset,
    });

    res.json({
      success: true,
      data: {
        logs: auditLogs,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '監査ログの取得に失敗しました',
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

/**
 * 従業員統計取得
 * GET /api/admin/statistics
 */
router.get('/statistics', requireAdminRole, async (
  req: AuthenticatedRequest,
  res: express.Response<ApiResponse>
): Promise<void> => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      recentLogins
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.auditLog.count({
        where: {
          eventType: AuditEventType.LOGIN_SUCCESS,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // ロール別統計を取得
    const roleStats = await prisma.role.findMany({
      select: {
        roleCode: true,
        roleName: true,
        _count: {
          select: {
            employeeRoles: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        recentLogins,
        roleDistribution: roleStats.map(role => ({
          roleCode: role.roleCode,
          roleName: role.roleName,
          count: role._count.employeeRoles,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '統計情報の取得に失敗しました',
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

export { router as adminRouter };