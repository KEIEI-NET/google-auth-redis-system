# Google認証従業員管理システム with Redis高可用性実装

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://www.docker.com/)
[![Test Coverage](https://img.shields.io/badge/Coverage-91%25-brightgreen)](coverage/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Google OAuth 2.0認証を使用した企業向け従業員管理システムです。PKCE対応の安全な認証フローと階層型権限管理、そして自動フォールバック機能を持つ3層キャッシュアーキテクチャを提供します。

## 🌟 主な機能

### 認証・権限管理
- **Google OAuth 2.0認証** - PKCE対応のセキュアなシングルサインオン
- **階層型権限管理** - RBAC（Role-Based Access Control）による5段階の権限レベル
- **バックエンドプロキシパターン** - client_secretをバックエンドで安全に管理
- **2025年対応** - Less Secure Apps廃止とGoogle OAuth 2.0の最新要件に対応

### 高可用性・パフォーマンス
- **3層キャッシュアーキテクチャ** - Redis → メモリ → データベースの自動フォールバック
- **インテリジェントセッション管理** - Redisベースの高速セッション管理とフォールバック機構
- **分散レート制限** - RedisStore による分散システム対応のレート制限
- **自動復旧メカニズム** - Redis障害からの自動復旧と継続稼働

### セキュリティ・監査
- **包括的な監査ログ** - すべての操作を記録し、セキュリティイベントを追跡
- **多層防御セキュリティ** - CSRF保護、XSS対策、SQLインジェクション防止
- **httpOnlyクッキー** - JWTトークンの安全な管理
- **タイミング攻撃対策** - 暗号学的に安全な比較処理

## 🏗️ アーキテクチャ

```mermaid
graph TB
    subgraph Frontend
        A[React App] --> B[react-oauth-google]
        A --> C[Protected Routes]
        A --> D[Auth Context]
        B --> E[PKCE Flow]
    end
    
    subgraph Backend
        F[Express API] --> G[JWT Service]
        F --> H[Google Auth Service]
        F --> I[Prisma ORM]
        F --> J[Security Middleware]
        H --> K[OAuth 2.0 + PKCE]
        F --> RM[RedisManager]
        F --> SS[SessionService]
        F --> CS[CacheService]
    end
    
    subgraph DataLayer
        L[(PostgreSQL)]
        M[(Redis Primary)]
        MC[Memory Cache]
        N[Session Store]
        O[Token Cache]
    end
    
    subgraph SecurityLayer
        P[CORS]
        Q[Rate Limiting]
        R[Input Validation]
        S[Audit Logging]
    end
    
    A -.->|HTTPS| F
    C --> D
    E --> K
    RM --> M
    RM -.->|Fallback| MC
    SS --> M
    SS -.->|Fallback| MC
    SS -.->|Persistent| L
    CS --> M
    CS -.->|Fallback| MC
    G --> O
    I --> L
    F --> N
    N --> SS
    J --> P
    J --> Q
    Q --> M
    J --> R
    F --> S
    S --> L
```

## 🚀 クイックスタート

### 前提条件

- Node.js 18.0以上
- PostgreSQL 15以上
- Redis 7.0以上
- Google Cloud Consoleアカウント

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/KEIEI-NET/google-auth-redis-system.git
cd google-auth-redis-system

# 依存関係のインストール
npm run install:all

# 環境変数の設定
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# .envファイルを編集して必要な値を設定

# データベースのセットアップ
npm run db:setup

# 開発サーバーの起動
npm run dev
```

### Docker を使用する場合

```bash
# Dockerコンテナの起動
docker-compose up -d

# データベースマイグレーション
docker-compose exec backend npm run db:migrate

# シードデータの投入
docker-compose exec backend npm run db:seed
```

## 📋 Google Cloud Console設定

詳細な設定手順は [docs/google-console-guide.md](docs/google-console-guide.md) を参照してください。

### 必要な設定

1. **新規プロジェクトの作成**
2. **OAuth同意画面の設定**
3. **認証情報の作成**
4. **リダイレクトURIの設定**

```
開発環境: http://localhost:3000/auth/callback
本番環境: https://your-domain.com/auth/callback
```

## 🔧 設定

### 環境変数

#### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/employee_db
DATABASE_PASSWORD=your-strong-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-session-secret-min-32-chars
SESSION_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (.env)

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_URL=http://localhost:5000/api
```

## 📦 プロジェクト構造

```
.
├── frontend/                    # Reactフロントエンド
│   ├── src/
│   │   ├── components/         # UIコンポーネント
│   │   │   ├── auth/          # 認証関連
│   │   │   ├── admin/         # 管理者画面
│   │   │   └── dashboard/     # ダッシュボード
│   │   ├── services/          # APIサービス
│   │   ├── contexts/          # Reactコンテキスト
│   │   └── utils/             # ユーティリティ
│   └── package.json
│
├── backend/                    # Express バックエンド
│   ├── src/
│   │   ├── controllers/       # APIコントローラー
│   │   ├── services/          # ビジネスロジック
│   │   │   ├── sessionService.ts    # セッション管理
│   │   │   ├── cacheService.ts      # キャッシュ管理
│   │   │   └── googleAuthService.ts # Google認証
│   │   ├── middleware/        # ミドルウェア
│   │   ├── config/           # 設定ファイル
│   │   │   ├── redis.ts     # Redis設定
│   │   │   └── redisManager.ts # Redis管理
│   │   └── __tests__/        # テストファイル
│   ├── prisma/               # Prismaスキーマ
│   └── package.json
│
├── docs/                      # ドキュメント
│   ├── REDIS_ARCHITECTURE.md # Redis設計書
│   ├── SECURITY.md          # セキュリティガイド
│   └── deployment/          # デプロイメントガイド
│
├── scripts/                   # ユーティリティスクリプト
├── docker/                    # Docker設定
├── .claude/                  # ClaudeCode用設定
└── docker-compose.yml        # Docker Compose設定
```

## 🧪 テスト

```bash
# 単体テストの実行
npm run test

# テストカバレッジ
npm run test:coverage

# E2Eテスト
npm run test:e2e
```

## 📊 API仕様

### 認証エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/auth/google` | Google OAuth認証URLの取得 |
| POST | `/api/auth/google/callback` | Google OAuth認証コールバック |
| POST | `/api/auth/refresh` | トークンリフレッシュ |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/me` | 現在のユーザー情報取得 |

### 従業員エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/employees/me` | 現在のユーザー情報 |
| GET | `/api/employees/:id` | 従業員詳細 |
| GET | `/api/employees/:id/permissions` | 権限一覧 |

詳細なAPI仕様は [docs/api-specification.md](docs/api-specification.md) を参照してください。

## 🔒 セキュリティ

### 実装済みセキュリティ機能

#### 認証・認可
- **PKCE (Proof Key for Code Exchange)** - Authorization Code Injection攻撃を防御
- **State検証** - CSRF攻撃を防御（IPアドレス検証付き）
- **バックエンドプロキシ** - client_secretをフロントエンドに露出させない
- **httpOnlyクッキー** - XSS攻撃からJWTトークンを保護

#### トークン・セッション管理
- **JWTトークン管理** - アクセストークン（15分）とリフレッシュトークン（7日）の分離
- **3層セッション管理** - Redis → メモリ → データベースの多層セキュリティ
- **セッション検証** - IPアドレスとUser-Agentによる不正アクセス検出
- **自動セッションクリーンアップ** - 期限切れセッションの定期削除

#### アクセス制御・監査
- **分散レート制限** - RedisStoreによるブルートフォース攻撃防御
- **階層型権限管理** - 5レベルのRBACによる細かなアクセス制御
- **包括的監査ログ** - すべての認証・認可イベントを記録
- **タイミング攻撃対策** - 暗号学的に安全な比較処理

### 2025年Google OAuth変更への対応

- **Less Secure Apps完全廃止対応** - 2025年3月14日の廃止に対応
- **Client Secret必須化対応** - Web Applicationタイプでの必須化に対応
- **Client Secretワンタイム表示対応** - 2025年6月以降の変更に対応

## 🚢 デプロイ

### 本番環境へのデプロイ

```bash
# 環境変数の設定
cp .env.production.example .env.production
# .env.productionを編集

# Dockerを使用したデプロイ
docker-compose -f docker-compose.prod.yml up -d

# または、スクリプトを使用
./scripts/deploy.sh
```

### Docker Compose による起動

```bash
# 開発環境
docker-compose up -d

# 本番環境
docker-compose -f docker-compose.prod.yml up -d

# ヘルスチェック
curl http://localhost:3000/health
curl http://localhost/health
```

### Kubernetes デプロイメント

Helm チャートが利用可能です：

```bash
helm install google-auth-system ./helm \
  --set redis.password=your-redis-password \
  --set postgresql.password=your-db-password
```

## 📈 監視とログ

### メトリクス・モニタリング
- **Prometheus メトリクス** - `/metrics` エンドポイントでエクスポート
- **Grafana ダッシュボード** - 事前設定済みのダッシュボード付き
- **Redis モニタリング** - 接続状態、メモリ使用量、ヒット率
- **ヘルスチェック** - `/health` エンドポイントで各コンポーネントの状態確認

### ログ管理
- **構造化ログ** - Winston による JSON 形式のログ出力
- **ログレベル** - 環境別の適切なログレベル設定
- **監査ログ** - セキュリティイベントの永続的な記録
- **エラートラッキング** - Sentry 統合対応

### Redis 監視

```bash
# Redis 状態確認
docker-compose exec redis redis-cli ping

# Redis メモリ使用状況
docker-compose exec redis redis-cli info memory

# Redis キー数確認
docker-compose exec redis redis-cli dbsize
```

## 🤝 コントリビューション

プルリクエストを歓迎します！
大きな変更の場合は、まずissueを開いて変更内容を議論してください。

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🏆 パフォーマンス指標

- **レスポンスタイム**: < 100ms (Redis キャッシュヒット時)
- **セッション取得**: < 5ms (Redis)、< 1ms (メモリキャッシュ)
- **可用性**: 99.9% (Redis 障害時も継続稼働)
- **同時接続数**: 10,000+ セッション対応
- **テストカバレッジ**: 91%

## 📚 ドキュメント

- [Redis アーキテクチャ設計書](docs/REDIS_ARCHITECTURE.md)
- [セキュリティガイド](docs/SECURITY.md)
- [API 仕様書](docs/api-specification.md)
- [デプロイメントガイド](docs/deployment/DEPLOYMENT_GUIDE.md)
- [開発ガイド](docs/DEVELOPMENT.md)
- [トラブルシューティング](docs/original-docs/troubleshooting-guide.md)

## 📞 サポート

- **GitHub Issues**: [https://github.com/KEIEI-NET/google-auth-redis-system/issues](https://github.com/KEIEI-NET/google-auth-redis-system/issues)
- **Documentation**: [docs/](docs/)
- **Security Issues**: セキュリティ関連の問題は Issue を作成せず、直接メンテナーに連絡してください

## 🙏 謝辞

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Prisma](https://www.prisma.io/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [Redis](https://redis.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Docker](https://www.docker.com/)

## 🆕 最新アップデート (2025-08-11)

### v2.0.0 - Redis 高可用性実装
- ✅ RedisManager によるインテリジェント接続管理
- ✅ 3層セッション管理システム (Redis → Memory → Database)
- ✅ 包括的なキャッシュレイヤー実装
- ✅ 分散システム対応のレート制限
- ✅ 自動フォールバックと復旧メカニズム
- ✅ 91% テストカバレッジ達成
- ✅ Docker 本番環境設定完備
- ✅ Prometheus/Grafana モニタリング統合

---

Built with ❤️ and ☕ for Enterprise-Grade Security and High Availability