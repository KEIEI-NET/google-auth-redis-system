# バックエンド実装ガイド

## 概要

本ガイドでは、Google認証従業員管理システムのバックエンド実装について説明します。

## アーキテクチャ

### 技術スタック

- **言語**: TypeScript 5.0+
- **フレームワーク**: Express.js 4.18+
- **ORM**: Prisma 5.6+
- **データベース**: PostgreSQL 15+
- **セッションストア**: Redis 7+
- **認証**: Google OAuth 2.0 + JWT

### ディレクトリ構造

```
backend/
├── src/
│   ├── config/          # 設定ファイル
│   │   └── env.ts      # 環境変数管理
│   ├── controllers/     # APIコントローラー
│   │   └── authController.ts
│   ├── services/        # ビジネスロジック
│   │   ├── googleAuthService.ts
│   │   ├── jwtService.ts
│   │   └── auditService.ts
│   ├── middleware/      # ミドルウェア
│   │   ├── auth.ts
│   │   ├── authorize.ts
│   │   ├── validateRequest.ts
│   │   └── errorHandler.ts
│   ├── routes/          # ルート定義
│   │   └── authRoutes.ts
│   ├── types/           # TypeScript型定義
│   │   └── index.ts
│   ├── utils/           # ユーティリティ
│   ├── app.ts           # Expressアプリケーション
│   └── server.ts        # サーバー起動
├── prisma/
│   ├── schema.prisma    # データベーススキーマ
│   └── seeds/
│       └── seed.ts      # シードデータ
└── .env                 # 環境変数
```

## 主要コンポーネント

### 1. 環境変数管理 (config/env.ts)

zodを使用した型安全な環境変数管理：

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_PASSWORD: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  JWT_SECRET: z.string().min(32),
  // ...その他の設定
});

export const env = envSchema.parse(process.env);
```

### 2. Google OAuthサービス

#### PKCE実装

```typescript
// code_verifierの生成
static generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url');
}

// code_challengeの生成
static generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(codeVerifier);
  return hash.digest('base64url');
}
```

#### State検証

```typescript
// Stateの保存と検証
await prisma.oAuthState.create({
  data: {
    state,
    codeVerifier,
    ipAddress,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分
  },
});
```

### 3. JWTトークン管理

#### アクセストークン（15分）

```typescript
static generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '15m',
    issuer: 'google-auth-employee-system',
    audience: 'google-auth-employee-system',
  });
}
```

#### リフレッシュトークン（7日間）

```typescript
static async generateRefreshToken(
  employeeId: number,
  sessionId: string
): Promise<string> {
  const token = crypto.randomBytes(64).toString('base64url');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  await prisma.refreshToken.create({
    data: {
      token: hashedToken,
      employeeId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  
  return token;
}
```

### 4. 認証ミドルウェア

```typescript
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '認証トークンが必要です', 401);
  }

  const payload = await JwtService.verifyAccessToken(token);
  req.user = payload;
  next();
}
```

### 5. 認可ミドルウェア

#### ロールベース

```typescript
export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      throw new AppError(ErrorCode.FORBIDDEN, '権限がありません', 403);
    }
    
    next();
  };
}
```

#### 権限ベース

```typescript
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ユーザーの権限を取得して検証
    const hasAllPermissions = requiredPermissions.every(perm => 
      userPermissions.has(perm)
    );
    
    if (!hasAllPermissions) {
      throw new AppError(ErrorCode.INSUFFICIENT_PERMISSIONS, '必要な権限がありません', 403);
    }
  };
}
```

## セキュリティ実装

### 1. Helmetによるセキュリティヘッダー

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 2. CORS設定

```typescript
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = config.cors.allowedOrigins;
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
```

### 3. 監査ログ

すべてのセキュリティイベントを記録：

```typescript
await auditService.log({
  eventType: AuditEventType.LOGIN_SUCCESS,
  severity: AuditSeverity.LOW,
  employeeId,
  ipAddress,
  userAgent,
  resource: 'auth',
  action: 'login',
  result: 'success',
});
```

## データベーススキーマ

### 主要テーブル

- **employees**: 従業員マスタデータ
- **roles**: ロール定義
- **permissions**: 権限定義
- **employee_roles**: 従業員とロールの関連
- **role_permissions**: ロールと権限の関連
- **refresh_tokens**: リフレッシュトークン管理
- **sessions**: セッション管理
- **audit_logs**: 監査ログ
- **oauth_states**: OAuthステート管理

## エラーハンドリング

### カスタムエラークラス

```typescript
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### グローバルエラーハンドラー

```typescript
export async function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  } else {
    // 予期しないエラーの処理
  }
}
```

## ベストプラクティス

1. **環境変数の検証**: zodを使用して起動時に検証
2. **型安全性**: TypeScriptの厳密モードを使用
3. **エラーハンドリング**: すべてのエラーを一元的に処理
4. **ログ**: 構造化ログでデバッグを容易に
5. **セキュリティ**: 最新のセキュリティベストプラクティスを適用