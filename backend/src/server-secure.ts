import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { RedisManager } from './config/redisManager';
import { SessionService } from './services/sessionService';
import { CacheService } from './services/cacheService';
import { CsrfProtection } from './middleware/csrfProtection';
import { InputSanitization } from './middleware/inputSanitization';
import { setCookieSecurityHeaders } from './middleware/secureCookieAuth';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { Router } from 'express';
import { AuthControllerSecure } from './controllers/authControllerSecure';

// Auth routes
const authRouter = Router();
authRouter.get('/google', AuthControllerSecure.getGoogleAuthUrl);
authRouter.post('/google/callback', AuthControllerSecure.googleCallback);
authRouter.post('/logout', AuthControllerSecure.logout);
authRouter.get('/csrf-token', CsrfProtection.getTokenEndpoint());

async function startSecureServer() {
  try {
    // Initialize Redis
    const redisManager = RedisManager.getInstance();
    await redisManager.connect();
    console.log('✅ Redis Manager接続が確立されました');
    
    // Start cleanup schedulers
    SessionService.startCleanupScheduler();
    CacheService.startCleanupScheduler();
    console.log('✅ クリーンアップスケジューラーが開始されました');

    // Create Express app
    const app = express();

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // Cookie security headers
    app.use((req, res, next) => {
      setCookieSecurityHeaders(res);
      next();
    });

    // CORS
    app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    }));

    // Body parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.use(cookieParser());

    // Input sanitization
    app.use(InputSanitization.preventSqlInjection());
    app.use(InputSanitization.authInputValidation());

    // Rate limiting
    app.use('/api', apiLimiter);

    // CSRF protection (except for auth endpoints)
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/auth/google')) {
        return next();
      }
      return CsrfProtection.middleware()(req, res, next);
    });

    // Health check
    app.get('/health', (req, res) => {
      const redisHealth = redisManager.isHealthy();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv,
        services: {
          redis: redisHealth ? 'healthy' : 'degraded',
          security: 'enhanced',
        },
      });
    });

    // API routes
    app.use('/api/auth', authRouter);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    });

    // Error handler
    app.use(errorHandler);

    // Start server
    const PORT = config.server.port;
    app.listen(PORT, () => {
      console.log(`
🔒 Secure Server Started
📍 URL: http://localhost:${PORT}
🌍 Environment: ${config.server.nodeEnv}
🛡️  Security: Enhanced
📅 Started: ${new Date().toLocaleString('ja-JP')}
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await redisManager.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await redisManager.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Start server
startSecureServer();