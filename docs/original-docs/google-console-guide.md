# Google Developer Console OAuth 2.0 設定ガイド

## 完全版・トラブルシューティング付き（2025年最新版）

## ⚠️ 2025年重要更新情報

### 🚨 必須対応事項

#### 1. Less Secure Apps (LSA) 完全廃止
- **期限**: 2025年3月14日
- **影響**: パスワードベース認証が完全に使用不可
- **対象プロトコル**: IMAP, POP, SMTP, CalDAV, CardDAV, Google Sync
- **必須対応**: OAuth 2.0への完全移行

#### 2. Client Secret管理の変更
- **適用開始**: 2025年6月以降の新規クライアント
- **変更内容**: 
  - 作成時のみ表示・ダウンロード可能
  - ハッシュ化されて保存（後から確認不可）
  - **重要**: 作成時に必ずダウンロードして安全に保管

#### 3. PKCEとClient Secretの特殊要件
- **Google固有実装**: Web ApplicationタイプではPKCE使用時もclient_secret必須
- **標準OAuth 2.0との違い**: RFC 7636ではPKCE使用時client_secret不要だが、Google実装は異なる
- **推奨対応**: バックエンドプロキシパターンでclient_secretを保護

### 📊 アーキテクチャ選択ガイド

```
あなたのアプリケーションタイプは？
│
├─ Webアプリケーション（SPA含む）
│  └─ 推奨: バックエンドプロキシパターン
│     - フロントエンド → バックエンド → Google OAuth
│     - client_secretはバックエンドのみで管理
│
├─ モバイルアプリ（iOS/Android）
│  └─ 選択肢:
│     1. バックエンドプロキシ（推奨）
│     2. UWPタイプとして登録（回避策）
│
└─ デスクトップアプリ
   └─ 選択肢:
      1. バックエンドプロキシ（推奨）
      2. 限定的なclient_secret埋め込み（非推奨）
```

## 🚨 2025年の重要な変更

### 1. Less Secure Apps廃止（2025年3月14日）
- パスワードベースの認証は完全に使用不可
- IMAP、SMTP、POP、CalDAV、CardDAVもOAuth必須
- 移行しない場合、アクセス不可能に

### 2. Client Secret管理の変更
**新しいクライアント（2025年6月以降）:**
- 作成時のみ表示・ダウンロード可能
- 後から確認不可（ハッシュ化保存）
- **必ず作成時にダウンロードすること**

### 3. PKCEの扱い
**Googleの特殊な実装:**
```
標準OAuth 2.0: PKCE使用時はclient_secret不要
Google実装: Web ApplicationタイプはPKCE使用時もclient_secret必須
```

**推奨アーキテクチャ:**
```
[フロントエンド] 
    ↓ (認証リクエスト)
[バックエンドプロキシ] ← client_secret保管
    ↓ (OAuth通信)
[Google OAuth Server]
```

## 目次