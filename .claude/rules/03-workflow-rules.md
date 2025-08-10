# 実装手順ルール (Implementation Workflow Rules)

## ⚠️ 2025年対応必須事項

### 緊急対応期限
- **2025年3月14日まで**: Less Secure Apps廃止対応完了必須
- **2025年6月以降**: Client Secret管理方法変更に注意

### アーキテクチャ選択（最重要）
Google固有の要件（PKCE + client_secret必須）に対応するため：

```
推奨: バックエンドプロキシパターン
┌──────────────┐
│フロントエンド │ → PKCEのみ実装
└──────────────┘
        ↓
┌──────────────┐
│バックエンド  │ → client_secret管理
└──────────────┘
        ↓
┌──────────────┐
│Google OAuth  │
└──────────────┘
```

## 1. プロジェクト初期設定

### 1.1 プロジェクト構造の作成
```bash
# プロジェクトルートディレクトリ作成
mkdir google-auth-employee-system
cd google-auth-employee-system

# フロントエンドとバックエンドのディレクトリ作成
mkdir frontend backend

# 必要なサブディレクトリ作成
mkdir -p frontend/src/{components,services,contexts,hooks,types,utils}
mkdir -p backend/src/{controllers,services,middleware,models,routes,config,utils}
mkdir -p backend/src/database/{migrations,seeds,prisma}
mkdir -p docker scripts docs

# 設定ファイルのテンプレート作成
touch frontend/.env.example backend/.env.example
touch docker-compose.yml README.md
```

### 1.2 依存関係のインストール

#### フロントエンド
```bash
cd frontend

# React プロジェクトの初期化
npx create-react-app . --template typescript

# 必要なパッケージのインストール
npm install \
  @react-oauth/google@^0.11.1 \
  @mui/material@^5.14.0 \
  @emotion/react@^11.11.1 \
  @emotion/styled@^11.11.0 \
  react-router-dom@^6.16.0 \
  axios@^1.5.0 \
  react-query@^3.39.3 \
  react-hook-form@^7.47.0 \
  yup@^1.3.3 \
  date-fns@^2.30.0

# 開発依存関係
npm install -D \
  @types/node@^20.0.0 \
  @types/react@^18.2.0 \
  @types/react-dom@^18.2.0 \
  @typescript-eslint/eslint-plugin@^6.0.0 \
  @typescript-eslint/parser@^6.0.0 \
  eslint@^8.50.0 \
  eslint-config-prettier@^9.0.0 \
  eslint-plugin-react@^7.33.0 \
  eslint-plugin-react-hooks@^4.6.0 \
  prettier@^3.0.0 \
  husky@^8.0.0 \
  lint-staged@^14.0.0
```

#### バックエンド
```bash
cd ../backend

# Node.js プロジェクトの初期化
npm init -y

# TypeScript設定
npm install -D typescript @types/node ts-node nodemon

# 必要なパッケージのインストール
npm install \
  express@^4.18.0 \
  @prisma/client@^5.6.0 \
  jsonwebtoken@^9.0.0 \
  bcrypt@^5.1.0 \
  express-session@^1.17.0 \
  connect-redis@^7.1.0 \
  redis@^4.6.0 \
  cors@^2.8.0 \
  helmet@^7.1.0 \
  express-rate-limit@^7.1.0 \
  rate-limit-redis@^4.1.0 \
  winston@^3.11.0 \
  dotenv@^16.3.0 \
  google-auth-library@^9.4.0 \
  validator@^13.11.0 \
  isomorphic-dompurify@^2.0.0

# 開発依存関係
npm install -D \
  @types/express@^4.17.0 \
  @types/jsonwebtoken@^9.0.0 \
  @types/bcrypt@^5.0.0 \
  @types/express-session@^1.17.0 \
  @types/cors@^2.8.0 \
  @types/validator@^13.11.0 \
  prisma@^5.6.0 \
  jest@^29.7.0 \
  @types/jest@^29.5.0 \
  supertest@^6.3.0 \
  @types/supertest@^2.0.0 \
  eslint@^8.50.0 \
  @typescript-eslint/eslint-plugin@^6.0.0 \
  @typescript-eslint/parser@^6.0.0 \
  prettier@^3.0.0
```

### 1.3 TypeScript設定

#### frontend/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"],
      "@components/*": ["components/*"],
      "@services/*": ["services/*"],
      "@hooks/*": ["hooks/*"],
      "@types/*": ["types/*"],
      "@utils/*": ["utils/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "build", "dist"]
}
```

#### backend/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@controllers/*": ["controllers/*"],
      "@services/*": ["services/*"],
      "@middleware/*": ["middleware/*"],
      "@models/*": ["models/*"],
      "@utils/*": ["utils/*"],
      "@config/*": ["config/*"]
    },
    "types": ["node", "jest"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## 2. 環境設定

### 2.1 環境変数の設定

#### frontend/.env.example
```env
# Google OAuth設定
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
REACT_APP_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# API設定
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_API_TIMEOUT=30000

# セキュリティ設定
REACT_APP_ENABLE_HTTPS=false
REACT_APP_SESSION_TIMEOUT=28800000

# 開発設定
REACT_APP_ENV=development
REACT_APP_DEBUG=true
```

#### backend/.env.example
```env
# サーバー設定
NODE_ENV=development
PORT=5000
HOST=localhost

# データベース設定
DATABASE_URL=postgresql://user:password@localhost:5432/employee_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis設定
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Google OAuth設定
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT設定
JWT_SECRET=your_jwt_secret_key_min_32_characters
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# セッション設定
SESSION_SECRET_CURRENT=your_session_secret_current
SESSION_SECRET_PREVIOUS=your_session_secret_previous
SESSION_TIMEOUT=28800000

# 暗号化設定
DB_ENCRYPTION_KEY=your_256_bit_encryption_key_in_hex
ENCRYPTION_ALGORITHM=aes-256-gcm

# CORS設定
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# レート制限設定
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ロギング設定
LOG_LEVEL=debug
LOG_FILE_PATH=./logs

# セキュリティ設定
ENFORCE_HTTPS=false
ENABLE_AUDIT_LOG=true
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=1800000

# アラート設定
SLACK_WEBHOOK_URL=
SECURITY_TEAM_EMAIL=security@example.com
```

### 2.2 Docker設定

#### docker-compose.yml
```yaml
version: '3.8'

services:
  # PostgreSQLデータベース
  postgres:
    image: postgres:15-alpine
    container_name: employee_db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin_password
      POSTGRES_DB: employee_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis（セッション管理用）
  redis:
    image: redis:7-alpine
    container_name: employee_redis
    command: redis-server --appendonly yes --requirepass redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # バックエンドアプリケーション
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/Dockerfile.backend
    container_name: employee_backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://admin:admin_password@postgres:5432/employee_db
      REDIS_URL: redis://:redis_password@redis:6379
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    networks:
      - app_network
    command: npm run dev

  # フロントエンドアプリケーション
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/Dockerfile.frontend
    container_name: employee_frontend
    depends_on:
      - backend
    environment:
      REACT_APP_API_URL: http://localhost:5000/api
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - app_network
    command: npm start

volumes:
  postgres_data:
  redis_data:

networks:
  app_network:
    driver: bridge
```

## 3. データベース設定

### 3.1 Prismaスキーマ定義

#### backend/src/database/prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 従業員テーブル
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
  
  // リレーション
  employeeRoles EmployeeRole[]
  assignedBy    EmployeeRole[]   @relation("AssignedBy")
  auditLogs     AuditLog[]       @relation("PerformedBy")
  refreshTokens RefreshToken[]
  
  @@map("employees")
  @@index([email])
  @@index([googleId])
}

// 権限テーブル
model Permission {
  id              Int               @id @default(autoincrement())
  permissionCode  String            @unique @map("permission_code") @db.VarChar(50)
  permissionName  String            @map("permission_name") @db.VarChar(100)
  description     String?           @db.Text
  resource        String?           @db.VarChar(100)
  action          String?           @db.VarChar(50)
  isActive        Boolean           @default(true) @map("is_active")
  createdAt       DateTime          @default(now()) @map("created_at")
  
  // リレーション
  rolePermissions RolePermission[]
  
  @@map("permissions")
  @@index([permissionCode])
}

// 役割テーブル
model Role {
  id              Int               @id @default(autoincrement())
  roleCode        String            @unique @map("role_code") @db.VarChar(50)
  roleName        String            @map("role_name") @db.VarChar(100)
  description     String?           @db.Text
  priority        Int               @default(0)
  isActive        Boolean           @default(true) @map("is_active")
  createdAt       DateTime          @default(now()) @map("created_at")
  
  // リレーション
  employeeRoles   EmployeeRole[]
  rolePermissions RolePermission[]
  
  @@map("roles")
  @@index([roleCode])
}

// 従業員-役割関連テーブル
model EmployeeRole {
  id            Int       @id @default(autoincrement())
  employeeId    Int       @map("employee_id")
  roleId        Int       @map("role_id")
  assignedDate  DateTime  @default(now()) @map("assigned_date")
  assignedById  Int?      @map("assigned_by")
  isActive      Boolean   @default(true) @map("is_active")
  
  // リレーション
  employee      Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  role          Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  assignedBy    Employee? @relation("AssignedBy", fields: [assignedById], references: [id])
  
  @@unique([employeeId, roleId])
  @@map("employee_roles")
  @@index([employeeId])
  @@index([roleId])
}

// 役割-権限関連テーブル
model RolePermission {
  id           Int        @id @default(autoincrement())
  roleId       Int        @map("role_id")
  permissionId Int        @map("permission_id")
  createdAt    DateTime   @default(now()) @map("created_at")
  
  // リレーション
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@unique([roleId, permissionId])
  @@map("role_permissions")
  @@index([roleId])
  @@index([permissionId])
}

// 監査ログテーブル
model AuditLog {
  id           String    @id @default(uuid())
  eventType    String    @map("event_type") @db.VarChar(100)
  severity     String    @db.VarChar(20)
  userId       Int?      @map("user_id")
  ipAddress    String?   @map("ip_address") @db.VarChar(45)
  userAgent    String?   @map("user_agent") @db.Text
  resource     String?   @db.VarChar(100)
  action       String?   @db.VarChar(50)
  result       String?   @db.VarChar(20)
  details      Json?
  timestamp    DateTime  @default(now())
  
  // リレーション
  performedBy  Employee? @relation("PerformedBy", fields: [userId], references: [id])
  
  @@map("audit_logs")
  @@index([userId])
  @@index([timestamp])
  @@index([eventType])
}

// リフレッシュトークンテーブル
model RefreshToken {
  id          String    @id @default(uuid())
  userId      Int       @map("user_id")
  token       String    @unique @db.Text
  expiresAt   DateTime  @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at")
  
  // リレーション
  employee    Employee  @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("refresh_tokens")
  @@index([userId])
  @@index([token])
}
```

### 3.2 マイグレーションとシード

#### マイグレーション実行
```bash
cd backend

# Prismaクライアント生成
npx prisma generate

# マイグレーション作成
npx prisma migrate dev --name init

# マイグレーション実行（本番）
npx prisma migrate deploy
```

#### backend/src/database/seeds/seed.ts
```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // 役割の作成
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { roleCode: 'SUPER_ADMIN' },
      update: {},
      create: {
        roleCode: 'SUPER_ADMIN',
        roleName: 'システム管理者',
        description: '全権限を持つ最高管理者',
        priority: 100,
      },
    }),
    prisma.role.upsert({
      where: { roleCode: 'ADMIN' },
      update: {},
      create: {
        roleCode: 'ADMIN',
        roleName: '管理者',
        description: 'ユーザー管理が可能な管理者',
        priority: 80,
      },
    }),
    prisma.role.upsert({
      where: { roleCode: 'MANAGER' },
      update: {},
      create: {
        roleCode: 'MANAGER',
        roleName: 'マネージャー',
        description: 'データ編集が可能なマネージャー',
        priority: 60,
      },
    }),
    prisma.role.upsert({
      where: { roleCode: 'EMPLOYEE' },
      update: {},
      create: {
        roleCode: 'EMPLOYEE',
        roleName: '一般従業員',
        description: '基本的な権限を持つ従業員',
        priority: 40,
      },
    }),
    prisma.role.upsert({
      where: { roleCode: 'VIEWER' },
      update: {},
      create: {
        roleCode: 'VIEWER',
        roleName: '閲覧者',
        description: '閲覧のみ可能',
        priority: 20,
      },
    }),
  ]);
  
  console.log('✅ Roles created');
  
  // 権限の作成
  const permissions = await Promise.all([
    // ユーザー管理権限
    prisma.permission.upsert({
      where: { permissionCode: 'USER_CREATE' },
      update: {},
      create: {
        permissionCode: 'USER_CREATE',
        permissionName: 'ユーザー作成',
        resource: 'users',
        action: 'create',
      },
    }),
    prisma.permission.upsert({
      where: { permissionCode: 'USER_READ' },
      update: {},
      create: {
        permissionCode: 'USER_READ',
        permissionName: 'ユーザー閲覧',
        resource: 'users',
        action: 'read',
      },
    }),
    prisma.permission.upsert({
      where: { permissionCode: 'USER_UPDATE' },
      update: {},
      create: {
        permissionCode: 'USER_UPDATE',
        permissionName: 'ユーザー更新',
        resource: 'users',
        action: 'update',
      },
    }),
    prisma.permission.upsert({
      where: { permissionCode: 'USER_DELETE' },
      update: {},
      create: {
        permissionCode: 'USER_DELETE',
        permissionName: 'ユーザー削除',
        resource: 'users',
        action: 'delete',
      },
    }),
    // データ管理権限
    prisma.permission.upsert({
      where: { permissionCode: 'DATA_EDIT' },
      update: {},
      create: {
        permissionCode: 'DATA_EDIT',
        permissionName: 'データ編集',
        resource: 'data',
        action: 'edit',
      },
    }),
    prisma.permission.upsert({
      where: { permissionCode: 'DATA_VIEW' },
      update: {},
      create: {
        permissionCode: 'DATA_VIEW',
        permissionName: 'データ閲覧',
        resource: 'data',
        action: 'view',
      },
    }),
    // レポート権限
    prisma.permission.upsert({
      where: { permissionCode: 'REPORT_CREATE' },
      update: {},
      create: {
        permissionCode: 'REPORT_CREATE',
        permissionName: 'レポート作成',
        resource: 'reports',
        action: 'create',
      },
    }),
    prisma.permission.upsert({
      where: { permissionCode: 'REPORT_VIEW' },
      update: {},
      create: {
        permissionCode: 'REPORT_VIEW',
        permissionName: 'レポート閲覧',
        resource: 'reports',
        action: 'view',
      },
    }),
  ]);
  
  console.log('✅ Permissions created');
  
  // 役割と権限の関連付け
  // SUPER_ADMIN: 全権限
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roles[0].id, // SUPER_ADMIN
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: roles[0].id,
        permissionId: permission.id,
      },
    });
  }
  
  // ADMIN: ユーザー管理とデータ閲覧
  const adminPermissions = permissions.filter(p => 
    p.permissionCode.startsWith('USER_') || 
    p.permissionCode === 'DATA_VIEW' ||
    p.permissionCode === 'REPORT_VIEW'
  );
  
  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roles[1].id, // ADMIN
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: roles[1].id,
        permissionId: permission.id,
      },
    });
  }
  
  console.log('✅ Role-Permission associations created');
  
  // テスト用従業員の作成（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    const testEmployee = await prisma.employee.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        employeeId: 'EMP001',
        email: 'admin@example.com',
        firstName: '管理者',
        lastName: 'テスト',
        department: 'システム部',
        position: 'システム管理者',
        hireDate: new Date('2020-01-01'),
        isActive: true,
      },
    });
    
    // SUPER_ADMIN役割を割り当て
    await prisma.employeeRole.upsert({
      where: {
        employeeId_roleId: {
          employeeId: testEmployee.id,
          roleId: roles[0].id,
        },
      },
      update: {},
      create: {
        employeeId: testEmployee.id,
        roleId: roles[0].id,
      },
    });
    
    console.log('✅ Test employee created');
  }
  
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## 4. 実装順序

### 4.1 バックエンド実装順序

```markdown
## Phase 1: 基盤構築（1-2日）
1. [ ] Express サーバーセットアップ
2. [ ] TypeScript設定
3. [ ] 環境変数設定
4. [ ] データベース接続設定
5. [ ] Prismaセットアップとマイグレーション
6. [ ] Redis接続設定
7. [ ] ロガー設定
8. [ ] エラーハンドリング基盤

## Phase 2: セキュリティ基盤（1-2日）
1. [ ] CORS設定
2. [ ] Helmet設定
3. [ ] レート制限設定
4. [ ] セッション管理設定
5. [ ] PKCE実装
6. [ ] State/Nonce管理
7. [ ] トークン暗号化

## Phase 3: 認証システム（2-3日）
1. [ ] Google OAuth サービス実装
2. [ ] JWT管理サービス
3. [ ] 認証ミドルウェア
4. [ ] リフレッシュトークン処理
5. [ ] ログイン/ログアウトAPI
6. [ ] セッション検証

## Phase 4: 権限管理（2-3日）
1. [ ] 従業員サービス実装
2. [ ] 権限サービス実装
3. [ ] 権限チェックミドルウェア
4. [ ] RBAC実装
5. [ ] 権限API実装

## Phase 5: API実装（1-2日）
1. [ ] 従業員CRUD API
2. [ ] 権限管理API
3. [ ] 監査ログAPI
4. [ ] ヘルスチェックAPI

## Phase 6: セキュリティ強化（1日）
1. [ ] 入力検証実装
2. [ ] SQLインジェクション対策確認
3. [ ] XSS対策確認
4. [ ] 監査ログ実装
5. [ ] セキュリティヘッダー確認
```

### 4.2 フロントエンド実装順序

```markdown
## Phase 1: 基盤構築（1日）
1. [ ] React プロジェクトセットアップ
2. [ ] TypeScript設定
3. [ ] ルーティング設定
4. [ ] Material-UI テーマ設定
5. [ ] Axios設定
6. [ ] 環境変数設定

## Phase 2: 認証基盤（2日）
1. [ ] Google OAuth設定
2. [ ] PKCEManager実装
3. [ ] StateManager実装
4. [ ] SecureStorage実装
5. [ ] AuthContext実装
6. [ ] useAuthフック実装

## Phase 3: コンポーネント実装（2-3日）
1. [ ] LoginPage実装
2. [ ] GoogleLoginButton実装
3. [ ] ProtectedRoute実装
4. [ ] Layout/Header/Sidebar実装
5. [ ] Dashboard実装
6. [ ] UserProfile実装
7. [ ] AccessDeniedページ実装

## Phase 4: サービス層実装（1-2日）
1. [ ] APIClient実装
2. [ ] AuthService実装
3. [ ] EmployeeService実装
4. [ ] PermissionService実装

## Phase 5: 権限管理UI（1-2日）
1. [ ] PermissionContext実装
2. [ ] usePermissionフック実装
3. [ ] 権限ベースの表示制御
4. [ ] 役割管理画面

## Phase 6: 仕上げ（1日）
1. [ ] エラーハンドリング実装
2. [ ] ローディング状態実装
3. [ ] トースト通知実装
4. [ ] レスポンシブ対応
5. [ ] アクセシビリティ確認
```

## 5. テスト実装

### 5.1 単体テストの実装

#### backend/src/services/__tests__/authService.test.ts
```typescript
import { AuthService } from '../authService';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';

// モックの設定
jest.mock('@prisma/client');
jest.mock('google-auth-library');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockOAuth2Client: jest.Mocked<OAuth2Client>;
  
  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockOAuth2Client = new OAuth2Client() as jest.Mocked<OAuth2Client>;
    authService = new AuthService(mockPrisma, mockOAuth2Client);
  });
  
  describe('authenticateWithGoogle', () => {
    it('should authenticate valid Google token', async () => {
      // Arrange
      const mockToken = 'valid-google-token';
      const mockPayload = {
        sub: 'google-user-id',
        email: 'user@example.com',
        name: 'Test User',
      };
      
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      } as any);
      
      mockPrisma.employee.findUnique = jest.fn().mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      });
      
      // Act
      const result = await authService.authenticateWithGoogle(mockToken);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.employee.email).toBe('user@example.com');
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: mockToken,
        audience: expect.any(String),
      });
    });
    
    it('should reject invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      mockOAuth2Client.verifyIdToken.mockRejectedValue(
        new Error('Invalid token')
      );
      
      // Act & Assert
      await expect(
        authService.authenticateWithGoogle(invalidToken)
      ).rejects.toThrow('Invalid token');
    });
    
    it('should reject unregistered email', async () => {
      // Arrange
      const mockToken = 'valid-google-token';
      const mockPayload = {
        sub: 'google-user-id',
        email: 'unregistered@example.com',
        name: 'Unregistered User',
      };
      
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      } as any);
      
      mockPrisma.employee.findUnique = jest.fn().mockResolvedValue(null);
      
      // Act & Assert
      await expect(
        authService.authenticateWithGoogle(mockToken)
      ).rejects.toThrow('Employee not found');
    });
  });
});
```

### 5.2 統合テストの実装

#### backend/src/__tests__/integration/auth.test.ts
```typescript
import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { redisClient } from '../../config/redis';

const prisma = new PrismaClient();

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await redisClient.connect();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
    await redisClient.disconnect();
  });
  
  beforeEach(async () => {
    // テストデータのクリーンアップ
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.employeeRole.deleteMany();
    await prisma.employee.deleteMany();
    
    // テストユーザーの作成
    await prisma.employee.create({
      data: {
        employeeId: 'TEST001',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        googleId: 'google-test-id',
        isActive: true,
      },
    });
  });
  
  describe('POST /api/auth/google', () => {
    it('should authenticate with valid Google token', async () => {
      const response = await request(app)
        .post('/api/auth/google')
        .send({
          credential: process.env.TEST_GOOGLE_TOKEN,
          codeVerifier: 'test-code-verifier',
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.employee.email).toBe('test@example.com');
    });
    
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/google')
        .send({
          credential: 'invalid-token',
          codeVerifier: 'test-code-verifier',
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
    
    it('should enforce rate limiting', async () => {
      const requests = [];
      
      // 6回のリクエストを送信（制限は5回）
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/google')
            .send({
              credential: 'invalid-token',
              codeVerifier: 'test-code-verifier',
            })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    
    beforeEach(async () => {
      // 有効なリフレッシュトークンを取得
      const loginResponse = await request(app)
        .post('/api/auth/google')
        .send({
          credential: process.env.TEST_GOOGLE_TOKEN,
          codeVerifier: 'test-code-verifier',
        });
      
      refreshToken = loginResponse.body.data.refreshToken;
    });
    
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });
    
    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
```

### 5.3 E2Eテストの実装

#### frontend/cypress/e2e/auth-flow.cy.ts
```typescript
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  
  it('should display login page for unauthenticated users', () => {
    cy.url().should('include', '/login');
    cy.contains('Google でログイン').should('be.visible');
  });
  
  it('should complete Google OAuth flow', () => {
    // Google OAuthのモック
    cy.intercept('POST', '/api/auth/google', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          employee: {
            id: 1,
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          permissions: ['DATA_VIEW', 'REPORT_VIEW'],
        },
      },
    }).as('googleAuth');
    
    // ログインボタンをクリック
    cy.get('[data-testid="google-login-button"]').click();
    
    // API呼び出しを待つ
    cy.wait('@googleAuth');
    
    // ダッシュボードにリダイレクト
    cy.url().should('include', '/dashboard');
    cy.contains('ようこそ、Test User さん').should('be.visible');
  });
  
  it('should protect routes for unauthenticated users', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
  
  it('should handle permission-based access', () => {
    // 認証済みユーザーとしてログイン
    cy.login('test@example.com', ['DATA_VIEW']);
    
    // アクセス可能なページ
    cy.visit('/data/view');
    cy.contains('データ一覧').should('be.visible');
    
    // アクセス不可のページ
    cy.visit('/admin/users');
    cy.url().should('include', '/access-denied');
    cy.contains('アクセス権限がありません').should('be.visible');
  });
  
  it('should handle logout correctly', () => {
    // ログイン
    cy.login('test@example.com');
    
    // ログアウト
    cy.get('[data-testid="logout-button"]').click();
    
    // ログアウトAPI呼び出し
    cy.intercept('POST', '/api/auth/logout', {
      statusCode: 200,
      body: { success: true },
    }).as('logout');
    
    cy.wait('@logout');
    
    // ログインページにリダイレクト
    cy.url().should('include', '/login');
    
    // 保護されたルートにアクセスできない
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
});
```

## 6. デプロイメント

### 6.1 本番環境用Dockerfile

#### docker/Dockerfile.backend
```dockerfile
# ビルドステージ
FROM node:18-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npm install -g typescript
RUN npx prisma generate

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# 本番ステージ
FROM node:18-alpine

WORKDIR /app

# セキュリティ: non-rootユーザーの作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 依存関係とビルド成果物のコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# セキュリティ: ファイル所有権の設定
RUN chown -R nodejs:nodejs /app

USER nodejs

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

EXPOSE 5000

CMD ["node", "dist/server.js"]
```

#### docker/Dockerfile.frontend
```dockerfile
# ビルドステージ
FROM node:18-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# 本番ステージ
FROM nginx:alpine

# Nginxの設定
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/build /usr/share/nginx/html

# セキュリティ: non-rootユーザーで実行
RUN chown -R nginx:nginx /usr/share/nginx/html

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 6.2 CI/CDパイプライン

#### .github/workflows/deploy.yml
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  
jobs:
  # リント
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run ESLint
        run: |
          cd backend && npm run lint
          cd ../frontend && npm run lint
  
  # テスト
  test:
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Setup database
        run: |
          cd backend
          npx prisma migrate deploy
          npm run seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run backend tests
        run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret
          SESSION_SECRET_CURRENT: test-session-secret
      
      - name: Run frontend tests
        run: cd frontend && npm test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
  
  # セキュリティスキャン
  security:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: |
          cd backend && npm audit --audit-level=moderate
          cd ../frontend && npm audit --audit-level=moderate
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  
  # ビルド
  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to DockerHub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          file: ./docker/Dockerfile.backend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/employee-backend:latest
            ${{ secrets.DOCKER_USERNAME }}/employee-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: ./docker/Dockerfile.frontend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/employee-frontend:latest
            ${{ secrets.DOCKER_USERNAME }}/employee-frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  # デプロイ
  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          # SSH接続してデプロイスクリプトを実行
          echo "${{ secrets.SSH_KEY }}" > deploy_key
          chmod 600 deploy_key
          ssh -i deploy_key -o StrictHostKeyChecking=no ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} '
            cd /app/employee-system
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker system prune -f
          '
```

## 7. 監視とログ

### 7.1 監視設定

#### backend/src/monitoring/metrics.ts
```typescript
import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Gauge, register } from 'prom-client';

// メトリクスの定義
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result'],
});

const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// メトリクス収集ミドルウェア
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};

// メトリクスエンドポイント
export const metricsEndpoint = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

// メトリクスのエクスポート
export {
  httpRequestDuration,
  httpRequestTotal,
  activeConnections,
  authenticationAttempts,
  databaseQueryDuration,
};
```

### 7.2 ログ集約設定

#### backend/src/utils/logger.ts
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// ログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

// トランスポート設定
const transports = [
  // コンソール出力
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  
  // エラーログファイル
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),
  
  // 全ログファイル
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),
  
  // セキュリティログ
  new DailyRotateFile({
    filename: 'logs/security-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
    auditFile: 'logs/security-audit.json',
  }),
];

// 本番環境では外部ログサービスも使用
if (process.env.NODE_ENV === 'production') {
  // CloudWatch、Datadog、ELKスタックなどへの送信
  // transports.push(new CloudWatchTransport({...}));
}

// ロガーの作成
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

// セキュリティログ用の特別なメソッド
logger.security = (message: string, meta?: any) => {
  logger.warn(message, { type: 'SECURITY', ...meta });
};

export default logger;
```

## 8. トラブルシューティングガイド

### 8.1 よくある問題と解決方法

```markdown
## 認証関連

### 問題: "redirect_uri_mismatch" エラー
**原因**: Google Cloud ConsoleのリダイレクトURIと実装が一致しない
**解決方法**:
1. Google Cloud Console で登録済みのURIを確認
2. アプリケーションの環境変数を確認
3. 大文字小文字、スラッシュ、ポート番号を含めて完全一致させる

### 問題: "Google hasn't verified this app" 警告
**原因**: アプリが未検証状態
**解決方法**:
1. 開発中: テストユーザーに追加
2. 本番: 検証申請を行う

### 問題: トークンが7日で期限切れ
**原因**: External + Testingモードの制限
**解決方法**:
1. アプリを公開状態に変更
2. または検証申請を完了させる

## データベース関連

### 問題: Prismaマイグレーションエラー
**原因**: データベース接続不可または権限不足
**解決方法**:
1. DATABASE_URLの確認
2. PostgreSQLが起動しているか確認
3. ユーザー権限の確認
```bash
docker-compose ps
docker-compose logs postgres
```

### 問題: "P2002: Unique constraint failed"
**原因**: ユニーク制約違反
**解決方法**:
1. 既存データの確認
2. upsertの使用を検討
3. データのクリーンアップ

## セキュリティ関連

### 問題: CORS エラー
**原因**: オリジンが許可リストにない
**解決方法**:
1. ALLOWED_ORIGINSに追加
2. credentials: trueの確認
3. プリフライトリクエストの確認

### 問題: レート制限エラー (429)
**原因**: リクエスト数が制限を超過
**解決方法**:
1. レート制限の設定を確認
2. Redisが正常に動作しているか確認
3. 必要に応じて制限値を調整

## パフォーマンス関連

### 問題: API レスポンスが遅い
**原因**: N+1問題またはインデックス不足
**解決方法**:
1. Prismaのincludeを使用してN+1を解決
2. 適切なインデックスを追加
3. クエリの最適化
```sql
EXPLAIN ANALYZE SELECT * FROM employees WHERE email = 'test@example.com';
```

### 問題: メモリリーク
**原因**: イベントリスナーやタイマーの未解放
**解決方法**:
1. コンポーネントのクリーンアップ確認
2. useEffectの依存配列確認
3. メモリプロファイラーで調査
```

## 9. メンテナンスガイド

### 9.1 定期メンテナンスタスク

```markdown
## 日次タスク
- [ ] エラーログの確認
- [ ] セキュリティアラートの確認
- [ ] バックアップの確認
- [ ] リソース使用状況の確認

## 週次タスク
- [ ] パフォーマンスメトリクスのレビュー
- [ ] セキュリティログの分析
- [ ] 依存関係の更新確認
- [ ] データベースの最適化

## 月次タスク
- [ ] セキュリティ監査の実施
- [ ] バックアップリストアテスト
- [ ] 証明書の有効期限確認
- [ ] ドキュメントの更新

## 四半期タスク
- [ ] 災害復旧訓練
- [ ] ペネトレーションテスト
- [ ] パフォーマンステスト
- [ ] アーキテクチャレビュー
```

### 9.2 バックアップとリストア

```bash
# データベースバックアップ
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/postgres"

# PostgreSQLバックアップ
docker exec employee_db pg_dump -U admin employee_db > $BACKUP_DIR/backup_$DATE.sql

# 圧縮
gzip $BACKUP_DIR/backup_$DATE.sql

# 古いバックアップの削除（30日以上）
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# S3へのアップロード（オプション）
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://backup-bucket/postgres/

# リストア手順
# gunzip backup_20240101_120000.sql.gz
# docker exec -i employee_db psql -U admin employee_db < backup_20240101_120000.sql
```

これで実装手順ルールが完成しました。このガイドに従うことで、Google認証従業員管理システムを段階的に実装できます。