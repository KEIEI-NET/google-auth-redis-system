# セキュリティ脆弱性修正記録

このドキュメントは、サブエージェント分析で発見されたセキュリティ脆弱性と、その修正内容を記録したものです。

## 修正日時
2025年8月10日

## 発見された脆弱性と修正内容

### 1. タイミング攻撃の脆弱性（JWT検証）

#### 脆弱性の詳細
- **ファイル**: `backend/src/services/jwtService.ts`
- **問題**: リフレッシュトークンの検証で文字列比較に `===` を使用していたため、タイミング攻撃に脆弱
- **影響**: 攻撃者がトークンの文字を推測できる可能性

#### 修正内容
```typescript
// 修正前
const tokenRecord = await prisma.refreshToken.findUnique({
  where: { token: hashedToken },
});

// 修正後
const tokenRecords = await prisma.refreshToken.findMany({
  where: {
    expiresAt: { gt: new Date() },
    revokedAt: null,
  },
});

const tokenRecord = tokenRecords.find(record => {
  try {
    const recordHash = Buffer.from(record.token, 'hex');
    const providedHash = Buffer.from(hashedToken, 'hex');
    return recordHash.length === providedHash.length && 
           crypto.timingSafeEqual(recordHash, providedHash);
  } catch {
    return false;
  }
});
```

#### 追加のセキュリティ強化
- リフレッシュトークンのエントロピーを64バイトから128バイトに増加
- ハッシュアルゴリズムをSHA-256からSHA-512に変更

### 2. レースコンディションの脆弱性（OAuth State検証）

#### 脆弱性の詳細
- **ファイル**: `backend/src/services/googleAuthService.ts`
- **問題**: OAuth stateの検証と更新が別々の操作で行われており、同時実行時に二重使用される可能性
- **影響**: CSRF保護が無効化される可能性

#### 修正内容
```typescript
// 修正前
const oauthState = await prisma.oAuthState.findUnique({
  where: { state },
});
// ... 検証処理 ...
await prisma.oAuthState.update({
  where: { state },
  data: { used: true },
});

// 修正後
const oauthState = await prisma.$transaction(async (tx) => {
  const foundState = await tx.oAuthState.findUnique({
    where: { state },
  });
  
  // 検証処理...
  
  const updatedState = await tx.oAuthState.update({
    where: { id: foundState.id },
    data: { used: true },
  });
  
  return updatedState;
});
```

### 3. レート制限の欠如

#### 脆弱性の詳細
- **問題**: APIエンドポイントにレート制限がなく、ブルートフォース攻撃やDoS攻撃に脆弱
- **影響**: サービスの可用性低下、認証試行の総当たり攻撃

#### 修正内容

##### 新規ファイル作成
- `backend/src/middleware/rateLimiter.ts`
- `backend/src/config/redis.ts`

##### 実装した制限
1. **一般API制限**: 15分間に100リクエスト
2. **認証エンドポイント制限**: 15分間に5リクエスト（成功時はカウントしない）
3. **トークンリフレッシュ制限**: 1時間に10リクエスト
4. **OAuth開始制限**: 5分間に3リクエスト
5. **動的制限**: ユーザーロールに基づく制限（管理者は5倍、マネージャーは2倍）

##### ルートへの適用
```typescript
// backend/src/routes/authRoutes.ts
router.get('/google', oauthInitLimiter, AuthController.getGoogleAuthUrl);
router.post('/google/callback', authLimiter, ...oauthValidation.callback, AuthController.handleGoogleCallback);
router.post('/refresh', refreshTokenLimiter, ...oauthValidation.refresh, AuthController.refreshToken);
```

### 4. セキュリティヘッダーの不足

#### 脆弱性の詳細
- **問題**: 基本的なセキュリティヘッダーのみで、包括的な保護が不足
- **影響**: XSS、クリックジャッキング、その他の攻撃に脆弱

#### 修正内容

##### 新規ファイル作成
- `backend/src/middleware/security.ts`

##### 実装したヘッダー
```typescript
// カスタムセキュリティヘッダー
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

// Helmet設定の強化
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- Cross-Origin Embedder Policy
- Cross-Origin Opener Policy
- Cross-Origin Resource Policy
```

### 5. 入力検証とサニタイゼーションの不足

#### 脆弱性の詳細
- **問題**: 統一的な入力検証とサニタイゼーションの欠如
- **影響**: XSS、SQLインジェクション、その他のインジェクション攻撃

#### 修正内容

##### 新規ファイル作成
- `backend/src/middleware/validation.ts`

##### 実装した検証
1. **汎用サニタイゼーション関数**
   - HTMLタグの除去（DOMPurify使用）
   - 特殊文字のエスケープ
   - トリミング

2. **検証ルール**
   - メール検証（正規化含む）
   - 従業員ID検証（英数字とハイフンのみ）
   - 名前検証（使用可能文字の制限）
   - ロールコード検証（ホワイトリスト）
   - OAuth state/code検証
   - ページネーション検証

3. **XSS防止ミドルウェア**
   ```typescript
   // 全てのリクエストボディとクエリパラメータをサニタイズ
   app.use(xssPrevention);
   ```

### 6. エラーハンドリングの改善

#### 修正内容

##### backend/src/middleware/errorHandler.ts の更新
1. **セキュリティエラーの特別処理**
   ```typescript
   const securityErrors = [
     ErrorCode.RATE_LIMIT_EXCEEDED,
     ErrorCode.OAUTH_STATE_INVALID,
     ErrorCode.INVALID_TOKEN,
     ErrorCode.TOKEN_EXPIRED,
     ErrorCode.FORBIDDEN,
   ];
   ```

2. **CORSポリシー違反の処理**
3. **監査ログへの統合強化**

### 7. パッケージのインストール

#### 追加したセキュリティ関連パッケージ
```bash
npm install express-rate-limit rate-limit-redis
```

### 8. ESLint設定とコード品質改善

#### 新規ファイル作成
- `backend/.eslintrc.js`

#### 修正した主なコード品質問題
1. **型安全性の向上**
   - `{}` 型を `Record<string, never>` に変更
   - `any` 型の使用を削減
   - 型アサーションの追加

2. **非同期処理の改善**
   - Promiseの適切な処理
   - `void` 演算子の使用

3. **セキュリティルールの追加**
   ```javascript
   'no-eval': 'error',
   'no-implied-eval': 'error',
   'no-new-func': 'error',
   'no-script-url': 'error',
   'no-with': 'error',
   ```

## 監査ログの強化

### backend/src/services/auditService.ts の改善
- 型安全性の向上（`any` から `Record<string, unknown>` へ）
- 返り値の型定義を明確化

## 設定ファイルの更新

### backend/src/app.ts の更新
1. レート制限ミドルウェアの統合
2. セキュリティヘッダーミドルウェアの統合
3. XSS防止ミドルウェアの統合
4. Content-Type検証の追加

### backend/src/server.ts の更新
- Redis接続管理の改善
- グレースフルシャットダウンの確実な実装

## 今後の推奨事項

1. **定期的なセキュリティ監査**
   - 依存関係の脆弱性スキャン
   - ペネトレーションテスト

2. **追加のセキュリティ機能**
   - Web Application Firewall (WAF) の導入
   - 侵入検知システム (IDS) の実装
   - セキュリティイベントの SIEM 統合

3. **コンプライアンス**
   - GDPR対応の個人情報処理
   - ログ保持ポリシーの実装
   - データ暗号化の強化

## まとめ

これらの修正により、アプリケーションのセキュリティは大幅に向上しました。特に：
- タイミング攻撃への耐性
- 同時実行時の安全性
- ブルートフォース攻撃への防御
- インジェクション攻撃への防御
- 包括的なセキュリティヘッダー

継続的なセキュリティ改善と監視により、システムの安全性を維持することが重要です。