import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwtService';
import { AuthenticatedRequest, AppError, ErrorCode } from '../types';

/**
 * Cookie-based JWT認証ミドルウェア
 * HttpOnly cookies を使用してXSS攻撃を防止
 */
export async function authenticateTokenFromCookie(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // HttpOnly cookieからトークンを取得
    const token = req.cookies?.access_token;

    if (!token) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        '認証トークンが必要です',
        401
      );
    }

    const payload = await JwtService.verifyAccessToken(token);
    req.user = payload;
    req.sessionId = payload.sessionId;

    // セッションアクティビティを更新
    await JwtService.updateSessionActivity(payload.sessionId);

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    
    next(new AppError(
      ErrorCode.UNAUTHORIZED,
      '認証に失敗しました',
      401
    ));
  }
}

/**
 * オプショナルクッキー認証ミドルウェア
 * トークンがある場合のみ検証
 */
export async function optionalAuthFromCookie(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.access_token;

    if (token) {
      const payload = await JwtService.verifyAccessToken(token);
      req.user = payload;
      req.sessionId = payload.sessionId;
      
      // セッションアクティビティを更新
      await JwtService.updateSessionActivity(payload.sessionId);
    }

    next();
  } catch (error) {
    // オプショナル認証の場合はエラーを無視
    next();
  }
}

/**
 * クッキーにトークンを設定するヘルパー関数
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  // Access token (15分間有効, HttpOnly, Secure in production)
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15分
    path: '/',
  });

  // Refresh token (7日間有効, HttpOnly, Secure in production)
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
    path: '/',
  });
}

/**
 * 認証クッキーをクリアするヘルパー関数
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}