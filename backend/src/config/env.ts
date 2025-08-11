import * as dotenv from 'dotenv';
import { z } from 'zod';

// 環境変数の読み込み
dotenv.config();

// 環境変数のスキーマ定義
const envSchema = z.object({
  // サーバー設定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  // データベース設定
  DATABASE_URL: z.string(),
  DATABASE_PASSWORD: z.string(),
  
  // Redis設定
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),
  
  // Google OAuth設定
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  
  // JWT設定
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  
  // セッション設定
  SESSION_SECRET: z.string().min(32),
  SESSION_EXPIRES_IN: z.string().default('24h'),
  
  // CORS設定
  ALLOWED_ORIGINS: z.string().default(''),
  
  // レートリミット設定
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15分
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  
  // ログ設定
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// 環境変数のバリデーション
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`環境変数の検証に失敗しました:\n${errors}`);
    }
    throw error;
  }
}

// 環境変数のエクスポート
export const env = validateEnv();

// 型エクスポート
export type Env = z.infer<typeof envSchema>;

// 設定オブジェクト
export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  },
  
  database: {
    url: env.DATABASE_URL,
    password: env.DATABASE_PASSWORD,
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    url: env.REDIS_PASSWORD 
      ? `redis://default:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`
      : `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
  },
  
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    accessTokenExpiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  },
  
  session: {
    secret: env.SESSION_SECRET,
    expiresIn: env.SESSION_EXPIRES_IN,
  },
  
  cors: {
    allowedOrigins: env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : [],
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  logging: {
    level: env.LOG_LEVEL,
  },
} as const;