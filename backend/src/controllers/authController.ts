import { Request, Response, NextFunction } from 'express';
import { GoogleAuthService } from '../services/googleAuthService';
import { JwtService } from '../services/jwtService';
import { auditService } from '../services/auditService';
import { prisma } from '../app';
import { setAuthCookies, clearAuthCookies } from '../middleware/cookieAuth';
import { 
  AuthenticatedRequest,
  ApiResponse,
  LoginResponse,
  AppError,
  ErrorCode,
  AuditEventType,
  AuditSeverity
} from '../types';
import crypto from 'crypto';

export class AuthController {
  /**
   * Google OAuth認証URLの取得
   * GET /api/auth/google
   */
  static async getGoogleAuthUrl(
    req: Request,
    res: Response<ApiResponse<{ authUrl: string; state: string }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const { authUrl, state } = await GoogleAuthService.generateAuthUrl(ipAddress);

      res.json({
        success: true,
        data: { authUrl, state },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Google OAuthコールバック処理
   * POST /api/auth/google/callback
   */
  static async handleGoogleCallback(
    req: Request<Record<string, never>, Record<string, never>, { code: string; state: string }>,
    res: Response<ApiResponse<LoginResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code, state } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const sessionId = crypto.randomUUID();

      // 入力検証
      if (!code || !state) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          '認証コードまたはstateが不足しています',
          400
        );
      }

      // Google認証コードの検証
      const googleTokens = await GoogleAuthService.validateAuthCode(
        code,
        state,
        sessionId,
        ipAddress,
        userAgent
      );

      // Googleユーザー情報の取得
      const googleUser = await GoogleAuthService.getUserInfo(googleTokens.access_token);

      // ユーザーの検索または作成
      let employee = await prisma.employee.findUnique({
        where: { googleId: googleUser.id },
        include: {
          employeeRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!employee) {
        // メールアドレスで検索
        employee = await prisma.employee.findUnique({
          where: { email: googleUser.email },
          include: {
            employeeRoles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (employee) {
          // 既存ユーザーにGoogleIDを紐付け
          employee = await prisma.employee.update({
            where: { id: employee.id },
            data: {
              googleId: googleUser.id,
              lastLogin: new Date(),
            },
            include: {
              employeeRoles: {
                include: {
                  role: true,
                },
              },
            },
          });
        } else {
          // 新規ユーザー作成（デフォルト権限）
          const employeeId = `EMP${Date.now()}`;
          const defaultRole = await prisma.role.findUnique({
            where: { roleCode: 'EMPLOYEE' },
          });

          if (!defaultRole) {
            throw new AppError(
              ErrorCode.INTERNAL_SERVER_ERROR,
              'デフォルトロールが設定されていません',
              500
            );
          }

          employee = await prisma.employee.create({
            data: {
              employeeId,
              email: googleUser.email,
              googleId: googleUser.id,
              firstName: googleUser.given_name || '',
              lastName: googleUser.family_name || '',
              lastLogin: new Date(),
              employeeRoles: {
                create: {
                  roleId: defaultRole.id,
                },
              },
            },
            include: {
              employeeRoles: {
                include: {
                  role: true,
                },
              },
            },
          });

          await auditService.log({
            eventType: AuditEventType.USER_CREATED,
            severity: AuditSeverity.LOW,
            employeeId: employee.id,
            ipAddress,
            userAgent,
            resource: 'users',
            action: 'create',
            result: 'success',
            details: { source: 'google_oauth' },
          });
        }
      } else {
        // ログイン時刻を更新
        await prisma.employee.update({
          where: { id: employee.id },
          data: { lastLogin: new Date() },
        });
      }

      // アクティブチェック
      if (!employee.isActive) {
        await auditService.logLoginFailed(
          employee.email,
          'Account is deactivated',
          ipAddress,
          userAgent
        );
        throw new AppError(
          ErrorCode.FORBIDDEN,
          'アカウントが無効化されています',
          403
        );
      }

      // JWTペイロードの作成
      const roles = employee.employeeRoles.map(er => er.role.roleCode);
      const jwtPayload = {
        sub: employee.employeeId,
        email: employee.email,
        roles,
        sessionId,
      };

      // トークンの生成
      const accessToken = JwtService.generateAccessToken(jwtPayload);
      const refreshToken = await JwtService.generateRefreshToken(
        employee.id,
        sessionId,
        userAgent,
        ipAddress
      );

      // セッションの作成
      await JwtService.createSession(
        employee.id,
        sessionId,
        ipAddress,
        userAgent
      );

      // ログイン成功の記録
      await auditService.logLoginSuccess(
        employee.id,
        ipAddress,
        userAgent
      );

      // HttpOnly cookieにトークンを設定
      setAuthCookies(res, accessToken, refreshToken);

      // レスポンス（トークンは含めない - cookieに設定済み）
      const response = {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department || undefined,
          position: employee.position || undefined,
          roles,
        },
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * トークンリフレッシュ
   * POST /api/auth/refresh
   */
  static async refreshToken(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!refreshToken) {
        // Cookie認証の場合はクッキーをクリア
        clearAuthCookies(res);
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'リフレッシュトークンが必要です',
          400
        );
      }

      const result = await JwtService.verifyAndRefreshToken(
        refreshToken,
        ipAddress,
        userAgent
      );

      // 新しいトークンをHttpOnly cookieに設定
      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.json({
        success: true,
        data: { message: 'トークンが更新されました' },
      });
    } catch (error) {
      // エラー時はクッキーをクリア
      clearAuthCookies(res);
      next(error);
    }
  }

  /**
   * ログアウト
   * POST /api/auth/logout
   */
  static async logout(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token;
      const sessionId = req.sessionId;
      const userId = req.user?.sub;

      // リフレッシュトークンの失効化
      if (refreshToken) {
        await JwtService.revokeRefreshToken(refreshToken);
      }

      // セッションの削除
      if (sessionId) {
        await prisma.session.delete({
          where: { sessionId },
        }).catch(() => { 
          // セッションが存在しない場合のエラーを無視
        });
      }

      // ログアウトの記録
      if (userId) {
        const employee = await prisma.employee.findUnique({
          where: { employeeId: userId },
        });
        
        if (employee) {
          await auditService.log({
            eventType: AuditEventType.LOGOUT,
            severity: AuditSeverity.LOW,
            employeeId: employee.id,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            resource: 'auth',
            action: 'logout',
            result: 'success',
          });
        }
      }

      // HttpOnly cookieをクリア
      clearAuthCookies(res);

      res.json({
        success: true,
        data: { message: 'ログアウトしました' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 現在のユーザー情報の取得
   * GET /api/auth/me
   */
  static async getCurrentUser(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          '認証が必要です',
          401
        );
      }

      const employee = await prisma.employee.findUnique({
        where: { employeeId: userId },
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

      // 権限情報の集約
      const permissions = new Set<string>();
      employee.employeeRoles.forEach(er => {
        er.role.rolePermissions.forEach(rp => {
          permissions.add(rp.permission.permissionCode);
        });
      });

      res.json({
        success: true,
        data: {
          id: employee.id,
          employeeId: employee.employeeId,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department || undefined,
          position: employee.position || undefined,
          roles: employee.employeeRoles.map(er => er.role.roleCode),
          permissions: Array.from(permissions),
          isActive: employee.isActive,
          lastLogin: employee.lastLogin,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}