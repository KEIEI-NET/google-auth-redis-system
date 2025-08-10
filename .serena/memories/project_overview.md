# Google Auth Employee System - プロジェクト概要

## プロジェクト目的
Google OAuth 2.0認証を使用した従業員管理システム。階層型ロールベースアクセス制御（RBAC）を実装。

## 技術スタック
### フロントエンド
- React + TypeScript
- Material-UI v5
- React Router v6
- @react-oauth/google (PKCE対応)
- React Context (認証状態管理)
- React Query (サーバー状態管理)
- react-hook-form + yup (フォーム処理)

### バックエンド  
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- Redis (セッション管理)
- JWT認証 (15分アクセス/7日リフレッシュ)
- Helmet (セキュリティヘッダー)
- Winston (ログ)
- express-validator (入力検証)

## セキュリティ機能
- PKCE OAuth 2.0フロー
- CSRF保護 (State検証 + IP検証)
- レート制限 (Redis)
- 監査ログ
- タイミング攻撃対策

## 権限システム
5レベル階層: SUPER_ADMIN > ADMIN > MANAGER > EMPLOYEE > VIEWER