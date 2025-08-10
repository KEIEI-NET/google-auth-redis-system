# Google認証従業員管理システム仕様書

## ⚠️ 2025年更新情報

### Google OAuth 2.0の重要な変更
- **2025年3月14日**: Less Secure Apps (LSA) のサポート完全終了
- すべてのアプリケーションはOAuth 2.0への移行が必須
- Google Syncも同時に廃止

### PKCEとclient_secretの扱い
- **重要**: GoogleのWeb ApplicationタイプではPKCEを使用してもclient_secretが必須
- PKCEはclient_secretの代替ではなく、追加のセキュリティ層として機能
- SPAやモバイルアプリでの対処法：
  1. バックエンドプロキシを使用してclient_secretを保護
  2. UWPタイプとして登録（回避策）
  3. Implicit Flowの使用（非推奨だが現在もサポート）

## 1. システム概要

### 1.1 目的
Google OAuth 2.0認証を使用して、従業員の認証と権限管理を行うReactベースのWebアプリケーションシステムを構築する。

### 1.2 システム構成
```
┌─────────────────────────────────────────────────────┐
│                   フロントエンド                      │
│                  React Application                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Components                                  │   │
│  │  ├─ LoginPage     (Google認証画面)          │   │
│  │  ├─ Dashboard     (ダッシュボード)          │   │
│  │  ├─ ProtectedRoute (権限制御)               │   │
│  │  └─ UserProfile   (ユーザー情報表示)        │   │
│  └──────────────────────────────────────────────┘   │
│                         ↓                            │
│  ┌──────────────────────────────────────────────┐   │
│  │  Services                                    │   │
│  │  ├─ GoogleAuthService (認証処理)            │   │
│  │  ├─ EmployeeService  (従業員データ取得)    │   │
│  │  └─ PermissionService (権限チェック)        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                    バックエンド                       │
│                  Node.js + Express                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  API Endpoints                               │   │
│  │  ├─ POST /api/auth/google    (認証)         │   │
│  │  ├─ GET  /api/employee/:email (従業員情報)  │   │
│  │  ├─ GET  /api/permissions    (権限一覧)     │   │
│  │  └─ POST /api/validate-permission           │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                    データベース                       │
│                     PostgreSQL                       │
│  ┌──────────────────────────────────────────────┐   │
│  │  Tables                                      │   │
│  │  ├─ employees    (従業員マスタ)             │   │
│  │  ├─ permissions  (権限マスタ)               │   │
│  │  ├─ roles        (役割マスタ)               │   │
│  │  └─ employee_roles (従業員-役割関連)        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 2. 機能要件

### 2.1 認証機能
- **Google OAuth 2.0認証**
  - Authorization Code Flow with PKCE実装
  - 自動トークンリフレッシュ機能
  - セッション管理（有効期限: 8時間）

### 2.2 従業員データ連携
- **メールアドレスによる紐付け**
  - Google認証メールアドレスと従業員DBのメールアドレスを照合
  - 未登録メールアドレスのアクセス拒否
  - 退職者のアクセス自動無効化

### 2.3 権限管理機能
- **階層型権限システム**
  ```
  権限レベル:
  ├─ SUPER_ADMIN (最高管理者)
  ├─ ADMIN       (管理者)
  ├─ MANAGER     (マネージャー)
  ├─ EMPLOYEE    (一般従業員)
  └─ VIEWER      (閲覧者)
  ```

### 2.4 機能別アクセス制御
| 機能 | SUPER_ADMIN | ADMIN | MANAGER | EMPLOYEE | VIEWER |
|------|-------------|-------|---------|----------|--------|
| ユーザー管理 | ✓ | ✓ | × | × | × |
| 権限設定 | ✓ | × | × | × | × |
| データ編集 | ✓ | ✓ | ✓ | × | × |
| データ閲覧 | ✓ | ✓ | ✓ | ✓ | ✓ |
| レポート作成 | ✓ | ✓ | ✓ | △ | × |

## 3. データベース設計

### 3.1 テーブル定義

#### employees（従業員テーブル）
```sql
CREATE TABLE employees (
  id                SERIAL PRIMARY KEY,
  employee_id       VARCHAR(50) UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  department       VARCHAR(100),
  position         VARCHAR(100),
  hire_date        DATE,
  is_active        BOOLEAN DEFAULT true,
  google_id        VARCHAR(255),
  last_login       TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### permissions（権限テーブル）
```sql
CREATE TABLE permissions (
  id                SERIAL PRIMARY KEY,
  permission_code   VARCHAR(50) UNIQUE NOT NULL,
  permission_name   VARCHAR(100) NOT NULL,
  description      TEXT,
  resource         VARCHAR(100),
  action           VARCHAR(50),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### roles（役割テーブル）
```sql
CREATE TABLE roles (
  id               SERIAL PRIMARY KEY,
  role_code        VARCHAR(50) UNIQUE NOT NULL,
  role_name        VARCHAR(100) NOT NULL,
  description      TEXT,
  priority         INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### employee_roles（従業員-役割関連テーブル）
```sql
CREATE TABLE employee_roles (
  id               SERIAL PRIMARY KEY,
  employee_id      INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  role_id          INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by      INTEGER REFERENCES employees(id),
  is_active        BOOLEAN DEFAULT true,
  UNIQUE(employee_id, role_id)
);
```

#### role_permissions（役割-権限関連テーブル）
```sql
CREATE TABLE role_permissions (
  id               SERIAL PRIMARY KEY,
  role_id          INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id    INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);
```

### 3.2 初期データ

#### 役割マスタ
```sql
INSERT INTO roles (role_code, role_name, priority) VALUES
('SUPER_ADMIN', 'システム管理者', 100),
('ADMIN', '管理者', 80),
('MANAGER', 'マネージャー', 60),
('EMPLOYEE', '一般従業員', 40),
('VIEWER', '閲覧者', 20);
```

#### 権限マスタ
```sql
INSERT INTO permissions (permission_code, permission_name, resource, action) VALUES
('USER_CREATE', 'ユーザー作成', 'users', 'create'),
('USER_READ', 'ユーザー閲覧', 'users', 'read'),
('USER_UPDATE', 'ユーザー更新', 'users', 'update'),
('USER_DELETE', 'ユーザー削除', 'users', 'delete'),
('ROLE_MANAGE', '権限管理', 'roles', 'manage'),
('DATA_EDIT', 'データ編集', 'data', 'edit'),
('DATA_VIEW', 'データ閲覧', 'data', 'view'),
('REPORT_CREATE', 'レポート作成', 'reports', 'create'),
('REPORT_VIEW', 'レポート閲覧', 'reports', 'view');
```

## 4. API仕様

### 4.1 認証API

#### POST /api/auth/google
**リクエスト:**
```json
{
  "credential": "Google ID Token",
  "codeVerifier": "PKCE Code Verifier"
}
```

**レスポンス (200 OK):**
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "employeeId": "EMP001",
      "email": "user@company.com",
      "firstName": "太郎",
      "lastName": "山田",
      "department": "開発部",
      "position": "エンジニア"
    },
    "roles": ["EMPLOYEE", "VIEWER"],
    "permissions": ["DATA_VIEW", "REPORT_VIEW"],
    "accessToken": "JWT Token",
    "refreshToken": "Refresh Token",
    "expiresIn": 28800
  }
}
```

**エラーレスポンス (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "このメールアドレスは登録されていません"
  }
}
```

### 4.2 従業員情報API

#### GET /api/employee/:email
**ヘッダー:**
```
Authorization: Bearer {accessToken}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 1,
      "employeeId": "EMP001",
      "email": "user@company.com",
      "fullName": "山田 太郎",
      "department": "開発部",
      "position": "エンジニア",
      "hireDate": "2020-04-01",
      "isActive": true
    },
    "roles": [
      {
        "roleCode": "EMPLOYEE",
        "roleName": "一般従業員"
      }
    ],
    "permissions": [
      {
        "permissionCode": "DATA_VIEW",
        "permissionName": "データ閲覧",
        "resource": "data",
        "action": "view"
      }
    ]
  }
}
```

### 4.3 権限検証API

#### POST /api/validate-permission
**リクエスト:**
```json
{
  "employeeId": 1,
  "resource": "data",
  "action": "edit"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "hasPermission": true,
    "requiredPermission": "DATA_EDIT",
    "userPermissions": ["DATA_VIEW", "DATA_EDIT"]
  }
}
```

## 5. セキュリティ要件

### 5.1 認証セキュリティ
- **PKCE実装必須**
- **State検証によるCSRF対策**
- **Nonce検証によるリプレイ攻撃対策**
- **トークン暗号化保存（AES-256-GCM）**

### 5.2 通信セキュリティ
- **HTTPS強制（本番環境）**
- **CORS設定（許可ドメイン制限）**
- **レート制限（100リクエスト/分）**

### 5.3 データ保護
- **個人情報の暗号化**
- **監査ログの実装**
- **セッションタイムアウト（8時間）**

## 6. 画面設計

### 6.1 ログイン画面
```
┌─────────────────────────────────────┐
│         企業ロゴ                     │
│                                     │
│    従業員管理システム                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  [Google でログイン]         │   │
│  └─────────────────────────────┘   │
│                                     │
│  セキュアな認証で安全にログイン      │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 ダッシュボード
```
┌─────────────────────────────────────────────────┐
│ ≡ メニュー    従業員管理システム    👤 山田太郎  │
├─────────────┬───────────────────────────────────┤
│             │                                   │
│ ▼ ダッシュボード  │  ようこそ、山田太郎 さん        │
│                │                                   │
│ ▶ ユーザー管理   │  あなたの権限:                  │
│                │  ・一般従業員                    │
│                │  ・データ閲覧                    │
│ ▶ データ管理    │                                   │
│                │  利用可能な機能:                  │
│ ▶ レポート      │  ┌──────────┐ ┌──────────┐      │
│                │  │データ閲覧│ │レポート  │      │
│ ▶ 設定         │  └──────────┘ └──────────┘      │
│                │                                   │
└─────────────┴───────────────────────────────────┘
```

### 6.3 アクセス拒否画面
```
┌─────────────────────────────────────┐
│                                     │
│         ⚠️ アクセス拒否              │
│                                     │
│  この機能にアクセスする権限が        │
│  ありません。                       │
│                                     │
│  必要な権限: 管理者                 │
│                                     │
│  [ダッシュボードに戻る]             │
│                                     │
└─────────────────────────────────────┘
```

## 7. 非機能要件

### 7.1 パフォーマンス
- **初期ロード時間**: 3秒以内
- **API応答時間**: 500ms以内
- **同時接続数**: 1000ユーザー

### 7.2 可用性
- **稼働率**: 99.9%
- **計画メンテナンス**: 月1回、深夜帯

### 7.3 拡張性
- **水平スケーリング対応**
- **マイクロサービス化準備**
- **API バージョニング**

## 8. 開発環境要件

### 8.1 フロントエンド
- **React**: 18.2.0以上
- **TypeScript**: 5.0以上
- **Material-UI**: 5.14以上
- **React Router**: 6.16以上

### 8.2 バックエンド
- **Node.js**: 18.0以上
- **Express**: 4.18以上
- **PostgreSQL**: 14以上
- **Redis**: 7.0以上（セッション管理）

### 8.3 開発ツール
- **ESLint**: コード品質管理
- **Prettier**: コードフォーマット
- **Jest**: テストフレームワーク
- **Docker**: コンテナ化

## 9. テスト要件

### 9.1 単体テスト
- **カバレッジ目標**: 80%以上
- **重点テスト領域**: 認証処理、権限チェック

### 9.2 統合テスト
- **APIテスト**: 全エンドポイント
- **権限テスト**: 全権限パターン

### 9.3 E2Eテスト
- **主要フロー**: ログイン→権限確認→ログアウト
- **エラーケース**: 権限なし、無効なトークン

## 10. デプロイメント

### 10.1 環境構成
```
開発環境 (Development)
├─ URL: http://localhost:3000
├─ DB: PostgreSQL (Docker)
└─ 認証: Google OAuth (テストモード)

ステージング環境 (Staging)
├─ URL: https://staging.example.com
├─ DB: PostgreSQL (AWS RDS)
└─ 認証: Google OAuth (テストモード)

本番環境 (Production)
├─ URL: https://app.example.com
├─ DB: PostgreSQL (AWS RDS Multi-AZ)
└─ 認証: Google OAuth (検証済み)
```

### 10.2 CI/CDパイプライン
```yaml
stages:
  - lint
  - test
  - build
  - deploy

workflow:
  - コードプッシュ
  - 自動テスト実行
  - ビルド作成
  - ステージングデプロイ
  - 承認
  - 本番デプロイ
```