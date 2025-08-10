# セキュリティ実装ルール (Security Implementation Rules)

## ⚠️ Google固有のセキュリティ実装

### Google OAuth 2.0の特殊要件
```typescript
/**
 * 重要: GoogleのWeb ApplicationタイプではPKCE使用時もclient_secret必須
 * これは標準OAuth 2.0仕様とは異なる実装
 */
export class GoogleOAuthService {
  // バックエンドプロキシ経由での実装を推奨
  async exchangeCodeForToken(code: string, codeVerifier: string) {
    // フロントエンドでは直接実行しない
    // バックエンドAPIを経由
    const response = await fetch('/api/auth/google/token', {
      method: 'POST',
      body: JSON.stringify({
        code,
        codeVerifier,
        // client_secretはバックエンドで管理
      }),
    });
    
    return response.json();
  }
}

// バックエンド実装
export class BackendGoogleAuthService {
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET; // 環境変数から
  
  async exchangeCodeForToken(code: string, codeVerifier: string) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: this.clientSecret!, // バックエンドでのみ使用
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    
    return tokenResponse.json();
  }
}
```

### セキュリティベストプラクティス

1. **Client Secretの管理**
   - **必須**: client_secretは必ずバックエンドのみで管理
   - **禁止**: フロントエンドコードにclient_secretを含めない
   - **推奨**: 環境変数で管理し、バージョン管理システムには含めない

2. **PKCE実装**
   - Google OAuth 2.0でもPKCEを実装（追加のセキュリティ層として）
   - code_verifierは最低43文字、最大128文字のランダム文字列
   - code_challengeはcode_verifierのSHA256ハッシュのBase64URL形式

3. **State検証**
   - CSRF攻撃防止のため、必ずstate parameterを使用
   - stateは予測不可能なランダム値
   - セッション内で保持し、コールバック時に検証

4. **トークン管理**
   - アクセストークンは暗号化して保存（AES-256-GCM推奨）
   - リフレッシュトークンはセキュアなhttpOnlyクッキーで管理
   - トークンの有効期限を適切に設定・検証

5. **エラーハンドリング**
   - 詳細なエラー情報をクライアントに返さない
   - ログには詳細を記録するが、レスポンスは汎用的なメッセージ
   - 認証失敗時のレート制限を実装

### 2025年3月14日までの移行チェックリスト

- [ ] Less Secure Apps (LSA) を使用していないか確認
- [ ] パスワードベース認証を OAuth 2.0 に移行
- [ ] IMAP/SMTP/POP接続をOAuth 2.0対応に更新
- [ ] client_secretの安全な管理体制を確立
- [ ] バックエンドプロキシパターンの実装
- [ ] PKCEとState検証の実装
- [ ] トークン暗号化の実装
- [ ] 監査ログの実装

### コード例：安全な認証フロー

#### フロントエンド
```typescript
// 認証開始
const initiateAuth = async () => {
  const state = generateRandomString();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // セッションに保存
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('code_verifier', codeVerifier);
  
  // バックエンドから認証URLを取得
  const { authUrl } = await fetch('/api/auth/google/url', {
    method: 'POST',
    body: JSON.stringify({ state, codeChallenge }),
  }).then(r => r.json());
  
  window.location.href = authUrl;
};

// コールバック処理
const handleCallback = async (code: string, state: string) => {
  // State検証
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid state parameter');
  }
  
  const codeVerifier = sessionStorage.getItem('code_verifier');
  
  // バックエンド経由でトークン取得
  const { accessToken } = await fetch('/api/auth/google/callback', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ code, codeVerifier }),
  }).then(r => r.json());
  
  // クリーンアップ
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('code_verifier');
  
  return accessToken;
};
```

#### バックエンド
```typescript
// 認証URL生成
app.post('/api/auth/google/url', (req, res) => {
  const { state, codeChallenge } = req.body;
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  
  res.json({
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
});

// トークン交換（client_secret使用）
app.post('/api/auth/google/callback', async (req, res) => {
  const { code, codeVerifier } = req.body;
  
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, // ここで使用
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    
    const tokens = await tokenResponse.json();
    
    // JWTトークン生成
    const jwt = generateJWT(tokens.id_token);
    
    // セキュアクッキーで返す
    res.cookie('auth_token', jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8時間
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});
```

### 監査とモニタリング

#### 必須ログ項目
- 認証試行（成功/失敗）
- 権限チェック結果
- トークンリフレッシュ
- 異常なアクセスパターン
- レート制限違反

#### アラート設定
- 連続した認証失敗
- 異常な地域からのアクセス
- 大量のAPI呼び出し
- 権限昇格の試み

## 5. データベースセキュリティ

### 5.1 SQLインジェクション対策
```typescript
// DatabaseSecurity.ts
import { PrismaClient } from '@prisma/client';

export class DatabaseSecurity {
  /**
   * Prismaを使用した安全なクエリ
   * - パラメータ化クエリを自動実装
   */
  static async safeQuery(prisma: PrismaClient) {
    // ✅ 安全: Prismaが自動的にサニタイズ
    const email = "user@example.com'; DROP TABLE users; --";
    const user = await prisma.employee.findUnique({
      where: { email }, // 自動的にエスケープされる
    });
    
    // ✅ 安全: プリペアドステートメント
    const department = "Engineering";
    const employees = await prisma.employee.findMany({
      where: {
        department: department,
        isActive: true,
      },
    });
    
    // ❌ 危険: 生のSQLクエリ（使用を避ける）
    // const rawQuery = `SELECT * FROM employees WHERE email = '${email}'`;
    
    // どうしても生SQLが必要な場合
    const safeRawQuery = await prisma.$queryRaw`
      SELECT * FROM employees 
      WHERE department = ${department}
      AND is_active = true
    `; // テンプレートリテラルでパラメータ化
  }
  
  /**
   * トランザクション分離レベルの設定
   */
  static async secureTransaction(prisma: PrismaClient) {
    return await prisma.$transaction(
      async (tx) => {
        // 重要な操作
        const result = await tx.employee.update({
          where: { id: 1 },
          data: { salary: 100000 },
        });
        
        // 監査ログ
        await tx.auditLog.create({
          data: {
            action: 'SALARY_UPDATE',
            performedBy: 'system',
            details: JSON.stringify({ employeeId: 1, newSalary: 100000 }),
          },
        });
        
        return result;
      },
      {
        isolationLevel: 'Serializable', // 最高の分離レベル
        maxWait: 2000, // 最大待機時間
        timeout: 10000, // タイムアウト
      }
    );
  }
}
```

### 5.2 データ暗号化
```typescript
// DataEncryption.ts
import crypto from 'crypto';

export class DataEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 64;
  
  /**
   * フィールドレベル暗号化
   * - PII（個人識別情報）の暗号化
   */
  encryptField(plaintext: string, key: Buffer): EncryptedData {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }
  
  /**
   * フィールドレベル復号化
   */
  decryptField(encryptedData: EncryptedData, key: Buffer): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * データベース保存前の暗号化処理
   */
  async encryptSensitiveData(employee: any): Promise<any> {
    const encryptionKey = await this.getDatabaseEncryptionKey();
    
    // 暗号化が必要なフィールド
    const sensitiveFields = ['ssn', 'bankAccount', 'phoneNumber'];
    
    const encryptedEmployee = { ...employee };
    
    for (const field of sensitiveFields) {
      if (employee[field]) {
        const encrypted = this.encryptField(employee[field], encryptionKey);
        encryptedEmployee[field] = JSON.stringify(encrypted);
      }
    }
    
    return encryptedEmployee;
  }
  
  /**
   * 暗号化キーの管理
   * - KMS（Key Management Service）を使用
   */
  private async getDatabaseEncryptionKey(): Promise<Buffer> {
    // 本番環境ではAWS KMS、Azure Key Vault、Google Cloud KMSなどを使用
    if (process.env.NODE_ENV === 'production') {
      // KMSから暗号化キーを取得
      return await this.getKeyFromKMS();
    }
    
    // 開発環境では環境変数から
    const key = process.env.DB_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Database encryption key not configured');
    }
    
    return Buffer.from(key, 'hex');
  }
  
  private async getKeyFromKMS(): Promise<Buffer> {
    // AWS KMSの例
    // const kms = new AWS.KMS();
    // const result = await kms.generateDataKey({
    //   KeyId: process.env.KMS_KEY_ID,
    //   KeySpec: 'AES_256',
    // }).promise();
    // return result.Plaintext;
    
    // プレースホルダー
    return Buffer.from('sample-key');
  }
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}
```

## 6. セッション管理セキュリティ

### 6.1 セキュアなセッション設定
```typescript
// SessionConfig.ts
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

export class SessionManager {
  static createSecureSession() {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      socket: {
        tls: process.env.NODE_ENV === 'production',
      },
    });
    
    redisClient.connect();
    
    return session({
      store: new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: 28800, // 8時間
      }),
      
      // セッションID生成
      genid: () => {
        // 暗号学的に安全なID生成
        return crypto.randomBytes(32).toString('hex');
      },
      
      // セッション名（デフォルトの'connect.sid'を変更）
      name: 'sessionId',
      
      // シークレット（複数指定で定期ローテーション可能）
      secret: [
        process.env.SESSION_SECRET_CURRENT!,
        process.env.SESSION_SECRET_PREVIOUS!, // ローテーション用
      ],
      
      // セッション設定
      resave: false, // 変更がない場合は保存しない
      saveUninitialized: false, // 初期化されていないセッションは保存しない
      rolling: true, // アクティビティがあれば有効期限を延長
      
      // Cookieセキュリティ設定
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS必須
        httpOnly: true, // XSS対策
        maxAge: 28800000, // 8時間
        sameSite: 'strict', // CSRF対策
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      },
      
      // セッションデータの暗号化
      proxy: process.env.NODE_ENV === 'production', // プロキシ背後での動作
    });
  }
  
  /**
   * セッションの検証
   */
  static validateSession(req: Request): boolean {
    const session = req.session;
    
    if (!session || !session.userId) {
      return false;
    }
    
    // セッションの有効期限チェック
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      this.destroySession(req);
      return false;
    }
    
    // IPアドレスの検証（セッション固定攻撃対策）
    if (session.ipAddress && session.ipAddress !== req.ip) {
      logger.security('Session IP mismatch detected', {
        sessionIp: session.ipAddress,
        requestIp: req.ip,
        userId: session.userId,
      });
      this.destroySession(req);
      return false;
    }
    
    // User-Agentの検証
    if (session.userAgent && session.userAgent !== req.headers['user-agent']) {
      logger.security('Session User-Agent mismatch detected', {
        sessionUA: session.userAgent,
        requestUA: req.headers['user-agent'],
        userId: session.userId,
      });
      // 警告のみ（ブラウザアップデートなどで変わる可能性があるため）
    }
    
    return true;
  }
  
  /**
   * セッションの再生成（権限昇格時）
   */
  static async regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const oldSession = { ...req.session };
      
      req.session.regenerate((err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 必要なデータのみコピー
        req.session.userId = oldSession.userId;
        req.session.email = oldSession.email;
        
        // 新しいセッション情報を記録
        req.session.ipAddress = req.ip;
        req.session.userAgent = req.headers['user-agent'];
        req.session.createdAt = new Date();
        req.session.expiresAt = new Date(Date.now() + 28800000); // 8時間後
        
        req.session.save((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }
  
  /**
   * セッションの安全な破棄
   */
  static destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!req.session) {
        resolve();
        return;
      }
      
      const sessionId = req.sessionID;
      const userId = req.session.userId;
      
      req.session.destroy((err) => {
        if (err) {
          logger.error('Session destruction failed', { error: err, sessionId });
          reject(err);
          return;
        }
        
        // Cookieも削除
        req.res?.clearCookie('sessionId');
        
        // ログ記録
        logger.info('Session destroyed', { sessionId, userId });
        
        resolve();
      });
    });
  }
}
```

## 7. 監査ログとモニタリング

### 7.1 セキュリティ監査ログ
```typescript
// AuditLogger.ts
export class AuditLogger {
  /**
   * セキュリティイベントのログ記録
   */
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: event.type,
      severity: event.severity,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      details: this.sanitizeDetails(event.details),
      stackTrace: event.error?.stack,
    };
    
    // データベースに保存
    await prisma.auditLog.create({
      data: logEntry,
    });
    
    // 重要なイベントは即座にアラート
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.sendSecurityAlert(logEntry);
    }
    
    // ログファイルにも記録
    logger.security(event.type, logEntry);
  }
  
  /**
   * 認証関連イベント
   */
  static async logAuthEvent(
    type: 'login' | 'logout' | 'failed_login' | 'password_reset',
    userId: string | null,
    ipAddress: string,
    details?: any
  ): Promise<void> {
    await this.logSecurityEvent({
      type: `AUTH_${type.toUpperCase()}`,
      severity: type === 'failed_login' ? 'medium' : 'low',
      userId,
      ipAddress,
      action: type,
      result: type === 'failed_login' ? 'failure' : 'success',
      details,
    });
  }
  
  /**
   * アクセス制御イベント
   */
  static async logAccessEvent(
    userId: string,
    resource: string,
    action: string,
    allowed: boolean,
    reason?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'ACCESS_CONTROL',
      severity: allowed ? 'low' : 'medium',
      userId,
      resource,
      action,
      result: allowed ? 'allowed' : 'denied',
      details: { reason },
    });
  }
  
  /**
   * 異常検知
   */
  static async detectAnomalies(userId: string): Promise<AnomalyResult> {
    // 過去24時間のログを取得
    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { timestamp: 'desc' },
    });
    
    const anomalies: string[] = [];
    
    // 失敗ログイン回数のチェック
    const failedLogins = logs.filter(log => log.eventType === 'AUTH_FAILED_LOGIN');
    if (failedLogins.length > 5) {
      anomalies.push('過度なログイン失敗');
    }
    
    // 異なるIPアドレスからのアクセス
    const uniqueIPs = new Set(logs.map(log => log.ipAddress));
    if (uniqueIPs.size > 3) {
      anomalies.push('複数のIPアドレスからのアクセス');
    }
    
    // 深夜のアクセス
    const nightAccess = logs.filter(log => {
      const hour = new Date(log.timestamp).getHours();
      return hour >= 0 && hour <= 6;
    });
    if (nightAccess.length > 10) {
      anomalies.push('異常な時間帯のアクセス');
    }
    
    // 権限昇格の試み
    const privilegeEscalation = logs.filter(
      log => log.eventType === 'ACCESS_CONTROL' && log.result === 'denied'
    );
    if (privilegeEscalation.length > 3) {
      anomalies.push('権限昇格の試み');
    }
    
    return {
      hasAnomalies: anomalies.length > 0,
      anomalies,
      riskScore: anomalies.length * 25, // 最大100
    };
  }
  
  /**
   * セキュリティアラート送信
   */
  private static async sendSecurityAlert(event: any): Promise<void> {
    // Slack、Email、PagerDutyなどに通知
    const alertMessage = `
      🚨 セキュリティアラート
      
      イベント: ${event.eventType}
      重要度: ${event.severity}
      ユーザー: ${event.userId || 'Unknown'}
      IPアドレス: ${event.ipAddress}
      時刻: ${event.timestamp}
      詳細: ${JSON.stringify(event.details)}
    `;
    
    // 実装例: Slack Webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: alertMessage }),
      });
    }
    
    // 実装例: Email
    // await emailService.send({
    //   to: process.env.SECURITY_TEAM_EMAIL,
    //   subject: `Security Alert: ${event.eventType}`,
    //   body: alertMessage,
    // });
  }
  
  private static sanitizeDetails(details: any): any {
    if (!details) return {};
    
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...details };
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  result?: 'success' | 'failure' | 'allowed' | 'denied';
  details?: any;
  error?: Error;
}

interface AnomalyResult {
  hasAnomalies: boolean;
  anomalies: string[];
  riskScore: number;
}
```

## 8. セキュリティテスト

### 8.1 セキュリティテストの実装
```typescript
// security.test.ts
describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should prevent SQL injection in login', async () => {
      const maliciousEmail = "admin'; DROP TABLE users; --";
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousEmail,
          password: 'password',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
    
    it('should enforce rate limiting on login attempts', async () => {
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          })
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
    
    it('should validate PKCE challenge', async () => {
      const pkce = new PKCEManager();
      const verifier = pkce.generateCodeVerifier();
      const challenge = await pkce.generateCodeChallenge(verifier);
      
      // 異なるverifierでの検証は失敗すべき
      const wrongVerifier = pkce.generateCodeVerifier();
      const isValid = await pkce.verifyChallenge(wrongVerifier, challenge);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('XSS Prevention', () => {
    it('should sanitize HTML input', async () => {
      const xssPayload = '<script>alert("XSS")</script>Hello';
      const response = await request(app)
        .post('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          bio: xssPayload,
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.bio).not.toContain('<script>');
      expect(response.body.data.bio).toBe('Hello');
    });
  });
  
  describe('CSRF Protection', () => {
    it('should reject requests without valid state', async () => {
      const response = await request(app)
        .post('/api/auth/callback')
        .send({
          code: 'auth_code',
          state: 'invalid_state',
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });
  });
  
  describe('Token Security', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken();
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
    
    it('should prevent token replay attacks', async () => {
      const token = await getValidToken();
      
      // トークンを無効化
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      
      // 同じトークンで再度アクセス
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_REVOKED');
    });
  });
});
```

## 9. セキュリティチェックリスト

### 9.1 実装必須項目
```markdown
## 認証・認可
- [ ] PKCE (Proof Key for Code Exchange) の実装
- [ ] State パラメータによるCSRF対策
- [ ] Nonce によるリプレイ攻撃対策
- [ ] JWTトークンの適切な有効期限設定（アクセス: 15分、リフレッシュ: 7日）
- [ ] トークンのブラックリスト機能
- [ ] セッション固定攻撃対策
- [ ] 多要素認証（MFA）のサポート

## 入力検証
- [ ] すべての入力値のバリデーション
- [ ] SQLインジェクション対策（パラメータ化クエリ）
- [ ] XSS対策（HTMLサニタイゼーション）
- [ ] XXE攻撃対策
- [ ] ディレクトリトラバーサル対策
- [ ] コマンドインジェクション対策

## 通信セキュリティ
- [ ] HTTPS強制（HSTS設定）
- [ ] 適切なCORS設定
- [ ] セキュリティヘッダーの設定
- [ ] CSP（Content Security Policy）の実装

## データ保護
- [ ] 機密データの暗号化（AES-256-GCM）
- [ ] パスワードのハッシュ化（bcrypt/scrypt/argon2）
- [ ] PIIデータのマスキング
- [ ] 安全な乱数生成器の使用

## アクセス制御
- [ ] レート制限の実装
- [ ] IPアドレスホワイトリスト/ブラックリスト
- [ ] 権限ベースアクセス制御（RBAC）
- [ ] 最小権限の原則

## 監査・モニタリング
- [ ] セキュリティイベントのログ記録
- [ ] 異常検知システム
- [ ] アラート通知システム
- [ ] 定期的なセキュリティ監査

## エラーハンドリング
- [ ] 機密情報を含まないエラーメッセージ
- [ ] スタックトレースの非表示（本番環境）
- [ ] 適切なHTTPステータスコード

## 開発・運用
- [ ] セキュリティテストの自動化
- [ ] 依存関係の脆弱性スキャン
- [ ] シークレットのセキュアな管理
- [ ] 定期的なセキュリティアップデート
```

## 10. インシデント対応

### 10.1 セキュリティインシデント対応手順
```typescript
// IncidentResponse.ts
export class IncidentResponse {
  /**
   * インシデント検出時の自動対応
   */
  static async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. インシデントの記録
    const incidentId = await this.logIncident(incident);
    
    // 2. 重要度の評価
    const severity = this.assessSeverity(incident);
    
    // 3. 即座の対応
    switch (severity) {
      case 'critical':
        await this.criticalResponse(incident);
        break;
      case 'high':
        await this.highResponse(incident);
        break;
      case 'medium':
        await this.mediumResponse(incident);
        break;
      case 'low':
        await this.lowResponse(incident);
        break;
    }
    
    // 4. 通知
    await this.notifySecurityTeam(incident, incidentId);
    
    // 5. 追跡
    await this.trackIncident(incidentId);
  }
  
  private static async criticalResponse(incident: SecurityIncident): Promise<void> {
    // アカウントの即座のロック
    if (incident.userId) {
      await this.lockUserAccount(incident.userId);
    }
    
    // 関連するセッションの無効化
    await this.invalidateAllSessions(incident.userId);
    
    // IPアドレスのブロック
    if (incident.ipAddress) {
      await this.blockIPAddress(incident.ipAddress);
    }
    
    // サービスの一時停止検討
    if (incident.type === 'DATA_BREACH') {
      await this.initiateEmergencyShutdown();
    }
  }
  
  private static assessSeverity(incident: SecurityIncident): Severity {
    // データ漏洩
    if (incident.type === 'DATA_BREACH') return 'critical';
    
    // 権限昇格の成功
    if (incident.type === 'PRIVILEGE_ESCALATION' && incident.successful) return 'critical';
    
    // 複数回の認証失敗
    if (incident.type === 'BRUTE_FORCE' && incident.attempts > 10) return 'high';
    
    // その他
    return 'medium';
  }
}
```1. Google OAuth 2.0 セキュリティ実装

### 1.1 PKCE (Proof Key for Code Exchange) 必須実装
```typescript
// PKCEManager.ts - RFC 7636準拠の実装
import { createHash, randomBytes } from 'crypto';

export class PKCEManager {
  private readonly MIN_VERIFIER_LENGTH = 43;
  private readonly MAX_VERIFIER_LENGTH = 128;
  private readonly VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  
  /**
   * Code Verifierの生成
   * - 暗号学的に安全な乱数を使用
   * - 最低256ビットのエントロピーを確保
   */
  generateCodeVerifier(): string {
    const length = 128; // 最大長を使用してセキュリティを最大化
    const randomBytes = crypto.getRandomValues(new Uint8Array(length));
    
    let verifier = '';
    for (let i = 0; i < length; i++) {
      verifier += this.VERIFIER_CHARSET[randomBytes[i] % this.VERIFIER_CHARSET.length];
    }
    
    // 生成したverifierをセッションストレージに保存（LocalStorageは使用禁止）
    sessionStorage.setItem('pkce_code_verifier', verifier);
    
    return verifier;
  }
  
  /**
   * Code Challengeの生成
   * - SHA-256ハッシュを使用（SHA-1は使用禁止）
   */
  async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    // Base64URL エンコード（パディングなし）
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * PKCEペアの検証
   * - タイミング攻撃を防ぐため定数時間比較を使用
   */
  async verifyChallenge(verifier: string, challenge: string): Promise<boolean> {
    const expectedChallenge = await this.generateCodeChallenge(verifier);
    return this.constantTimeCompare(expectedChallenge, challenge);
  }
  
  /**
   * 定数時間比較
   * - タイミング攻撃を防ぐための実装
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}

// 使用例
const pkceManager = new PKCEManager();
const codeVerifier = pkceManager.generateCodeVerifier();
const codeChallenge = await pkceManager.generateCodeChallenge(codeVerifier);

// 認証URLの構築
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.append('code_challenge', codeChallenge);
authUrl.searchParams.append('code_challenge_method', 'S256'); // plainは使用禁止
```

### 1.2 State パラメータによるCSRF対策
```typescript
// StateManager.ts - CSRF攻撃対策
export class StateManager {
  private readonly STATE_LENGTH = 32; // 256ビット
  private readonly STATE_EXPIRY = 10 * 60 * 1000; // 10分
  
  /**
   * Stateの生成と保存
   * - 予測不可能な値を生成
   * - セッションストレージに保存（有効期限付き）
   */
  generateState(): string {
    const stateBytes = new Uint8Array(this.STATE_LENGTH);
    crypto.getRandomValues(stateBytes);
    
    const state = Array.from(stateBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // タイムスタンプ付きで保存
    const stateData = {
      value: state,
      timestamp: Date.now(),
      used: false,
    };
    
    sessionStorage.setItem('oauth_state', JSON.stringify(stateData));
    
    return state;
  }
  
  /**
   * Stateの検証
   * - 有効期限チェック
   * - 使用済みチェック
   * - 一度使用したStateは無効化
   */
  validateState(receivedState: string): boolean {
    const storedData = sessionStorage.getItem('oauth_state');
    
    if (!storedData) {
      console.error('No stored state found');
      return false;
    }
    
    const stateData = JSON.parse(storedData);
    
    // 有効期限チェック
    if (Date.now() - stateData.timestamp > this.STATE_EXPIRY) {
      console.error('State expired');
      sessionStorage.removeItem('oauth_state');
      return false;
    }
    
    // 使用済みチェック
    if (stateData.used) {
      console.error('State already used');
      return false;
    }
    
    // 値の比較（定数時間比較）
    const isValid = this.constantTimeCompare(stateData.value, receivedState);
    
    if (isValid) {
      // 使用済みとしてマーク
      stateData.used = true;
      sessionStorage.setItem('oauth_state', JSON.stringify(stateData));
      
      // 5秒後に削除（念のため）
      setTimeout(() => {
        sessionStorage.removeItem('oauth_state');
      }, 5000);
    }
    
    return isValid;
  }
  
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
```

### 1.3 Nonce による リプレイ攻撃対策
```typescript
// NonceManager.ts
export class NonceManager {
  private readonly NONCE_LENGTH = 16; // 128ビット
  private usedNonces: Set<string> = new Set();
  
  generateNonce(): string {
    const nonceBytes = new Uint8Array(this.NONCE_LENGTH);
    crypto.getRandomValues(nonceBytes);
    
    const nonce = btoa(String.fromCharCode(...nonceBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return nonce;
  }
  
  validateNonce(nonce: string): boolean {
    // 既に使用されたNonceかチェック
    if (this.usedNonces.has(nonce)) {
      console.error('Nonce already used - possible replay attack');
      return false;
    }
    
    // 使用済みとして記録
    this.usedNonces.add(nonce);
    
    // メモリ管理：古いNonceを定期的に削除
    if (this.usedNonces.size > 1000) {
      const firstNonce = this.usedNonces.values().next().value;
      this.usedNonces.delete(firstNonce);
    }
    
    return true;
  }
}
```

## 2. トークン管理セキュリティ

### 2.1 トークンの暗号化保存
```typescript
// SecureTokenStorage.ts - AES-256-GCM暗号化
export class SecureTokenStorage {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12; // 96ビット（GCM推奨）
  private readonly TAG_LENGTH = 128; // 認証タグ
  private readonly SALT_LENGTH = 32; // 256ビット
  
  private encryptionKey: CryptoKey | null = null;
  
  /**
   * 暗号化キーの初期化
   * - PBKDF2で鍵導出
   * - 最低10万回のイテレーション
   */
  async initializeKey(password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    
    // パスワードからキーマテリアルを作成
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // PBKDF2で暗号化キーを導出
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // 最低10万回
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
    
    // ソルトを安全に保存
    this.storeSalt(salt);
  }
  
  /**
   * トークンの暗号化
   * - GCMモードで認証付き暗号化
   */
  async encryptToken(token: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const encodedToken = new TextEncoder().encode(token);
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
        tagLength: this.TAG_LENGTH
      },
      this.encryptionKey,
      encodedToken
    );
    
    // IV + 暗号化データを結合
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    // Base64エンコード
    return btoa(String.fromCharCode(...combined));
  }
  
  /**
   * トークンの復号化
   * - 改ざん検出機能付き
   */
  async decryptToken(encryptedToken: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    try {
      const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
      
      const iv = combined.slice(0, this.IV_LENGTH);
      const encryptedData = combined.slice(this.IV_LENGTH);
      
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
          tagLength: this.TAG_LENGTH
        },
        this.encryptionKey,
        encryptedData
      );
      
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      // 復号化失敗は改ざんの可能性
      console.error('Token decryption failed - possible tampering detected');
      throw new Error('Invalid or tampered token');
    }
  }
  
  /**
   * トークンの安全な削除
   * - メモリから完全に削除
   */
  secureDelete(token: string): void {
    // 文字列を上書き（JavaScriptの制限により完全ではない）
    if (typeof token === 'string') {
      token = token.replace(/./g, '\0');
    }
    
    // ストレージから削除
    sessionStorage.removeItem('encrypted_token');
    
    // ガベージコレクションを促す
    if (global.gc) {
      global.gc();
    }
  }
  
  private storeSalt(salt: Uint8Array): void {
    // ソルトは暗号化せずに保存可能（公開情報）
    const saltBase64 = btoa(String.fromCharCode(...salt));
    sessionStorage.setItem('encryption_salt', saltBase64);
  }
}
```

### 2.2 JWTトークンのセキュアな実装
```typescript
// JWTManager.ts
import jwt from 'jsonwebtoken';

export class JWTManager {
  private readonly SECRET_KEY = process.env.JWT_SECRET!;
  private readonly ALGORITHM = 'HS256'; // または RS256 for 非対称鍵
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // 短い有効期限
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  /**
   * アクセストークンの生成
   * - 短い有効期限
   * - 最小限のクレーム
   */
  generateAccessToken(payload: TokenPayload): string {
    // 機密情報は含めない
    const sanitizedPayload = {
      sub: payload.userId,
      email: payload.email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(sanitizedPayload, this.SECRET_KEY, {
      algorithm: this.ALGORITHM,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'auth.example.com',
      audience: 'api.example.com',
      jwtid: this.generateJTI(), // ユニークID
    });
  }
  
  /**
   * リフレッシュトークンの生成
   * - 長い有効期限
   * - データベースに保存
   */
  generateRefreshToken(payload: TokenPayload): string {
    const refreshPayload = {
      sub: payload.userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateJTI(),
    };
    
    const token = jwt.sign(refreshPayload, this.SECRET_KEY, {
      algorithm: this.ALGORITHM,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'auth.example.com',
    });
    
    // データベースに保存（ハッシュ化して保存）
    this.storeRefreshToken(payload.userId, this.hashToken(token));
    
    return token;
  }
  
  /**
   * トークンの検証
   * - 署名検証
   * - 有効期限チェック
   * - ブラックリストチェック
   */
  async verifyToken(token: string, type: 'access' | 'refresh'): Promise<TokenPayload> {
    try {
      // ブラックリストチェック
      if (await this.isBlacklisted(token)) {
        throw new Error('Token is blacklisted');
      }
      
      const decoded = jwt.verify(token, this.SECRET_KEY, {
        algorithms: [this.ALGORITHM],
        issuer: 'auth.example.com',
        audience: type === 'access' ? 'api.example.com' : undefined,
      }) as any;
      
      // トークンタイプの確認
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }
      
      // リフレッシュトークンの場合、DBと照合
      if (type === 'refresh') {
        const isValid = await this.validateRefreshToken(
          decoded.sub,
          this.hashToken(token)
        );
        if (!isValid) {
          throw new Error('Invalid refresh token');
        }
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }
  
  /**
   * トークンの無効化（ブラックリスト追加）
   */
  async revokeToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.jti) {
      await this.addToBlacklist(decoded.jti, decoded.exp);
    }
  }
  
  private generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  
  private async storeRefreshToken(userId: string, hashedToken: string): Promise<void> {
    // データベースに保存
    await prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
  
  private async validateRefreshToken(userId: string, hashedToken: string): Promise<boolean> {
    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId,
        token: hashedToken,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });
    return !!stored;
  }
  
  private async isBlacklisted(token: string): Promise<boolean> {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.jti) return false;
    
    // Redisでブラックリストチェック
    const blacklisted = await redis.get(`blacklist:${decoded.jti}`);
    return !!blacklisted;
  }
  
  private async addToBlacklist(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
    }
  }
}
```

## 3. 入力検証とサニタイゼーション

### 3.1 入力検証ルール
```typescript
// InputValidator.ts
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

export class InputValidator {
  /**
   * メールアドレスの検証
   * - RFC 5322準拠
   * - ドメイン存在チェック（オプション）
   */
  static validateEmail(email: string): ValidationResult {
    // 基本的な形式チェック
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'メールアドレスが必要です' };
    }
    
    // 長さチェック
    if (email.length > 254) {
      return { valid: false, error: 'メールアドレスが長すぎます' };
    }
    
    // RFC 5322準拠チェック
    if (!validator.isEmail(email)) {
      return { valid: false, error: '有効なメールアドレスを入力してください' };
    }
    
    // SQLインジェクション対策
    if (this.containsSQLKeywords(email)) {
      return { valid: false, error: '不正な文字が含まれています' };
    }
    
    return { valid: true, sanitized: email.toLowerCase().trim() };
  }
  
  /**
   * パスワードの検証
   * - 最小8文字
   * - 大文字、小文字、数字、特殊文字を含む
   */
  static validatePassword(password: string): ValidationResult {
    const minLength = 8;
    const maxLength = 128;
    
    if (!password || password.length < minLength) {
      return { valid: false, error: `パスワードは${minLength}文字以上必要です` };
    }
    
    if (password.length > maxLength) {
      return { valid: false, error: `パスワードは${maxLength}文字以下にしてください` };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return {
        valid: false,
        error: 'パスワードは大文字、小文字、数字、特殊文字を含む必要があります'
      };
    }
    
    // 一般的な弱いパスワードのチェック
    if (this.isWeakPassword(password)) {
      return { valid: false, error: 'このパスワードは脆弱です' };
    }
    
    return { valid: true };
  }
  
  /**
   * XSS対策のためのHTMLサニタイゼーション
   */
  static sanitizeHTML(input: string): string {
    // DOMPurifyを使用してXSS攻撃を防ぐ
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    });
  }
  
  /**
   * SQLインジェクション対策
   */
  static sanitizeSQL(input: string): string {
    // Prismaを使用する場合は自動的にサニタイズされるが、念のため
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
      'UNION', 'WHERE', 'OR', 'AND', 'EXEC', 'SCRIPT'
    ];
    
    let sanitized = input;
    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });
    
    // 特殊文字のエスケープ
    sanitized = sanitized
      .replace(/'/g, "''")
      .replace(/"/g, '""')
      .replace(/;/g, '')
      .replace(/--/g, '');
    
    return sanitized;
  }
  
  /**
   * ファイルアップロードの検証
   */
  static validateFileUpload(file: File): ValidationResult {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
    
    // サイズチェック
    if (file.size > maxSize) {
      return { valid: false, error: 'ファイルサイズは10MB以下にしてください' };
    }
    
    // MIMEタイプチェック
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: '許可されていないファイル形式です' };
    }
    
    // 拡張子チェック
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: '許可されていないファイル拡張子です' };
    }
    
    // ファイル名のサニタイゼーション
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 255);
    
    return { valid: true, sanitized: sanitizedName };
  }
  
  private static containsSQLKeywords(input: string): boolean {
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|WHERE|OR|AND)\b)/gi;
    return sqlPattern.test(input);
  }
  
  private static isWeakPassword(password: string): boolean {
    const weakPasswords = [
      'password', '12345678', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein'
    ];
    return weakPasswords.includes(password.toLowerCase());
  }
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}
```

## 4. API セキュリティ

### 4.1 レート制限の実装
```typescript
// RateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export class RateLimiter {
  /**
   * 一般的なAPI用レート制限
   */
  static createStandardLimiter() {
    return rateLimit({
      store: new RedisStore({
        client: redis,
        prefix: 'rate_limit:standard:',
      }),
      windowMs: 15 * 60 * 1000, // 15分
      max: 100, // 最大100リクエスト
      message: 'リクエスト数が制限を超えました。しばらく待ってから再試行してください。',
      standardHeaders: true,
      legacyHeaders: false,
      // IPアドレスの取得（プロキシ環境考慮）
      keyGenerator: (req) => {
        return req.ip || req.headers['x-forwarded-for'] || 'unknown';
      },
      // レート制限時の処理
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          userId: req.user?.id,
        });
        
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'リクエスト制限を超過しました',
            retryAfter: res.getHeader('Retry-After'),
          },
        });
      },
    });
  }
  
  /**
   * 認証API用の厳しいレート制限
   */
  static createAuthLimiter() {
    return rateLimit({
      store: new RedisStore({
        client: redis,
        prefix: 'rate_limit:auth:',
      }),
      windowMs: 15 * 60 * 1000, // 15分
      max: 5, // 最大5回の試行
      skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
      // アカウントロックアウト機能
      onLimitReached: async (req, res) => {
        const email = req.body.email;
        if (email) {
          await lockAccount(email);
          logger.security('Account locked due to rate limit', { email });
        }
      },
    });
  }
  
  /**
   * 動的レート制限（ユーザーの信頼度に基づく）
   */
  static createDynamicLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      
      if (!userId) {
        // 未認証ユーザーは厳しい制限
        return RateLimiter.createStandardLimiter()(req, res, next);
      }
      
      // ユーザーの信頼スコアを取得
      const trustScore = await getUserTrustScore(userId);
      
      // 信頼スコアに基づいてレート制限を調整
      const maxRequests = Math.floor(100 * (1 + trustScore / 100));
      
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: maxRequests,
        keyGenerator: () => userId.toString(),
      });
      
      return limiter(req, res, next);
    };
  }
}

// 使用例
app.use('/api', RateLimiter.createStandardLimiter());
app.use('/api/auth/login', RateLimiter.createAuthLimiter());
app.use('/api/sensitive', RateLimiter.createDynamicLimiter());
```

### 4.2 CORS設定
```typescript
// CORSConfig.ts
import cors from 'cors';

export const corsOptions: cors.CorsOptions = {
  // 許可するオリジン（本番環境では厳密に指定）
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    // 開発環境
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://localhost:3001');
    }
    
    // オリジンなし（同一オリジン）も許可
    if (!origin) {
      return callback(null, true);
    }
    
    // 許可リストチェック
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('CORS policy violation'));
    }
  },
  
  // 認証情報の送信を許可
  credentials: true,
  
  // 許可するメソッド
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  // 許可するヘッダー
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
  ],
  
  // レスポンスに含めるヘッダー
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
  ],
  
  // プリフライトリクエストのキャッシュ時間
  maxAge: 86400, // 24時間
  
  // プリフライトの継続を許可
  preflightContinue: false,
  
  // 成功ステータス
  optionsSuccessStatus: 204,
};

// 使用
app.use(cors(corsOptions));
```

### 4.3 セキュリティヘッダー
```typescript
// SecurityHeaders.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.google.com'],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'", 'https://accounts.google.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      reportUri: '/api/csp-report',
      upgradeInsecureRequests: [],
    },
  },
  
  // Strict-Transport-Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny',
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // Permissions-Policy
  permittedCrossDomainPolicies: false,
});

// カスタムセキュリティヘッダー
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // CORP (Cross-Origin Resource Policy)
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  
  // COOP (Cross-Origin Opener Policy)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // COEP (Cross-Origin Embedder Policy)
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Cache-Control for sensitive data
  if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// 使用
app.use(securityHeaders);
app.use(customSecurityHeaders);
```

##