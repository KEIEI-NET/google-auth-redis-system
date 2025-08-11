import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authenticateTokenFromCookie } from '../middleware/cookieAuth';
import { oauthValidation } from '../middleware/validation';
import { authLimiter, refreshTokenLimiter, oauthInitLimiter } from '../middleware/rateLimiter';

const router = Router();

// Google OAuth認証URLの取得
router.get('/google', oauthInitLimiter, AuthController.getGoogleAuthUrl);

// Google OAuthコールバック
router.post(
  '/google/callback',
  authLimiter,
  ...oauthValidation.callback,
  AuthController.handleGoogleCallback
);

// トークンリフレッシュ
router.post(
  '/refresh',
  refreshTokenLimiter,
  ...oauthValidation.refresh,
  AuthController.refreshToken
);

// ログアウト（認証必須）
router.post(
  '/logout',
  authenticateTokenFromCookie,
  AuthController.logout
);

// 現在のユーザー情報（認証必須）
router.get(
  '/me',
  authenticateTokenFromCookie,
  AuthController.getCurrentUser
);

// CSRFトークン取得エンドポイント（開発環境用）
router.get('/csrf-token', authLimiter, (req: Request, res: Response) => {
  // 開発環境向けの簡易実装
  // 本番環境では CsrfProtection.getTokenEndpoint() を使用
  res.status(401).json({
    success: false,
    error: {
      code: 'CSRF_NOT_IMPLEMENTED',
      message: 'CSRF token endpoint is not implemented in development mode'
    }
  });
});

export default router;