import { Employee, Role, Permission } from '@prisma/client';
import { Request } from 'express';

// JWTペイロード
export interface JwtPayload {
  sub: string; // employeeId
  email: string;
  roles: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Google OAuthトークンレスポンス
export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token: string;
}

// Googleユーザー情報
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  locale?: string;
  hd?: string; // ホストドメイン（Google Workspace）
}

// 認証リクエストの拡張
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  sessionId?: string;
}

// APIレスポンス型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ログインレスポンス (Tokens are now handled via httpOnly cookies)
export interface LoginResponse {
  employee: {
    id: number;
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    position?: string;
    roles: string[];
  };
}

// セッションデータ
export interface SessionData {
  employeeId: string;
  email: string;
  roles: string[];
  permissions: string[];
  ipAddress?: string;
  userAgent?: string;
}

// OAuth Stateデータ
export interface OAuthStateData {
  state: string;
  codeVerifier: string;
  redirectUri?: string;
}

// 従業員情報（権限付き）
export interface EmployeeWithPermissions extends Employee {
  employeeRoles: {
    role: Role & {
      rolePermissions: {
        permission: Permission;
      }[];
    };
  }[];
}

// ページネーションオプション
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ページネーション結果
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// エラータイプ
export enum ErrorCode {
  // 認証エラー
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // 認可エラー
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // リソースエラー
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // バリデーションエラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // サーバーエラー
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // レートリミット
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // OAuthエラー
  OAUTH_STATE_INVALID = 'OAUTH_STATE_INVALID',
  OAUTH_CODE_INVALID = 'OAUTH_CODE_INVALID',
  GOOGLE_AUTH_FAILED = 'GOOGLE_AUTH_FAILED',
}

// カスタムエラークラス
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// 監査ログイベントタイプ
export enum AuditEventType {
  // 認証イベント
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // ユーザー管理
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  
  // 権限管理
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  
  // アクセス制御
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // セキュリティ
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN_USED = 'INVALID_TOKEN_USED',
}

// 監査ログレベル
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}