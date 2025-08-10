# セットアップガイド

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- Node.js 18.0以上
- npm 9.0以上
- PostgreSQL 15以上
- Redis 7.0以上
- Docker Desktop（オプション）

## 1. プロジェクトのクローン

```bash
git clone https://github.com/your-org/google-auth-employee-system.git
cd google-auth-employee-system
```

## 2. 依存関係のインストール

```bash
# 全ワークスペースの依存関係をインストール
npm run install:all
```

## 3. 環境変数の設定

### バックエンド環境変数

```bash
# backend/.envファイルを作成
cp backend/.env.example backend/.env
```

`backend/.env`を編集し、以下の値を設定します：

```env
# データベース設定
DATABASE_URL=postgresql://postgres:password@localhost:5432/employee_db
DATABASE_PASSWORD=your-strong-password

# Redis設定
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Google OAuth設定
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWTシークレット（最低32文字）
JWT_SECRET=your-jwt-secret-min-32-characters
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# セッションシークレット（最低32文字）
SESSION_SECRET=your-session-secret-min-32-characters
SESSION_EXPIRES_IN=24h

# CORS設定
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# レート制限
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### フロントエンド環境変数

```bash
# frontend/.envファイルを作成
cp frontend/.env.example frontend/.env
```

`frontend/.env`を編集します：

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_URL=http://localhost:5000/api
```

## 4. Google Cloud Consoleの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. APIとサービス > 認証情報に移動
4. OAuth同意画面を設定
5. OAuth 2.0クライアントIDを作成
   - アプリケーションタイプ: Webアプリケーション
   - 承認済みリダイレクトURI:
     - 開発: `http://localhost:3000/auth/callback`
     - 本番: `https://your-domain.com/auth/callback`

## 5. データベースのセットアップ

### Dockerを使用する場合

```bash
# Dockerコンテナを起動
docker-compose -f docker-compose.minimal.yml up -d

# データベースマイグレーション
cd backend
npm run db:setup
```

### ローカルインストールの場合

1. PostgreSQLを起動し、`employee_db`データベースを作成
2. Redisを起動
3. データベースマイグレーションを実行：

```bash
cd backend
npm run db:setup
```

## 6. テストデータの投入

```bash
cd backend
npm run db:seed
```

これにより、以下のテストアカウントが作成されます：

- admin@example.com (システム管理者)
- manager@example.com (マネージャー)
- employee@example.com (一般従業員)

## 7. 開発サーバーの起動

```bash
# プロジェクトルートから実行
npm run dev
```

これにより、以下が起動します：
- バックエンド: http://localhost:5000
- フロントエンド: http://localhost:3000

## 8. 動作確認

1. http://localhost:3000 にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Googleアカウントでログイン
4. ダッシュボードが表示されれば成功

## トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
docker ps | grep postgres

# データベースに接続できるか確認
psql -U postgres -h localhost -d employee_db
```

### Redis接続エラー

```bash
# Redisが起動しているか確認
docker ps | grep redis

# Redisに接続できるか確認
redis-cli -h localhost -p 6379 -a your-redis-password ping
```

### Google OAuthエラー

1. クライアントIDが正しいか確認
2. リダイレクトURIが登録されているか確認
3. OAuth同意画面が設定されているか確認

### ポートの競合

```bash
# 使用中のポートを確認
lsof -i :5000
lsof -i :3000

# ポートを変更する場合は.envファイルを編集
```

## テストの実行

```bash
# 単体テスト
npm run test

# テストカバレッジ
npm run test:coverage

# E2Eテスト
npm run test:e2e
```