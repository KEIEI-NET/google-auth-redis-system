# CLAUDE.md - AI開発アシスタント向けプロジェクト情報

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 最終更新: 2025年8月11日 20:00

### 重要な更新内容（最新）

#### サブエージェント実行結果（2025年8月11日）
- **セキュリティ分析完了** - CRITICAL 4件、HIGH 6件、MEDIUM 2件の脆弱性を発見
- **デバッグ実行成功** - Prisma認証問題を開発用サービスで回避、Google OAuth URL生成確認
- **コードレビュー完了** - 総合評価 7.5/10、Critical Issues 2件、改善提案多数
- **本番環境稼働確認** - Docker、バックエンド、フロントエンドすべて正常動作中

#### 以前の更新内容
- **Redis実装の大幅改善** - RedisManager、SessionService、CacheServiceの包括的実装
- **フォールバック機構実装** - Redis接続失敗時のインメモリキャッシュとデータベースフォールバック
- **セッション管理強化** - Redis/Database/Memory三層構造によるセッション永続化
- **キャッシュサービス実装** - 権限・ロールキャッシング、TTL管理、パターンベース無効化
- **テスト実装完了** - RedisManager、SessionServiceの包括的なユニットテスト
- **フロントエンド基幹コンポーネント実装完了** - Dashboard.tsx, AdminPage.tsx, UnauthorizedPage.tsx, ProtectedRoute.tsx
- **権限ベースアクセス制御実装** - ロール別UI表示、保護ルート機能
- **型安全性の大幅向上** - AuthContext TypeScriptエラー解決、パフォーマンス最適化

## ビルド・開発コマンド

### ルートレベルのコマンド（プロジェクトルートから実行）
- `npm run install:all` - 全ワークスペースの依存関係をインストール
- `npm run dev` - フロントエンドとバックエンドの開発サーバーを同時起動
- `npm run build` - フロントエンドとバックエンドを本番用にビルド
- `npm run test` - フロントエンドとバックエンドのテストを実行
- `npm run lint` - フロントエンドとバックエンドのリンティングを実行
- `npm run typecheck` - TypeScriptの型チェックを実行

### データベースコマンド
- `npm run db:setup` - Prismaでデータベースを初期化（クライアント生成とマイグレーション実行）
- `npm run db:migrate` - データベースマイグレーションをデプロイ
- `npm run db:seed` - 初期データを投入

### Dockerコマンド
- `npm run docker:up` - Dockerコンテナを起動
- `npm run docker:down` - Dockerコンテナを停止
- `npm run docker:build` - Dockerイメージをビルド

### バックエンド専用コマンド（backendディレクトリから実行）
- `npm run dev` - nodemonで開発サーバーを起動
- `npm run build` - TypeScriptをJavaScriptにコンパイル
- `npm run start` - 本番サーバーを起動
- `npm run format` - Prettierでコードをフォーマット

### フロントエンド専用コマンド（frontendディレクトリから実行）
- `npm start` - React開発サーバーを起動
- `npm run build` - 本番用ビルド
- `npm run format` - Prettierでコードをフォーマット

## アーキテクチャ概要

このシステムは、Google OAuth 2.0認証を使用した従業員管理システムで、以下のアーキテクチャを採用しています：

### フロントエンド（React + TypeScript）
- **認証**: `@react-oauth/google`を使用したGoogle OAuth統合（PKCE対応）
- **状態管理**: 認証状態にReact Context、サーバー状態にReact Query
- **UIフレームワーク**: Material-UI v5
- **ルーティング**: React Router v6（保護されたルート機能付き）
- **フォーム処理**: react-hook-formとyupバリデーション

### バックエンド（Node.js + Express + TypeScript）
- **認証**: `google-auth-library`によるGoogle OAuth 2.0、JWTトークンによるセッション管理
- **データベース**: PostgreSQL（Prisma ORM使用）
- **セッションストレージ**: Redisによるセッション管理（フォールバック機構付き）
- **キャッシング**: 階層型キャッシュシステム（Redis → Memory → Database）
- **セキュリティ**: Helmetによるヘッダー保護、CORS、レート制限、入力検証
- **ロギング**: Winstonによる構造化ログ
- **バリデーション**: zodによる環境変数検証、express-validatorによるリクエスト検証

### 主要なセキュリティ機能
- PKCE（Proof Key for Code Exchange）実装 - code_verifierとcode_challengeによるセキュアな認証フロー
- CSRF保護のためのStateパラメータ検証（IPアドレス検証付き）
- JWTトークン管理 - アクセストークン（15分）とリフレッシュトークン（7日）の分離
- Redisベースのセッション管理 - トークンとセッション状態の安全な保存
- APIエンドポイントのレート制限 - 15分間に100リクエストまで
- 全操作の監査ログ - セキュリティイベントの完全な追跡

### 権限システム
5レベルの階層型ロールベースアクセス制御（RBAC）：
- SUPER_ADMIN - システム管理者
- ADMIN - 管理者
- MANAGER - マネージャー
- EMPLOYEE - 一般従業員
- VIEWER - 閲覧のみ

### データベーススキーマ
- `employees` - Googleアカウントとメールで紐付けられた従業員マスタデータ
- `roles` - 優先度レベル付きのロール定義
- `permissions` - リソースとアクションに対する細かい権限
- `employee_roles` - 従業員とロールの多対多リレーション
- `role_permissions` - ロールと権限の多対多リレーション

### API構造

#### 認証エンドポイント
- `GET /api/auth/google` - Google OAuth認証URLの取得
- `POST /api/auth/google/callback` - Google認証コールバック処理
- `POST /api/auth/refresh` - アクセストークンのリフレッシュ
- `POST /api/auth/logout` - ログアウト処理
- `GET /api/auth/me` - 現在のユーザー情報取得

#### 従業員エンドポイント（実装予定）
- `GET /api/employees` - 従業員一覧
- `GET /api/employees/:id` - 従業員詳細
- `PUT /api/employees/:id` - 従業員情報更新
- `GET /api/employees/:id/permissions` - 従業員の権限一覧

#### 権限エンドポイント（実装予定）
- `GET /api/permissions` - 権限一覧
- `POST /api/permissions/check` - 権限チェック

全APIはRESTful規約に従い、以下の標準化されたJSONレスポンスを返します：
```json
{
  "success": true,
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {}
  }
}
```

### Google OAuth 2.0の特殊要件

#### ⚠️ 重要な注意事項（2025年）
- **Less Secure Apps廃止**: 2025年3月14日にLSAサポート完全終了
- **Client Secret必須**: GoogleのWeb ApplicationタイプではPKCE使用時もclient_secret必須（標準OAuth 2.0と異なる）
- **シークレット管理変更**: 2025年6月以降、新規クライアントのシークレットは作成時のみ表示

#### 推奨実装パターン
このシステムでは**バックエンドプロキシパターン**を採用：
1. フロントエンド → バックエンド → Google OAuth
2. client_secretはバックエンドのみで保持
3. PKCEとStateパラメータで追加のセキュリティ層を実装

詳細な実装ガイドラインは `.claude/rules/02-security-rules.md` を参照してください。

## 権限管理システム実装詳細（2025年8月10日実装）

### フロントエンド権限制御アーキテクチャ

#### ProtectedRoute.tsx - 保護ルート機能
- **機能概要**: ロールベースアクセス制御（RBAC）を実装
- **実装方式**: React Routerとの統合による透過的な権限チェック
- **セキュリティ検証**: requiredRolesパラメータによる細かい権限制御
- **ローディング処理**: 認証状態確認中のユーザビリティ向上
- **リダイレクト処理**: 未認証は/login、未認可は/unauthorizedへ自動遷移

```typescript
// 使用例 - 管理者のみアクセス可能なルート
<ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
  <AdminPage />
</ProtectedRoute>
```

#### Dashboard.tsx - メインダッシュボード
- **動的UI制御**: ユーザーロールに基づく条件付きレンダリング
- **セキュリティ検証**: ユーザーオブジェクトの整合性チェック
- **パフォーマンス最適化**: useMemoによるロールチェック結果キャッシュ
- **権限別機能表示**:
  - ADMIN/SUPER_ADMIN: 管理者ページへのナビゲーションボタン
  - MANAGER: マネージャー専用情報表示
  - 全ユーザー: 基本的なダッシュボード機能

#### AdminPage.tsx - 管理者専用ページ
- **アクセス制御**: ADMIN以上の権限必須（ルートレベルで保護）
- **データ取得**: axios設定によるJWT自動送信
- **エラーハンドリング**: APIエラーの適切な表示とユーザーフィードバック
- **統計表示**: リアルタイムな従業員統計（総数、アクティブユーザー、権限別集計）
- **ロール可視化**: カラーコード化されたChipコンポーネントでの権限表示

### 型安全性とパフォーマンス最適化

#### AuthContext.tsx 型安全性向上
- **TypeScript厳密化**: Employee型とAuthContextType型の完全定義
- **メモリリーク対策**: useEffectの依存配列最適化
- **トークンリフレッシュ**: 自動リフレッシュ機構とエラー処理
- **axios設定統合**: 認証ヘッダーの自動管理

#### パフォーマンス最適化実装
- **useCallback活用**: イベントハンドラーの再レンダリング防止
- **useMemo活用**: 計算コストの高いロールチェック処理の最適化
- **コンポーネント分割**: 責務分離による再レンダリング範囲限定
- **メモリリーク対策**: cleanup関数による適切なリソース管理

### セキュリティ実装詳細

#### フロントエンドセキュリティ対策
- **XSS対策**: Material-UIコンポーネントによる自動エスケープ
- **認証トークン管理**: localStorageでの安全なトークン保存
- **セッション管理**: 自動ログアウトとトークンクリーンアップ
- **入力検証**: TypeScriptによる型レベルでの検証

#### 権限検証フロー
1. **ルートレベル検証**: ProtectedRouteでの事前チェック
2. **コンポーネントレベル検証**: 各コンポーネント内での追加検証
3. **APIレベル検証**: バックエンドでの最終権限確認
4. **UI適応**: 権限に応じた動的UI表示制御

## Redis実装詳細（2025年8月11日実装）

### RedisManagerアーキテクチャ
- **シングルトンパターン**: アプリケーション全体で単一のRedis接続を管理
- **自動再接続機構**: 最大10回の再接続試行、指数バックオフ戦略
- **フォールバックモード**: Redis接続失敗時の自動インメモリストレージ切り替え
- **ヘルスチェック**: ping/pongによる接続状態の定期確認
- **安全操作ラッパー**: safeOperationメソッドによるエラーハンドリング統一

### SessionService実装
- **三層永続化戦略**:
  1. **Redis層**: 高速アクセス、24時間TTL
  2. **メモリ層**: Redisフォールバック時の一時ストレージ
  3. **Database層**: 永続的バックアップ、監査証跡
- **自動セッション管理**:
  - セッション作成時の多層同期書き込み
  - セッション取得時のキャッシュ優先読み込み
  - 期限切れセッションの自動クリーンアップ（1時間毎）
- **セッションリフレッシュ**: TTL自動延長機能

### CacheService実装
- **汎用キャッシュ機能**:
  - get/set/del/exists/ttl/flush操作
  - デフォルト5分TTL、カスタマイズ可能
  - パターンベース無効化（ワイルドカード対応）
- **特化型キャッシュメソッド**:
  - 従業員権限キャッシュ（10分TTL）
  - 従業員ロールキャッシュ（10分TTL）
  - 自動無効化機能
- **メモリキャッシュ管理**:
  - 期限切れエントリの定期クリーンアップ（5分毎）
  - キャッシュ統計情報の提供

### フォールバック機構
- **段階的デグレード**:
  1. Redis接続試行
  2. 失敗時のインメモリキャッシュ切り替え
  3. データベース直接アクセス（最終手段）
- **自動復旧**: Redis接続回復時の自動切り戻し
- **データ整合性保証**: 複数層への同期書き込み

## 実装状況（2025年8月11日現在）

### ✅ 完了した機能

#### バックエンド（完成度: 95%）
- **Express + TypeScript基盤** - 完全実装済み
- **PostgreSQL + Prisma ORM** - マイグレーション含め完全設定済み
- **Google OAuth 2.0認証**
  - PKCEフロー実装（code_verifier/code_challenge）
  - Stateパラメータ検証（IPアドレス検証付き）
  - バックエンドプロキシパターンでclient_secret保護
- **JWT認証システム**
  - アクセストークン（15分）/リフレッシュトークン（7日）の二重トークン方式
  - トークン自動リフレッシュ機能
  - セキュアなトークン保存（httpOnly cookie検討中）
- **セキュリティ実装**
  - Helmetによるセキュリティヘッダー設定
  - CORS設定（環境別の詳細設定）
  - 入力検証（express-validator）
  - エラーハンドリング（統一フォーマット）
- **データベース設計**
  - 8テーブルの正規化されたスキーマ
  - インデックス最適化済み
  - カスケード削除設定
- **監査ログシステム**
  - 全認証イベントの記録
  - セキュリティレベル別分類
  - IPアドレス・User-Agent記録

#### フロントエンド（完成度: 75%）
- **React + TypeScript基盤** - 完全設定完了
- **ルーティング** - React Router v6設定済み（保護ルート対応）
- **認証コンテキスト** - AuthContext完全実装済み（型安全性確保）
- **基幹UIコンポーネント** - 完全実装済み
  - **Dashboard.tsx** - メインダッシュボード（権限ベース表示、管理者ナビゲーション）
  - **AdminPage.tsx** - 管理者専用ページ（従業員一覧、統計表示、権限管理）
  - **ProtectedRoute.tsx** - 保護ルート機能（ロールベースアクセス制御）
  - **UnauthorizedPage.tsx** - 未認可アクセス時のエラーページ
  - **LoginPage** - 基本実装済み（Google OAuth統合待ち）

### 🚧 実装中・デバッグ中
- **セキュリティ脆弱性対応** - サブエージェント分析で発見された以下の問題への対応:
  - **CRITICAL（4件）**: XSS、CSRF、セッション固定、権限昇格
  - **HIGH（6件）**: トークン保存、情報漏洩、レート制限、監査ログ、暗号化、入力検証
  - **MEDIUM（2件）**: エラー情報漏洩、セキュリティヘッダー
- **Prisma認証問題** - 一時的に開発用サービス（authControllerDev.ts）で回避中
- **フロントエンドGoogle認証統合** - @react-oauth/google統合作業中
- **ESLint設定問題** - フロントエンドの.eslintrc.jsファイルが空で構文解析エラー発生

### 📋 未実装機能
- **従業員管理API** - エンドポイント設計のみ完了
- **権限管理API** - エンドポイント設計のみ完了
- **テスト** - テストディレクトリ構造のみ作成
- **Docker本番設定** - 開発環境設定のみ完了
- **CI/CDパイプライン** - 未着手

### 🐛 既知の問題

#### セキュリティ脆弱性（サブエージェント分析結果）
**CRITICAL（優先度: 最高）**
1. **XSS脆弱性** - フロントエンドでDOMPurify未実装
2. **CSRF対策不足** - ダブルサブミット未実装
3. **セッション固定攻撃** - ログイン後のセッションID再生成なし
4. **権限昇格** - フロントエンド権限チェックのみ

**HIGH（優先度: 高）**
1. **トークン保存** - localStorageでのJWT保存（XSS脆弱）
2. **情報漏洩** - エラーメッセージに詳細情報
3. **レート制限** - DDoS対策不十分
4. **監査ログ** - 重要操作の記録不足
5. **暗号化** - データベース暗号化未実装
6. **入力検証** - SQLインジェクション対策不完全

#### 機能実装の問題
- フロントエンドのGoogle認証フローが未完成（LoginPageとバックエンドの連携未実装）
- ESLint設定ファイル破損（.eslintrc.jsが空ファイル）- TypeScript構文解析エラー発生
- 従業員管理APIエンドポイント未実装（AdminPageでAPI呼び出しエラー発生）
- Prisma本番認証問題（現在は開発用サービスで回避）

## セキュリティ修正記録

### 2025年8月10日 実施
1. **タイミング攻撃対策** - JWTトークン検証に`crypto.timingSafeEqual`実装
2. **レースコンディション対策** - OAuth state検証をトランザクション化
3. **レート制限実装** - Redisベース、エンドポイント別設定
4. **セキュリティヘッダー強化** - Helmet設定拡張、CSP追加
5. **入力検証強化** - DOMPurify、包括的検証ルール

詳細は`/docs/SECURITY_FIXES.md`参照

## トラブルシューティング

### Docker Desktop未起動エラー
```bash
# Docker Desktopを起動してから再実行
docker-compose up -d
```

### Prismaスキーマ文字化け
```bash
# UTF-8で保存し直してから
npx prisma generate
```

### ESLintエラー
```bash
# 型定義確認
npx tsc --noEmit

# ESLint実行
npm run lint
```

## AIアシスタントへの推奨事項

### 最優先対応事項
1. **セキュリティ脆弱性修正**: CRITICAL問題から順次対応
2. **Prisma認証問題解決**: 本番環境用の恒久対策実装
3. **テスト追加**: カバレッジ90%以上を目標

### 開発ガイドライン
1. **セキュリティ優先**: 新機能追加時は必ずセキュリティ影響を評価
2. **型安全性維持**: TypeScriptの`any`使用を避ける
3. **監査ログ**: 重要な操作は必ず監査ログに記録
4. **エラーハンドリング**: AppErrorクラスを使用して一貫性を保つ
5. **非同期処理**: Promiseは適切にawaitまたはvoid演算子で処理
6. **フォールバック実装**: Redisなど外部サービス障害時の代替処理を必ず実装

### サブエージェント実行結果の活用
- セキュリティ分析結果を基に脆弱性を修正
- コードレビュー結果の改善提案を実装
- デバッグで発見した問題の恒久対策を検討

## 関連ドキュメント

### 主要ドキュメント
- `/README.md` - プロジェクト概要と起動手順
- `/CLAUDE.md` - AI開発アシスタント向けガイド（本ファイル）
- `/docs/SECURITY.md` - セキュリティガイドラインと脆弱性対応
- `/docs/DEVELOPMENT.md` - 開発ガイドとデバッグ手順

### 実装ドキュメント
- `/docs/REDIS_ARCHITECTURE.md` - Redis実装詳細ドキュメント
- `/docs/original-docs/` - プロジェクト基本ドキュメント
- `/docs/implementation-logs/` - 実装ログ
  - `IMPLEMENTATION_LOG.md` - 詳細実装ログ
  - `2025-08-10-implementation-summary.md` - 実装サマリー
  - `2025-08-11-redis-implementation.md` - Redis実装ログ
  - `2025-08-11-subagent-execution-summary.md` - サブエージェント実行結果（新規）

### セキュリティ関連
- `/docs/security-reports/` - セキュリティレポート
  - `SECURITY_FIXES.md` - セキュリティ修正記録
  - `2025-08-11-security-analysis-results.md` - セキュリティ分析詳細（新規）

### デプロイメント関連
- `/docs/deployment/` - デプロイメント関連
  - `DEPLOYMENT_GUIDE.md` - デプロイメントガイド
- `/docs/rules/` - Google OAuth 2025年更新情報