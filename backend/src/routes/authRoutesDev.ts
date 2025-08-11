import { Router, Request, Response } from 'express';
import { AuthControllerDev } from '../controllers/authControllerDev';

const router = Router();

// Google OAuth認証
router.get('/google', AuthControllerDev.getGoogleAuthUrl);
router.post('/google/callback', AuthControllerDev.googleCallback);

// トークン管理
router.post('/refresh', AuthControllerDev.refreshToken);

// 認証状態確認
router.get('/me', AuthControllerDev.getCurrentUser);

// ログアウト
router.post('/logout', AuthControllerDev.logout);

// CSRFトークン取得エンドポイント（開発環境用）
router.get('/csrf-token', (req: Request, res: Response) => {
  // 開発環境向けの簡易実装
  res.status(401).json({
    success: false,
    error: {
      code: 'CSRF_NOT_IMPLEMENTED',
      message: 'CSRF token endpoint is not implemented in development mode'
    }
  });
});

export default router;