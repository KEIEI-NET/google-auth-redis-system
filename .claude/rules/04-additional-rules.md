# 追加実装ルール (Additional Implementation Rules)

## ⚠️ 2025年Google OAuth変更対応

### 必須移行タスク（2025年3月14日期限）
1. **Less Secure Apps廃止対応**
   - すべてのパスワードベース認証をOAuth 2.0に移行
   - IMAP/POP/SMTP/CalDAV/CardDAVもOAuth化
   - Google Syncの使用停止

2. **Client Secret管理の新方式（2025年6月以降）**
   - 作成時のダウンロード必須（後から確認不可）
   - 環境変数での管理徹底
   - バックエンドでのみ使用

3. **Google固有実装への対応**
   - PKCE単体では不十分（client_secret必須）
   - バックエンドプロキシパターンの採用
   - フロントエンドからのclient_secret完全排除

## 1. Google Cloud Console設定ルール（2025年版）

### 1.1 プロジェクト設定チェックリスト
```markdown
## 必須設定項目

### プロジェクト作成
- [ ] プロジェクト名: `employee-auth-system-{環境}`
- [ ] プロジェクトID: 自動生成または手動設定
- [ ] 組織: 該当する場合は選択
- [ ] 請求先アカウント: OAuth設定のみなら不要

### API有効化（必須）
- [ ] Google+ API
- [ ] Google Identity and Access Management API
- [ ] People API（プロフィール情報取得用）

### API有効化（オプション - 機能拡張時）
- [ ] Gmail API（メール連携が必要な場合）
- [ ] Google Drive API（ファイル連携が必要な場合）
- [ ] Google Calendar API（カレンダー連携が必要な場合）

### OAuth同意画面設定
- [ ] ユーザータイプ: Internal/External の選択
- [ ] アプリ名: 従業員管理システム
- [ ] ユーザーサポートメール: 実在するメールアドレス
- [ ] アプリドメイン: 本番ドメイン
- [ ] 承認済みドメイン: すべての環境のドメイン追加
- [ ] 開発者連絡先: 技術担当者のメール

### スコープ設定
- [ ] 必須スコープ:
  - `openid`
  - `email`
  - `profile`
- [ ] 追加スコープ（必要に応じて）:
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`

### 認証情報作成
- [ ] アプリケーションタイプ: ウェブアプリケーション
- [ ] 名前: `{環境}-web-client`
- [ ] 承認済みJavaScript生成元:
  - 開発: `http://localhost:3000`
  - ステージング: `https://staging.example.com`
  - 本番: `https://app.example.com`
- [ ] 承認済みリダイレクトURI:
  - 開発: `http://localhost:3000/auth/callback`
  - ステージング: `https://staging.example.com/auth/callback`
  - 本番: `https://app.example.com/auth/callback`

### テストユーザー設定（Externalの場合）
- [ ] 開発者のメールアドレス追加
- [ ] テスターのメールアドレス追加
- [ ] デモ用アカウント追加
```

### 1.2 環境別設定管理（2025年対応版）

```typescript
// config/google-oauth.ts
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret?: string; // バックエンドのみ、フロントエンドでは undefined
  redirectUri: string;
  scopes: string[];
  hostedDomain?: string;
  useBackendProxy: boolean; // 2025年: true推奨
}

// バックエンド設定（client_secret含む）
const backendConfig: GoogleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // バックエンドのみ
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['openid', 'email', 'profile'],
  useBackendProxy: true, // 必須
};

// フロントエンド設定（client_secretなし）
const frontendConfig: GoogleOAuthConfig = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
  clientSecret: undefined, // フロントエンドでは絶対に使用しない
  redirectUri: process.env.REACT_APP_REDIRECT_URI!,
  scopes: ['openid', 'email', 'profile'],
  useBackendProxy: true, // バックエンド経由必須
};

// 2025年6月以降のClient Secret取得時の注意
const setupInstructions = `
⚠️ Client Secret取得手順（2025年6月以降）:
1. Google Cloud Console → 認証情報 → OAuth 2.0 クライアント ID作成
2. 作成完了画面でClient Secretが表示される
3. 【重要】この時点で必ずコピー・ダウンロード
4. 環境変数 GOOGLE_CLIENT_SECRET に設定
5. 画面を閉じると二度と表示されません！
`;
```

## 2. エラー処理とリカバリールール

### 2.1 エラー分類と対処方法

```typescript
// errors/error-recovery.ts
export class ErrorRecoveryService {
  private static readonly ERROR_RECOVERY_MAP = {
    // 認証エラー
    'AUTH_TOKEN_EXPIRED': {
      recoverable: true,
      action: 'REFRESH_TOKEN',
      userMessage: 'セッションの有効期限が切れました。再度ログインしています...',
      maxRetries: 3,
    },
    'AUTH_INVALID_TOKEN': {
      recoverable: false,
      action: 'FORCE_LOGOUT',
      userMessage: '認証エラーが発生しました。再度ログインしてください。',
    },
    'AUTH_GOOGLE_API_ERROR': {
      recoverable: true,
      action: 'RETRY_WITH_BACKOFF',
      userMessage: 'Google認証サービスに接続できません。再試行しています...',
      maxRetries: 5,
      backoffMs: 1000,
    },
    
    // ネットワークエラー
    'NETWORK_TIMEOUT': {
      recoverable: true,
      action: 'RETRY_WITH_BACKOFF',
      userMessage: 'ネットワーク接続がタイムアウトしました。再試行しています...',
      maxRetries: 3,
      backoffMs: 2000,
    },
    'NETWORK_OFFLINE': {
      recoverable: true,
      action: 'WAIT_FOR_ONLINE',
      userMessage: 'インターネット接続が切断されています。接続を確認してください。',
    },
    
    // 権限エラー
    'PERMISSION_DENIED': {
      recoverable: false,
      action: 'SHOW_ACCESS_DENIED',
      userMessage: 'この操作を実行する権限がありません。',
    },
    'PERMISSION_ROLE_EXPIRED': {
      recoverable: true,
      action: 'REFRESH_PERMISSIONS',
      userMessage: '権限情報を更新しています...',
    },
    
    // データエラー
    'DATA_NOT_FOUND': {
      recoverable: false,
      action: 'SHOW_NOT_FOUND',
      userMessage: '要求されたデータが見つかりません。',
    },
    'DATA_VALIDATION_ERROR': {
      recoverable: false,
      action: 'SHOW_VALIDATION_ERRORS',
      userMessage: '入力内容にエラーがあります。確認してください。',
    },
    
    // レート制限
    'RATE_LIMIT_EXCEEDED': {
      recoverable: true,
      action: 'WAIT_AND_RETRY',
      userMessage: 'リクエスト制限に達しました。しばらくお待ちください。',
      waitMs: 60000,
    },
  };
  
  static async handleError(error: AppError): Promise<RecoveryResult> {
    const recovery = this.ERROR_RECOVERY_MAP[error.code];
    
    if (!recovery) {
      return {
        recovered: false,
        action: 'SHOW_GENERIC_ERROR',
        message: 'エラーが発生しました。しばらくしてから再度お試しください。',
      };
    }
    
    if (!recovery.recoverable) {
      return {
        recovered: false,
        action: recovery.action,
        message: recovery.userMessage,
      };
    }
    
    // リカバリー処理の実行
    try {
      switch (recovery.action) {
        case 'REFRESH_TOKEN':
          return await this.refreshToken();
        
        case 'RETRY_WITH_BACKOFF':
          return await this.retryWithBackoff(
            error.originalRequest,
            recovery.maxRetries!,
            recovery.backoffMs!
          );
        
        case 'WAIT_FOR_ONLINE':
          return await this.waitForOnline();
        
        case 'REFRESH_PERMISSIONS':
          return await this.refreshPermissions();
        
        case 'WAIT_AND_RETRY':
          return await this.waitAndRetry(recovery.waitMs!);
        
        default:
          return {
            recovered: false,
            action: recovery.action,
            message: recovery.userMessage,
          };
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      return {
        recovered: false,
        action: 'SHOW_GENERIC_ERROR',
        message: 'エラーからの回復に失敗しました。',
      };
    }
  }
  
  private static async refreshToken(): Promise<RecoveryResult> {
    try {
      const newToken = await authService.refreshAccessToken();
      return {
        recovered: true,
        action: 'TOKEN_REFRESHED',
        message: '認証情報を更新しました。',
        data: { token: newToken },
      };
    } catch (error) {
      return {
        recovered: false,
        action: 'FORCE_LOGOUT',
        message: '認証の更新に失敗しました。再度ログインしてください。',
      };
    }
  }
  
  private static async retryWithBackoff(
    request: () => Promise<any>,
    maxRetries: number,
    backoffMs: number
  ): Promise<RecoveryResult> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await request();
        return {
          recovered: true,
          action: 'RETRY_SUCCESS',
          message: 'リクエストに成功しました。',
          data: result,
        };
      } catch (error) {
        if (i === maxRetries - 1) {
          return {
            recovered: false,
            action: 'RETRY_FAILED',
            message: '複数回の再試行に失敗しました。',
          };
        }
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)));
      }
    }
    
    return {
      recovered: false,
      action: 'RETRY_FAILED',
      message: '再試行に失敗しました。',
    };
  }
  
  private static async waitForOnline(): Promise<RecoveryResult> {
    return new Promise((resolve) => {
      const checkOnline = () => {
        if (navigator.onLine) {
          resolve({
            recovered: true,
            action: 'ONLINE_RESTORED',
            message: 'インターネット接続が復旧しました。',
          });
        } else {
          setTimeout(checkOnline, 1000);
        }
      };
      checkOnline();
    });
  }
  
  private static async refreshPermissions(): Promise<RecoveryResult> {
    try {
      const permissions = await permissionService.refreshUserPermissions();
      return {
        recovered: true,
        action: 'PERMISSIONS_REFRESHED',
        message: '権限情報を更新しました。',
        data: { permissions },
      };
    } catch (error) {
      return {
        recovered: false,
        action: 'PERMISSION_REFRESH_FAILED',
        message: '権限情報の更新に失敗しました。',
      };
    }
  }
  
  private static async waitAndRetry(waitMs: number): Promise<RecoveryResult> {
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return {
      recovered: true,
      action: 'WAIT_COMPLETED',
      message: '待機時間が完了しました。再度お試しください。',
    };
  }
}

interface RecoveryResult {
  recovered: boolean;
  action: string;
  message: string;
  data?: any;
}
```

### 2.2 ユーザー通知システム

```typescript
// components/ErrorNotification.tsx
import React from 'react';
import { Alert, Snackbar, Button, CircularProgress } from '@mui/material';

interface ErrorNotificationProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  onRetry,
  onDismiss,
}) => {
  const [recovering, setRecovering] = React.useState(false);
  const [recoveryMessage, setRecoveryMessage] = React.useState('');
  
  React.useEffect(() => {
    if (error) {
      handleErrorRecovery(error);
    }
  }, [error]);
  
  const handleErrorRecovery = async (error: AppError) => {
    setRecovering(true);
    
    const result = await ErrorRecoveryService.handleError(error);
    
    if (result.recovered) {
      setRecoveryMessage('エラーから回復しました');
      setTimeout(() => {
        onDismiss?.();
      }, 2000);
    } else {
      setRecoveryMessage(result.message);
    }
    
    setRecovering(false);
  };
  
  if (!error) return null;
  
  return (
    <Snackbar
      open={!!error}
      autoHideDuration={recovering ? null : 6000}
      onClose={onDismiss}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={error.severity || 'error'}
        action={
          <>
            {recovering && <CircularProgress size={20} />}
            {onRetry && !recovering && (
              <Button color="inherit" size="small" onClick={onRetry}>
                再試行
              </Button>
            )}
            <Button color="inherit" size="small" onClick={onDismiss}>
              閉じる
            </Button>
          </>
        }
      >
        {recovering ? 'エラーから回復しています...' : recoveryMessage || error.message}
      </Alert>
    </Snackbar>
  );
};
```

## 3. パフォーマンス最適化ルール

### 3.1 フロントエンド最適化

```typescript
// hooks/useOptimizedData.ts
import { useQuery, useInfiniteQuery } from 'react-query';
import { useMemo, useCallback, useRef } from 'react';
import { debounce, throttle } from 'lodash';

/**
 * データ取得の最適化フック
 */
export const useOptimizedData = <T>(
  queryKey: string,
  fetchFn: () => Promise<T>,
  options?: OptimizationOptions
) => {
  const {
    enableCache = true,
    cacheTime = 5 * 60 * 1000, // 5分
    staleTime = 30 * 1000, // 30秒
    enablePrefetch = true,
    enableInfiniteScroll = false,
    debounceMs = 300,
    throttleMs = 1000,
  } = options || {};
  
  // キャッシュ戦略
  const queryOptions = {
    queryKey: [queryKey],
    queryFn: fetchFn,
    enabled: enableCache,
    cacheTime,
    staleTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
  
  // 通常のクエリまたは無限スクロール
  const query = enableInfiniteScroll
    ? useInfiniteQuery({
        ...queryOptions,
        getNextPageParam: (lastPage: any) => lastPage.nextCursor,
      })
    : useQuery(queryOptions);
  
  // デバウンス検索
  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => {
      // 検索処理
    }, debounceMs),
    [debounceMs]
  );
  
  // スロットル処理
  const throttledAction = useMemo(
    () => throttle((action: () => void) => {
      action();
    }, throttleMs),
    [throttleMs]
  );
  
  // プリフェッチ
  const prefetchNext = useCallback(async (nextKey: string) => {
    if (enablePrefetch) {
      await queryClient.prefetchQuery({
        queryKey: [nextKey],
        queryFn: fetchFn,
        staleTime: staleTime,
      });
    }
  }, [enablePrefetch, fetchFn, staleTime]);
  
  // 仮想スクロール用のデータ
  const virtualizedData = useMemo(() => {
    if (!query.data) return [];
    
    // 大量データの場合は仮想化
    if (Array.isArray(query.data) && query.data.length > 100) {
      return query.data.slice(0, 100); // 初期表示は100件
    }
    
    return query.data;
  }, [query.data]);
  
  return {
    ...query,
    virtualizedData,
    debouncedSearch,
    throttledAction,
    prefetchNext,
  };
};

interface OptimizationOptions {
  enableCache?: boolean;
  cacheTime?: number;
  staleTime?: number;
  enablePrefetch?: boolean;
  enableInfiniteScroll?: boolean;
  debounceMs?: number;
  throttleMs?: number;
}
```

### 3.2 バックエンド最適化

```typescript
// middleware/performance.ts
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * パフォーマンス最適化ミドルウェア
 */
export class PerformanceMiddleware {
  /**
   * レスポンス圧縮
   */
  static compression() {
    return compression({
      filter: (req, res) => {
        // 圧縮すべきコンテンツタイプ
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // 圧縮レベル（1-9）
      threshold: 1024, // 1KB以上のレスポンスを圧縮
    });
  }
  
  /**
   * キャッシュヘッダー設定
   */
  static cacheControl() {
    return (req: Request, res: Response, next: NextFunction) => {
      // 静的ファイル
      if (req.path.match(/\.(js|css|jpg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年
      }
      // API レスポンス
      else if (req.path.startsWith('/api/')) {
        // 認証系は絶対キャッシュしない
        if (req.path.includes('auth')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        // 読み取り専用データ
        else if (req.method === 'GET') {
          res.setHeader('Cache-Control', 'private, max-age=300'); // 5分
        }
        // 書き込み系
        else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
      
      next();
    };
  }
  
  /**
   * データベースクエリ最適化
   */
  static async optimizeQuery<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    ttl: number = 300
  ): Promise<T> {
    // Redisキャッシュチェック
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // データベースクエリ実行
    const result = await queryFn();
    
    // 結果をキャッシュ
    await redis.set(cacheKey, JSON.stringify(result), 'EX', ttl);
    
    return result;
  }
  
  /**
   * バッチ処理最適化
   */
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
      
      // CPUに余裕を持たせる
      if (i + batchSize < items.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    return results;
  }
}
```

## 4. 本番環境チェックリスト（2025年対応版）

### 4.1 デプロイ前チェックリスト

```markdown
## 2025年必須対応チェック
- [ ] Less Secure Appsからの移行完了（2025年3月14日期限）
- [ ] OAuth 2.0実装完了
- [ ] バックエンドプロキシパターン実装
- [ ] Client Secretがフロントエンドに露出していない
- [ ] Client Secret作成時にダウンロード済み（2025年6月以降）

## セキュリティチェック
- [ ] すべての環境変数が設定されている
- [ ] Client Secretが環境変数で管理されている（バックエンドのみ）
- [ ] HTTPS が強制されている
- [ ] CORS が適切に設定されている
- [ ] レート制限が有効
- [ ] セキュリティヘッダーが設定されている
- [ ] PKCEが実装されている（追加セキュリティ層として）
- [ ] State検証が実装されている（CSRF対策）
- [ ] SQLインジェクション対策が実装されている
- [ ] XSS対策が実装されている

## パフォーマンスチェック
- [ ] データベースインデックスが適切に設定されている
- [ ] N+1問題が解決されている
- [ ] キャッシュが適切に設定されている
- [ ] 画像が最適化されている
- [ ] バンドルサイズが最適化されている
- [ ] 遅延ロードが実装されている

## 信頼性チェック
- [ ] エラーハンドリングが実装されている
- [ ] ログが適切に記録されている
- [ ] 監視が設定されている
- [ ] バックアップが設定されている
- [ ] ヘルスチェックが実装されている
- [ ] グレースフルシャットダウンが実装されている

## テストチェック
- [ ] 単体テストのカバレッジが80%以上
- [ ] 統合テストが実行されている
- [ ] E2Eテストが実行されている
- [ ] セキュリティテストが実行されている
- [ ] パフォーマンステストが実行されている
- [ ] 負荷テストが実行されている

## ドキュメントチェック
- [ ] README.mdが最新
- [ ] API仕様書が最新
- [ ] デプロイ手順書が最新
- [ ] トラブルシューティングガイドが最新
- [ ] 環境変数の説明が記載されている
- [ ] 2025年変更点が明記されている
```

### 4.2 デプロイ後チェックリスト

```markdown
## 即座に確認
- [ ] アプリケーションが起動している
- [ ] ヘルスチェックが成功している
- [ ] ログインフローが正常に動作している
- [ ] 主要な機能が動作している
- [ ] エラーログが出ていない

## 1時間後に確認
- [ ] メモリリークが発生していない
- [ ] CPU使用率が正常
- [ ] レスポンスタイムが正常
- [ ] エラー率が閾値以下
- [ ] データベース接続が安定している

## 24時間後に確認
- [ ] 日次バッチが正常に実行された
- [ ] ログローテーションが動作している
- [ ] バックアップが作成されている
- [ ] アラートが正常に動作している
- [ ] メトリクスが正常に収集されている

## 1週間後に確認
- [ ] 週次レポートが生成されている
- [ ] パフォーマンスが安定している
- [ ] ユーザーからのフィードバック確認
- [ ] セキュリティスキャンの実施
- [ ] 依存関係の更新確認
```

## 5. ClaudeCode への指示テンプレート（2025年版）

### 5.1 初期実装指示

```markdown
以下の手順でGoogle認証従業員管理システムを実装してください：

## ⚠️ 2025年重要対応事項
1. Less Secure Apps廃止（2025年3月14日）への対応必須
2. Google固有要件: PKCE使用時もclient_secret必須
3. 解決策: バックエンドプロキシパターンを採用

## アーキテクチャ
必ず以下の構成で実装してください：
- フロントエンド: client_secretを一切扱わない
- バックエンド: client_secret管理とトークン交換
- 通信: HTTPS必須（本番環境）

## 1. プロジェクトセットアップ
- 提供された「実装手順ルール」の「1. プロジェクト初期設定」に従ってください
- バックエンドプロキシパターンを前提としたディレクトリ構造を作成
- TypeScript設定を適用してください

## 2. 環境設定
- .env.exampleファイルを作成
- GOOGLE_CLIENT_SECRETはbackend/.envのみに配置
- frontend/.envにはGOOGLE_CLIENT_IDのみ配置

## 3. データベース設定
- Prismaスキーマを定義してください
- マイグレーションを作成・実行してください
- シードデータを作成してください

## 4. バックエンド実装（最重要）
- 「セキュリティ実装ルール」の「1.1 バックエンドプロキシパターン」を実装
- Client Secret管理エンドポイントを作成
- PKCEとState検証を実装
- JWTトークン管理を実装

## 5. フロントエンド実装
- Client Secretを一切含まない実装
- バックエンドAPIを経由した認証フロー
- セッションストレージ使用（LocalStorage禁止）

## 6. テスト実装
- バックエンドプロキシのテスト必須
- Client Secret漏洩チェックテスト追加
- PKCE実装の検証テスト

## 注意事項：
1. Client SecretはバックエンドのみでAPIます
2. 2025年3月14日のLSA廃止に対応済みであること
3. PKCEとClient Secretの両方を実装すること
4. エラーハンドリングを適切に実装してください
5. コメントは日本語で記述してください
```

### 5.2 問題解決指示（2025年版）

```markdown
以下のエラーが発生しています。2025年のGoogle OAuth変更を考慮して解決してください：

エラー内容：
[エラーメッセージをここに記載]

確認事項：
1. Less Secure Apps廃止の影響はないか？
2. Client Secretの取り扱いは適切か？
3. PKCEとClient Secretの両方を実装しているか？
4. バックエンドプロキシパターンを使用しているか？

実行環境：
- Node.js バージョン: 
- npm バージョン: 
- OS: 
- 実装パターン: バックエンドプロキシ / 直接実装

試したこと：
1. 
2. 

期待する動作：
[期待する動作を記載]

「追加実装ルール」の2025年対応セクションと
「実装手順ルール」の「8. トラブルシューティングガイド」を参照して、
適切な解決方法を提示し、実装してください。
```

これで、ClaudeCodeに提供するすべてのルールMDファイルが完成しました。これらのドキュメントを使用することで、セキュアで高品質なGoogle認証従業員管理システムを実装できます。