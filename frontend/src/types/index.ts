// API Response Types
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

// User/Employee Types
export interface Employee {
  id: number;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  position?: string;
  roles: string[];
  permissions?: string[];
  isActive: boolean;
  lastLogin?: string;
}

// Auth Types
export interface LoginResponse {
  employee: Employee;
  // Note: Tokens are now handled via httpOnly cookies on the backend
}

export interface GoogleAuthResponse {
  authUrl: string;
  state: string;
}

// Auth Context Types
export interface AuthContextType {
  user: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: Employee) => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

// Error Types
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Server errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // OAuth errors
  OAUTH_STATE_INVALID = 'OAUTH_STATE_INVALID',
  OAUTH_CODE_INVALID = 'OAUTH_CODE_INVALID',
  GOOGLE_AUTH_FAILED = 'GOOGLE_AUTH_FAILED',
}

// Role Types
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  VIEWER = 'VIEWER',
}

// Permission Types
export enum Permission {
  // User management
  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  
  // Role management
  ROLE_MANAGE = 'ROLE_MANAGE',
  
  // Data access
  DATA_EDIT = 'DATA_EDIT',
  DATA_VIEW = 'DATA_VIEW',
  
  // Reports
  REPORT_CREATE = 'REPORT_CREATE',
  REPORT_VIEW = 'REPORT_VIEW',
}