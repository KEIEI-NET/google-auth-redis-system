import { Router } from 'express';
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

export default router;