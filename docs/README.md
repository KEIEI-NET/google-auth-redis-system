# プロジェクトドキュメント

このディレクトリには、Google OAuth従業員管理システムの各種ドキュメントが格納されています。

## ディレクトリ構成

### 📁 original-docs/
プロジェクト開始時に作成された基本ドキュメント
- `api-documentation.md` - API仕様書
- `api-specification.md` - API詳細仕様
- `architecture-documentation.md` - アーキテクチャ設計書
- `backend-implementation-guide.md` - バックエンド実装ガイド
- `deployment-guide.md` - デプロイメントガイド
- `development-workflow.md` - 開発ワークフロー
- `google-auth-spec.md` - Google認証仕様
- `google-console-guide.md` - Google Console設定ガイド
- `implementation.yaml` - 実装計画
- `security-best-practices.md` - セキュリティベストプラクティス
- `setup-guide.md` - セットアップガイド
- `testing-documentation.md` - テストドキュメント
- `troubleshooting-guide.md` - トラブルシューティングガイド

### 📁 implementation-logs/
実装作業の記録
- `IMPLEMENTATION_LOG.md` - 2025年8月10日の実装ログ
  - 環境セットアップから実装完了までの全記録
  - 遭遇した問題と解決策
  - 技術的決定事項

### 📁 security-reports/
セキュリティ関連レポート
- `SECURITY_FIXES.md` - セキュリティ脆弱性修正記録
  - サブエージェント分析結果
  - 発見された脆弱性の詳細
  - 実施した修正内容

### 📁 rules/
Google OAuth 2025年更新ルール（プロジェクトルート）
- `01-google-auth-updates-2025.md` - 2025年の認証更新情報
- `02-security-rules.md` - セキュリティ実装ルール
- `03-rbac-rules.md` - ロールベースアクセス制御ルール

## ドキュメント利用ガイド

### 新規開発者向け
1. まず `original-docs/setup-guide.md` でセットアップ
2. `original-docs/architecture-documentation.md` でアーキテクチャを理解
3. `implementation-logs/IMPLEMENTATION_LOG.md` で実装の流れを確認

### セキュリティ担当者向け
1. `security-reports/SECURITY_FIXES.md` で修正済み脆弱性を確認
2. `original-docs/security-best-practices.md` でベストプラクティスを確認
3. `rules/02-security-rules.md` でセキュリティ要件を確認

### AIアシスタント向け
1. プロジェクトルートの `CLAUDE.md` を最初に確認
2. 必要に応じて各ドキュメントを参照

## 更新履歴
- 2025年8月10日: ディレクトリ構造を整理、実装ログとセキュリティレポートを追加