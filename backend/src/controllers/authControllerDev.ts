import { Request, Response, NextFunction } from 'express';
import { GoogleAuthServiceDev } from '../services/googleAuthServiceDev';
import { JwtService } from '../services/jwtService';
import { setAuthCookies, clearAuthCookies } from '../middleware/cookieAuth';
import crypto from 'crypto';

export class AuthControllerDev {
  static async getGoogleAuthUrl(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const { authUrl, state } = await GoogleAuthServiceDev.generateAuthUrl(ipAddress);

      res.json({
        success: true,
        data: { authUrl, state },
      });
    } catch (error) {
      next(error);
    }
  }

  static async googleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code, state } = req.body;
      
      if (!code || !state) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '認証コードまたはstateが不足しています',
          },
        });
        return;
      }

      const sessionId = crypto.randomBytes(32).toString('base64url');
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await GoogleAuthServiceDev.validateAuthCode(
        code,
        state,
        sessionId,
        ipAddress,
        userAgent
      );

      // Generate JWT tokens
      const accessToken = JwtService.generateAccessToken({
        sub: result.employee.id.toString(),
        email: result.employee.email,
        roles: result.employee.roles.map((r: any) => r.name),
        sessionId,
      });

      // Generate refresh token (simplified for dev)
      const refreshToken = crypto.randomBytes(64).toString('base64url');

      // Set cookies
      setAuthCookies(res, accessToken, refreshToken);

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: result.employee.id,
            email: result.employee.email,
            firstName: result.employee.firstName,
            lastName: result.employee.lastName,
            avatarUrl: result.employee.avatarUrl,
            roles: result.employee.roles.map((r: any) => r.name),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'リフレッシュトークンが必要です',
          },
        });
        return;
      }

      const decoded = await JwtService.verifyAndRefreshToken(refreshToken);
      
      // Generate new access token
      const accessToken = JwtService.generateAccessToken({
        sub: '1',
        email: 'test@example.com',
        roles: ['EMPLOYEE'],
        sessionId: 'test-session',
      });

      setAuthCookies(res, accessToken, refreshToken);

      res.json({
        success: true,
        data: { accessToken },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        });
        return;
      }

      const token = authHeader.substring(7);
      const decoded = await JwtService.verifyAccessToken(token);

      res.json({
        success: true,
        data: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['EMPLOYEE'],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      clearAuthCookies(res);
      
      res.json({
        success: true,
        data: { message: 'ログアウトしました' },
      });
    } catch (error) {
      next(error);
    }
  }
}