import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwtService';
import { AuthenticatedRequest, AppError, ErrorCode } from '../types';

/**
 * JWTトークン認証ミドルウェア
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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
 * オプショナル認証ミドルウェア
 * トークンがある場合のみ検証
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

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