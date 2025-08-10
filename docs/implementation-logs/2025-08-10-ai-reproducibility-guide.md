# AI再現性ガイド - 従業員管理システム継続開発

**作成日**: 2025年8月10日  
**対象**: 将来のAIアシスタント向け継続開発ガイド  
**プロジェクト**: Google OAuth 2.0 従業員管理システム

## プロジェクト現状サマリー（2025年8月10日 18:30現在）

### 全体完成度: 82% (23/28タスク完了)
- **バックエンド**: 95% 完成（認証・セキュリティ・DB設計完了）
- **フロントエンド**: 75% 完成（基幹コンポーネント実装済み、Google認証統合待ち）
- **テスト**: 0% （未着手）

### 重要な実装成果
1. **権限ベースアクセス制御システム完成** - RBAC実装、5レベル権限階層
2. **セキュリティ強化完了** - タイミング攻撃対策、レート制限、監査ログ
3. **フロントエンド基幹コンポーネント実装** - Dashboard, AdminPage, ProtectedRoute等

## 緊急修正項目（次回セッション最優先）

### 🔴 CRITICAL問題（即座に修正必要）
1. **ESLint設定修復**: `frontend/.eslintrc.js`が空ファイル → 全TypeScriptファイルで構文解析エラー
2. **XSS脆弱性修正**: DOMPurify導入による出力サニタイゼーション
3. **CSRF攻撃対策**: CSRFトークン実装
4. **権限昇格脆弱性**: サーバーサイド権限検証強化

### 実行コマンド例（緊急修正用）
```bash
# ESLint設定修復
cd frontend
npx create-react-app . --template typescript --force-overwrite-config

# セキュリティライブラリ導入
npm install dompurify @types/dompurify csrf express-rate-limit

# 型チェック実行
npm run typecheck
```

## プロジェクト構造とファイルマップ

### 重要な設定ファイル
- `C:\Users\kenji\Dropbox\AI開発\dev\Tools\google-auth-employee-system\.env` - 環境変数（Googleクライアント情報）
- `C:\Users\kenji\Dropbox\AI開発\dev\Tools\google-auth-employee-system\backend\prisma\schema.prisma` - データベーススキーマ
- `C:\Users\kenji\Dropbox\AI開発\dev\Tools\google-auth-employee-system\CLAUDE.md` - AIアシスタント向けプロジェクト情報
- `C:\Users\kenji\Dropbox\AI開発\dev\Tools\google-auth-employee-system\TODO.md` - タスク管理

### 実装完了コンポーネント
```
frontend/src/components/
├── admin/AdminPage.tsx          ✅ 管理者ページ（統計・従業員一覧）
├── auth/
│   ├── ProtectedRoute.tsx       ✅ 保護ルート（RBAC実装）
│   ├── UnauthorizedPage.tsx     ✅ 未認可エラーページ
│   └── LoginPage.tsx            ⚠️  基本実装済み（Google連携未完成）
├── dashboard/Dashboard.tsx      ✅ メインダッシュボード（権限別表示）
└── contexts/AuthContext.tsx     ✅ 認証コンテキスト（型安全性向上済み）
```

### 未実装バックエンドAPI
```
backend/src/routes/
├── employees.ts    ❌ 従業員管理エンドポイント（AdminPage要求）
├── permissions.ts  ❌ 権限管理エンドポイント
└── auth.ts        ✅ 認証エンドポイント（完成）
```

## Google OAuth 2.0 実装要点（2025年最新対応）

### 重要な制約事項
- **Client Secret必須**: GoogleのWeb ApplicationタイプではPKCE使用時もclient_secret必須
- **Less Secure Apps廃止**: 2025年3月14日完全終了
- **バックエンドプロキシパターン採用**: client_secretをバックエンドで保護

### 実装済み認証フロー
1. フロントエンド → バックエンド `/api/auth/google` (認証URL取得)
2. Google OAuth認証画面
3. コールバック → バックエンド `/api/auth/google/callback`
4. PKCEフロー + Stateパラメータ検証
5. JWTトークン発行（アクセス15分 + リフレッシュ7日）

### 未完成部分
- LoginPageとバックエンドAPIの連携
- @react-oauth/googleライブラリとの統合

## データベース設計（実装済み）

### 主要テーブル
```sql
employees          -- 従業員マスタ（Googleアカウント紐付け）
roles             -- 権限ロール（5階層）
permissions       -- 細かい権限定義
employee_roles    -- 従業員-ロール関連
role_permissions  -- ロール-権限関連
audit_logs        -- 監査ログ
oauth_states      -- OAuth状態管理
sessions          -- セッション管理
```

### 権限システム階層
1. **SUPER_ADMIN** - システム管理者（優先度1）
2. **ADMIN** - 管理者（優先度2）
3. **MANAGER** - マネージャー（優先度3）
4. **EMPLOYEE** - 一般従業員（優先度4）
5. **VIEWER** - 閲覧のみ（優先度5）

## セキュリティ実装状況

### ✅ 実装済みセキュリティ機能
- PKCEフロー（code_verifier/code_challenge）
- Stateパラメータ検証（IP検証付き）
- JWTトークン管理（二重トークン方式）
- タイミング攻撃対策（crypto.timingSafeEqual）
- レースコンディション対策（トランザクション化）
- Helmetセキュリティヘッダー
- Express Rate Limiting

### ❌ 未修正セキュリティ問題
- XSS脆弱性（HTML出力サニタイゼーション不完全）
- CSRF攻撃対策不十分
- セッション固定攻撃対策未実装
- 認証トークンの不適切な保存（localStorage使用）

## 開発環境セットアップ

### 必要な環境
- **Node.js**: v18+
- **PostgreSQL**: v13+
- **Redis**: v6+
- **Docker Desktop** (開発環境用)

### 初期設定コマンド
```bash
# プロジェクトルートで実行
npm run install:all      # 全依存関係インストール
npm run db:setup        # DB初期化
npm run docker:up       # PostgreSQL + Redis起動
npm run dev             # 開発サーバー起動
```

### トラブルシューティング
```bash
# Docker Desktop未起動エラー
docker-compose up -d

# Prismaスキーマ文字化け
npx prisma generate --schema=./backend/prisma/schema.prisma

# ESLint設定問題
cd frontend && npx create-react-app . --template typescript --force-overwrite-config
```

## 次期開発計画（優先順位付き）

### Phase 1: 緊急修正（1-2セッション）
1. **ESLint設定修復** - 開発効率向上
2. **セキュリティCRITICAL問題修正** - DOMPurify, CSRF対策
3. **従業員管理API実装** - AdminPageで必要

### Phase 2: 機能完成（2-3セッション）
1. **Google OAuth統合完成** - フロントエンド認証完了
2. **権限管理API実装** - 完全なRBACシステム
3. **エラーハンドリング強化** - ユーザビリティ向上

### Phase 3: 品質向上（2-3セッション）
1. **単体テスト実装** - Jest + React Testing Library
2. **統合テスト実装** - API + 認証フローテスト
3. **E2Eテスト実装** - Cypress等

### Phase 4: 本番準備（1-2セッション）
1. **本番Docker設定** - multi-stage build
2. **CI/CDパイプライン** - GitHub Actions
3. **モニタリング設定** - ログ分析とアラート

## コード品質ガイドライン

### TypeScript厳密化
- `any`型の使用禁止
- strict modeの維持
- 型安全性の確保

### React最適化
- useCallback/useMemoryの適切な使用
- 不要な再レンダリング防止
- メモリリーク対策

### セキュリティ原則
- 入力検証の徹底
- 出力エスケープの実装
- 権限チェックの多重化
- 監査ログの記録

## API仕様（実装ガイド）

### 従業員管理API（未実装）
```typescript
// GET /api/employees - 従業員一覧
interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

// PUT /api/employees/:id - 従業員情報更新
interface EmployeeUpdateRequest {
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  roles?: string[];
}
```

### 権限チェックAPI（未実装）
```typescript
// POST /api/permissions/check - 権限チェック
interface PermissionCheckRequest {
  resource: string;
  action: string;
}

interface PermissionCheckResponse {
  success: boolean;
  data: {
    hasPermission: boolean;
    reason?: string;
  };
}
```

## ドキュメント構造

### 重要ドキュメント
- `CLAUDE.md` - AIアシスタント向け総合ガイド
- `TODO.md` - タスク進捗管理
- `docs/README.md` - ドキュメント案内
- `docs/security-reports/` - セキュリティ分析結果
- `docs/implementation-logs/` - 実装記録

### 更新すべきドキュメント（実装後）
- 実装ログの追記
- セキュリティレポート更新
- API仕様書の追加

## エラーパターンと解決策

### よくある問題
1. **PostgreSQL接続エラー**: Docker Desktopの起動確認
2. **Prisma生成エラー**: UTF-8エンコーディング確認
3. **TypeScript型エラー**: 型定義の更新
4. **認証エラー**: 環境変数の設定確認

### デバッグ手順
1. ログファイル確認: `backend/logs/`
2. データベース状態確認: `npx prisma studio`
3. Redis状態確認: `redis-cli ping`
4. 環境変数確認: `.env`ファイル検証

## 継続開発のためのチェックリスト

### セッション開始時
- [ ] CLAUDE.mdとTODO.mdの最新状況確認
- [ ] 前回の実装ログレビュー
- [ ] 既知の問題の影響確認
- [ ] 開発環境の起動確認

### 実装中
- [ ] セキュリティ影響の評価
- [ ] 型安全性の維持
- [ ] パフォーマンスへの配慮
- [ ] 監査ログの記録

### セッション終了時
- [ ] 実装ログの更新
- [ ] ドキュメント更新
- [ ] 既知の問題リスト更新
- [ ] 次回優先事項の明確化

この包括的なガイドにより、将来のAIアシスタントは現在の実装状況を正確に把握し、効率的に継続開発を進めることができます。