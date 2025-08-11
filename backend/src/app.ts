// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { config } from './config/env';

// ルートのインポート
import authRoutes from './routes/authRoutes';
import { adminRouter } from './routes/admin';
// import employeeRoutes from './routes/employeeRoutes';
// import permissionRoutes from './routes/permissionRoutes';

// ミドルウェアのインポート
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { redisClient } from './config/redis';
import { helmetConfig, securityHeaders, validateContentType } from './middleware/security';
import { xssPrevention } from './middleware/validation';

// Prismaクライアント (デバッグ用に詳細ログを有効化)
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export const createApp = (): Application => {
  const app = express();

  // セキュリティミドルウェア
  app.use(helmetConfig);
  app.use(securityHeaders);

  // CORS設定
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = config.cors.allowedOrigins;
      
      // 開発環境では localhost を許可
      if (config.isDevelopment) {
        allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
      }

      // オリジンがない場合（同一オリジン）
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24時間
  };

  app.use(cors(corsOptions));

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Cookie parser for httpOnly cookies
  app.use(cookieParser());
  
  // Content-Type validation
  app.use('/api', validateContentType);
  
  // XSS prevention
  app.use(xssPrevention);

  // 圧縮
  app.use(compression());

  // ロギング
  if (config.isDevelopment) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // レート制限（全体的なAPI制限）
  app.use('/api/', apiLimiter);

  // Trust proxy（プロキシ環境での使用）
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // ヘルスチェックエンドポイント
  app.get('/health', (req: Request, res: Response) => {
    void (async () => {
    try {
      // データベース接続確認
      await prisma.$queryRaw`SELECT 1`;
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: 'connected',
          redis: redisClient.isReady ? 'connected' : 'disconnected',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      });
    }
    })();
  });

  // APIルートエンドポイント
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      message: 'Google認証従業員管理システム API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        employees: '/api/employees',
        permissions: '/api/permissions',
      },
    });
  });

  // APIルートの登録
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRouter);
  // app.use('/api/employees', employeeRoutes);
  // app.use('/api/permissions', permissionRoutes);

  // 404ハンドラー
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'リクエストされたリソースが見つかりません',
        path: req.originalUrl,
      },
    });
  });

  // エラーハンドリングミドルウェア
  app.use(errorHandler);

  return app;
};