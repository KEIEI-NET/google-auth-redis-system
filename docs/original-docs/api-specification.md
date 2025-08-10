# API仕様書

## 概要

Google認証従業員管理システムのRESTful API仕様書です。

### ベースURL

```
開発環境: http://localhost:5000/api
本番環境: https://api.your-domain.com/api
```

### 認証方式

JWT Bearerトークンを使用します。

```http
Authorization: Bearer <access_token>
```

### レスポンス形式

すべてのレスポンスは以下の形式で返されます：

```json
{
  "success": true,
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {}
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## 認証エンドポイント

### Google OAuth認証URLの取得

```http
GET /api/auth/google
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "random_state_string"
  }
}
```

### Google OAuthコールバック

```http
POST /api/auth/google/callback
Content-Type: application/json

{
  "code": "authorization_code_from_google",
  "state": "state_from_initial_request"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token",
    "employee": {
      "id": 1,
      "employeeId": "EMP001",
      "email": "user@example.com",
      "firstName": "太郎",
      "lastName": "田中",
      "department": "開発部",
      "position": "シニアエンジニア",
      "roles": ["EMPLOYEE"]
    }
  }
}
```

### トークンリフレッシュ

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

### ログアウト

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "refresh_token"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "message": "ログアウトしました"
  }
}
```

### 現在のユーザー情報

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "id": 1,
    "employeeId": "EMP001",
    "email": "user@example.com",
    "firstName": "太郎",
    "lastName": "田中",
    "department": "開発部",
    "position": "シニアエンジニア",
    "roles": ["EMPLOYEE"],
    "permissions": ["DATA_VIEW", "REPORT_VIEW"],
    "isActive": true,
    "lastLogin": "2025-01-10T10:30:00Z"
  }
}
```

## エラーコード

### 認証エラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| UNAUTHORIZED | 認証が必要です | 401 |
| INVALID_TOKEN | 無効なトークンです | 401 |
| TOKEN_EXPIRED | トークンの有効期限が切れています | 401 |
| INVALID_CREDENTIALS | 認証情報が正しくありません | 401 |

### 認可エラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| FORBIDDEN | アクセス権限がありません | 403 |
| INSUFFICIENT_PERMISSIONS | 必要な権限がありません | 403 |

### リソースエラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| NOT_FOUND | リソースが見つかりません | 404 |
| ALREADY_EXISTS | リソースが既に存在します | 409 |

### バリデーションエラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| VALIDATION_ERROR | 入力データにエラーがあります | 400 |
| INVALID_INPUT | 無効な入力です | 400 |

### サーバーエラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| INTERNAL_SERVER_ERROR | サーバーエラーが発生しました | 500 |
| DATABASE_ERROR | データベースエラー | 500 |
| EXTERNAL_SERVICE_ERROR | 外部サービスエラー | 502 |

### レート制限

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| RATE_LIMIT_EXCEEDED | レート制限を超過しました | 429 |

### OAuthエラー

| コード | 説明 | HTTPステータス |
|------|------|----------------|
| OAUTH_STATE_INVALID | 無効な認証リクエストです | 400 |
| OAUTH_CODE_INVALID | 無効な認証コードです | 400 |
| GOOGLE_AUTH_FAILED | Google認証に失敗しました | 500 |

## セキュリティ

### PKCE (Proof Key for Code Exchange)

フロントエンドからの認証フローではPKCEを使用します。

1. `code_verifier` を生成（43-128文字のランダム文字列）
2. `code_challenge` を計算（SHA256ハッシュのBase64URLエンコード）
3. 認証URLに `code_challenge` と `code_challenge_method=S256` を含める
4. コールバック時に `code_verifier` を送信

### Stateパラメータ

CSRF攻撃を防ぐため、認証フローで`state`パラメータを使用します。

### レート制限

- デフォルト: 15分間に100リクエスト
- 認証エンドポイント: 15分間に20リクエスト

## 権限システム

### ロール

| ロールコード | 説明 | 優先度 |
|--------------|------|--------|
| SUPER_ADMIN | システム管理者 | 100 |
| ADMIN | 管理者 | 80 |
| MANAGER | マネージャー | 60 |
| EMPLOYEE | 一般従業員 | 40 |
| VIEWER | 閲覧者 | 20 |

### 権限

| 権限コード | 説明 | リソース | アクション |
|-------------|------|----------|----------|
| USER_CREATE | ユーザー作成 | users | create |
| USER_READ | ユーザー閲覧 | users | read |
| USER_UPDATE | ユーザー更新 | users | update |
| USER_DELETE | ユーザー削除 | users | delete |
| ROLE_MANAGE | 権限管理 | roles | manage |
| DATA_EDIT | データ編集 | data | edit |
| DATA_VIEW | データ閲覧 | data | view |
| REPORT_CREATE | レポート作成 | reports | create |
| REPORT_VIEW | レポート閲覧 | reports | view |