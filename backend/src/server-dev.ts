import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { RedisManager } from './config/redisManager';
import { SessionService } from './services/sessionService';
import { CacheService } from './services/cacheService';
import authRoutes from './routes/authRoutesDev';
// import employeeRoutes from './routes/employees';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

async function startServer() {
  try {
    // Redis Manager初期化とRedis接続
    const redisManager = RedisManager.getInstance();
    await redisManager.connect();
    console.log('✅ Redis Manager接続が確立されました');
    
    // セッションとキャッシュのクリーンアップスケジューラーを開始
    SessionService.startCleanupScheduler();
    CacheService.startCleanupScheduler();
    console.log('✅ クリーンアップスケジューラーが開始されました');

    // Expressアプリケーションの作成
    const app = express();

    // セキュリティヘッダー設定
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS設定
    app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // ボディパーサー
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // レート制限
    app.use('/api', apiLimiter);

    // ヘルスチェック
    app.get('/health', (req, res) => {
      const redisHealth = redisManager.isHealthy();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        services: {
          redis: redisHealth ? 'healthy' : 'degraded',
          database: 'simulated'
        }
      });
    });

    // APIルート
    app.use('/api/auth', authRoutes);
    // app.use('/api/employees', employeeRoutes);

    // 404ハンドラー
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'リクエストされたリソースが見つかりません',
        },
      });
    });

    // エラーハンドラー
    app.use(errorHandler);

    // サーバー起動
    const PORT = config.server.port;
    app.listen(PORT, () => {
      console.log(`
🚀 開発サーバーが起動しました
📍 URL: http://localhost:${PORT}
🌍 環境: ${config.server.nodeEnv}
📅 起動時刻: ${new Date().toLocaleString('ja-JP')}
⚠️  注意: データベース接続はシミュレートモードです
      `);
    });

    // グレースフルシャットダウン
    process.on('SIGTERM', async () => {
      console.log('SIGTERM信号を受信しました。グレースフルシャットダウンを開始します...');
      await redisManager.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT信号を受信しました。グレースフルシャットダウンを開始します...');
      await redisManager.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ サーバー起動中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// サーバー起動
startServer();