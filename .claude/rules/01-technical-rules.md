# 技術実装ルール (Technical Implementation Rules)

## ⚠️ 2025年重要更新

### Google OAuth 2.0の変更点
- **2025年3月14日**: Less Secure Apps (LSA) 完全廃止
- **必須**: すべてのアプリケーションでOAuth 2.0実装
- **Google固有要件**: Web ApplicationタイプではPKCE使用時もclient_secret必須

### 推奨アーキテクチャ
```
フロントエンド → バックエンドプロキシ → Google OAuth
（client_secretはバックエンドのみで管理）
```

## 1. コーディング規約

### 1.1 TypeScript必須要件
```typescript
// ✅ 正しい実装
interface User {
  id: number;
  email: string;
  name: string;
  roles: Role[];
}

// ❌ 避けるべき実装
const user: any = {  // anyの使用禁止
  id: 1,
  email: 'test@example.com'
};
```

### 1.2 命名規則
```typescript
// コンポーネント: PascalCase
export const UserProfile: React.FC = () => { };

// 関数: camelCase
export const validateEmail = (email: string): boolean => { };

// 定数: UPPER_SNAKE_CASE
export const MAX_LOGIN_ATTEMPTS = 5;

// インターフェース: PascalCase with 'I' prefix
export interface IAuthService { }

// 型: PascalCase with 'Type' suffix
export type UserType = 'admin' | 'employee' | 'viewer';

// ファイル名規則
// - コンポーネント: UserProfile.tsx
// - サービス: authService.ts
// - ユーティリティ: dateHelpers.ts
// - 定数: constants.ts
```

### 1.3 ディレクトリ構造の厳守
```
src/
├── components/     # UIコンポーネント
├── services/       # ビジネスロジック
├── hooks/          # カスタムフック
├── contexts/       # Reactコンテキスト
├── types/          # 型定義
├── utils/          # ユーティリティ関数
├── constants/      # 定数定義
└── tests/          # テストファイル
```

## 2. React実装ルール

### 2.1 コンポーネント設計原則
```typescript
// 機能コンポーネントのみ使用（クラスコンポーネント禁止）
// ✅ 正しい実装
const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  // カスタムフックの使用
  const { permissions } = usePermissions(user.id);
  
  // 早期リターンパターン
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <EmptyState />;
  
  return (
    <div className="user-profile">
      {/* コンテンツ */}
    </div>
  );
};

// ❌ 避けるべき実装
class UserProfile extends React.Component { } // クラスコンポーネント禁止
```

### 2.2 状態管理ルール
```typescript
// ローカル状態: useState
const [count, setCount] = useState(0);

// 複雑な状態: useReducer
const [state, dispatch] = useReducer(authReducer, initialState);

// グローバル状態: Context API
const AuthContext = createContext<AuthContextType | null>(null);

// 非同期状態: カスタムフック
const useAsyncData = <T,>(asyncFunction: () => Promise<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    asyncFunction()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  return { data, loading, error };
};
```

### 2.3 パフォーマンス最適化
```typescript
// メモ化の適切な使用
const ExpensiveComponent = React.memo(({ data }) => {
  // useMemoで計算結果をキャッシュ
  const processedData = useMemo(() => {
    return heavyComputation(data);
  }, [data]);
  
  // useCallbackで関数をメモ化
  const handleClick = useCallback(() => {
    console.log(data);
  }, [data]);
  
  return <div onClick={handleClick}>{processedData}</div>;
});

// 遅延ローディング
const Dashboard = React.lazy(() => import('./Dashboard'));

// Suspenseの使用
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

## 3. バックエンド実装ルール

### 3.1 Express.js構造
```typescript
// app.ts - アプリケーション設定
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import RedisStore from 'connect-redis';

const app = express();

// セキュリティミドルウェア（順序重要）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "https://lh3.googleusercontent.com"],
    },
  },
}));

// CORS設定
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// ボディパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// セッション設定
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8時間
    sameSite: 'strict',
  },
}));
```

### 3.2 コントローラーパターン
```typescript
// authController.ts
export class AuthController {
  constructor(
    private authService: IAuthService,
    private employeeService: IEmployeeService
  ) {}
  
  // 非同期エラーハンドリングを含む
  googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const { credential, codeVerifier } = req.body;
    
    // 入力検証
    if (!credential || !codeVerifier) {
      throw new ValidationError('認証情報が不足しています');
    }
    
    // サービス層に処理を委譲
    const result = await this.authService.authenticateWithGoogle(
      credential,
      codeVerifier
    );
    
    // レスポンス
    res.status(200).json({
      success: true,
      data: result,
    });
  });
}

// asyncHandlerユーティリティ
const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

### 3.3 サービス層の実装
```typescript
// employeeService.ts
export class EmployeeService implements IEmployeeService {
  constructor(private prisma: PrismaClient) {}
  
  async findByEmail(email: string): Promise<Employee | null> {
    // トランザクション使用
    return await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { email },
        include: {
          employeeRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      
      if (employee) {
        // 最終ログイン時刻を更新
        await tx.employee.update({
          where: { id: employee.id },
          data: { lastLogin: new Date() },
        });
      }
      
      return employee;
    });
  }
}
```

## 4. データベース実装ルール

### 4.1 Prisma Schema設計
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Employee {
  id            Int              @id @default(autoincrement())
  employeeId    String           @unique @map("employee_id")
  email         String           @unique @db.VarChar(255)
  firstName     String           @map("first_name") @db.VarChar(100)
  lastName      String           @map("last_name") @db.VarChar(100)
  department    String?          @db.VarChar(100)
  position      String?          @db.VarChar(100)
  hireDate      DateTime?        @map("hire_date") @db.Date
  isActive      Boolean          @default(true) @map("is_active")
  googleId      String?          @unique @map("google_id") @db.VarChar(255)
  lastLogin     DateTime?        @map("last_login")
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")
  
  employeeRoles EmployeeRole[]
  assignedBy    EmployeeRole[]   @relation("AssignedBy")
  
  @@map("employees")
  @@index([email])
  @@index([googleId])
}
```

### 4.2 データベースクエリ最適化
```typescript
// 最適化されたクエリ
// ✅ 必要なフィールドのみ選択
const employees = await prisma.employee.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    employeeRoles: {
      select: {
        role: {
          select: {
            roleCode: true,
            roleName: true,
          },
        },
      },
    },
  },
  where: {
    isActive: true,
    department: 'Engineering',
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 20, // ページネーション
  skip: 0,
});

// ❌ 避けるべき実装
const employees = await prisma.employee.findMany(); // 全件取得は禁止
```

### 4.3 トランザクション管理
```typescript
// 複数テーブル更新時はトランザクション必須
async assignRole(employeeId: number, roleId: number, assignedBy: number) {
  return await this.prisma.$transaction(async (tx) => {
    // 既存の役割を無効化
    await tx.employeeRole.updateMany({
      where: {
        employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    
    // 新しい役割を割り当て
    const newRole = await tx.employeeRole.create({
      data: {
        employeeId,
        roleId,
        assignedBy,
        assignedDate: new Date(),
        isActive: true,
      },
    });
    
    // 監査ログを記録
    await tx.auditLog.create({
      data: {
        action: 'ROLE_ASSIGNED',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        performedBy: assignedBy,
        details: JSON.stringify({ roleId }),
      },
    });
    
    return newRole;
  });
}
```

## 5. API設計ルール

### 5.1 RESTful API設計原則
```typescript
// ルート定義
router.get('/employees', getEmployees);        // 一覧取得
router.get('/employees/:id', getEmployee);     // 詳細取得
router.post('/employees', createEmployee);     // 新規作成
router.put('/employees/:id', updateEmployee);  // 更新
router.delete('/employees/:id', deleteEmployee); // 削除

// クエリパラメータの使用
// GET /api/employees?department=Engineering&isActive=true&page=1&limit=20
```

### 5.2 レスポンス形式の統一
```typescript
// 成功レスポンス
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// エラーレスポンス
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 実装例
res.status(200).json({
  success: true,
  data: {
    employees: [...],
  },
  meta: {
    page: 1,
    limit: 20,
    total: 100,
  },
});
```

### 5.3 HTTPステータスコードの適切な使用
```typescript
// 2xx: 成功
200 OK              // 取得・更新成功
201 Created         // 作成成功
204 No Content      // 削除成功

// 4xx: クライアントエラー
400 Bad Request     // 不正なリクエスト
401 Unauthorized    // 認証エラー
403 Forbidden       // 権限エラー
404 Not Found       // リソースが存在しない
409 Conflict        // 競合（重複など）
422 Unprocessable Entity // バリデーションエラー
429 Too Many Requests // レート制限

// 5xx: サーバーエラー
500 Internal Server Error // サーバーエラー
502 Bad Gateway          // ゲートウェイエラー
503 Service Unavailable  // サービス利用不可
```

## 6. 非同期処理ルール

### 6.1 Promise/Async-Await
```typescript
// ✅ async/awaitを使用
async function fetchEmployeeData(id: number): Promise<Employee> {
  try {
    const employee = await employeeService.findById(id);
    if (!employee) {
      throw new NotFoundError('従業員が見つかりません');
    }
    return employee;
  } catch (error) {
    logger.error('従業員データ取得エラー:', error);
    throw error;
  }
}

// ❌ コールバック地獄は避ける
function badExample(callback) {
  getData((err, data) => {
    if (err) callback(err);
    processData(data, (err, result) => {
      if (err) callback(err);
      callback(null, result);
    });
  });
}
```

### 6.2 並行処理の最適化
```typescript
// 並行実行可能な処理はPromise.allを使用
async function loadDashboardData(userId: number) {
  const [user, permissions, notifications] = await Promise.all([
    userService.findById(userId),
    permissionService.getByUserId(userId),
    notificationService.getUnread(userId),
  ]);
  
  return {
    user,
    permissions,
    notifications,
  };
}

// エラーを個別に処理する場合はPromise.allSettled
const results = await Promise.allSettled([
  fetchUserData(),
  fetchPermissions(),
  fetchNotifications(),
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Task ${index} succeeded:`, result.value);
  } else {
    console.error(`Task ${index} failed:`, result.reason);
  }
});
```

## 7. エラーハンドリングルール

### 7.1 カスタムエラークラス
```typescript
// 基底エラークラス
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// 具体的なエラークラス
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 422);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '認証に失敗しました') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'アクセス権限がありません') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}
```

### 7.2 グローバルエラーハンドラー
```typescript
// errorHandler.ts
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ログ記録
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });
  
  // AppErrorの場合
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
  }
  
  // Prismaエラーの場合
  if (err.name === 'PrismaClientKnownRequestError') {
    return handlePrismaError(err, res);
  }
  
  // その他のエラー
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '内部サーバーエラーが発生しました',
    },
  });
};
```

## 8. ロギングルール

### 8.1 ログレベルの使い分け
```typescript
// logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// 使用例
logger.debug('デバッグ情報', { userId: 123 });           // 開発時のデバッグ
logger.info('ユーザーがログインしました', { email });     // 通常の情報
logger.warn('非推奨のAPIが使用されました', { endpoint }); // 警告
logger.error('データベース接続エラー', { error });        // エラー
```

### 8.2 機密情報のマスキング
```typescript
// 機密情報を含むオブジェクトのサニタイズ
function sanitizeLog(obj: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization'];
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in sanitized) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLog(sanitized[key]);
    }
  }
  
  return sanitized;
}

// 使用例
logger.info('API Request', sanitizeLog({
  url: '/api/auth/login',
  body: {
    email: 'user@example.com',
    password: 'secret123', // これは[REDACTED]になる
  },
}));
```

## 9. テスト実装ルール

### 9.1 単体テストの書き方
```typescript
// authService.test.ts
describe('AuthService', () => {
  let authService: AuthService;
  let mockEmployeeService: jest.Mocked<IEmployeeService>;
  
  beforeEach(() => {
    mockEmployeeService = createMockEmployeeService();
    authService = new AuthService(mockEmployeeService);
  });
  
  describe('authenticateWithGoogle', () => {
    it('有効なトークンで認証に成功する', async () => {
      // Arrange
      const mockToken = 'valid-google-token';
      const mockEmployee = createMockEmployee();
      mockEmployeeService.findByEmail.mockResolvedValue(mockEmployee);
      
      // Act
      const result = await authService.authenticateWithGoogle(mockToken);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.employee).toEqual(mockEmployee);
      expect(mockEmployeeService.findByEmail).toHaveBeenCalledWith(
        mockEmployee.email
      );
    });
    
    it('無効なトークンでエラーを投げる', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      
      // Act & Assert
      await expect(
        authService.authenticateWithGoogle(invalidToken)
      ).rejects.toThrow(AuthenticationError);
    });
  });
});
```

### 9.2 統合テストの書き方
```typescript
// auth.integration.test.ts
describe('Auth API Integration', () => {
  let app: Application;
  let prisma: PrismaClient;
  
  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    await prisma.$connect();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedTestData(prisma);
  });
  
  describe('POST /api/auth/google', () => {
    it('正常なGoogleトークンでログインできる', async () => {
      const response = await request(app)
        .post('/api/auth/google')
        .send({
          credential: mockGoogleToken,
          codeVerifier: mockCodeVerifier,
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.employee).toBeDefined();
    });
  });
});
```

## 10. パフォーマンス最適化ルール

### 10.1 データベースクエリ最適化
```typescript
// N+1問題の回避
// ❌ 悪い例
const employees = await prisma.employee.findMany();
for (const employee of employees) {
  const roles = await prisma.employeeRole.findMany({
    where: { employeeId: employee.id }
  });
  employee.roles = roles;
}

// ✅ 良い例
const employees = await prisma.employee.findMany({
  include: {
    employeeRoles: {
      include: {
        role: true,
      },
    },
  },
});
```

### 10.2 キャッシング戦略
```typescript
// Redis キャッシング
class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1時間
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(value),
      'EX',
      ttl || this.defaultTTL
    );
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// 使用例
async function getEmployeeWithCache(id: number) {
  const cacheKey = `employee:${id}`;
  
  // キャッシュチェック
  const cached = await cacheService.get<Employee>(cacheKey);
  if (cached) return cached;
  
  // DBから取得
  const employee = await prisma.employee.findUnique({
    where: { id },
  });
  
  // キャッシュに保存
  if (employee) {
    await cacheService.set(cacheKey, employee, 1800); // 30分
  }
  
  return employee;
}
```

### 10.3 バンドルサイズ最適化
```typescript
// 動的インポート
const HeavyComponent = lazy(() => 
  import(/* webpackChunkName: "heavy-component" */ './HeavyComponent')
);

// Tree-shaking を考慮したインポート
// ❌ 悪い例
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ 良い例
import debounce from 'lodash/debounce';
const result = debounce(fn, 300);
```