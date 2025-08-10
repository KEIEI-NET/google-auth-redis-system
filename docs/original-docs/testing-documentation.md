# Testing Documentation - Google Authentication Employee Management System

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Testing Strategy](#testing-strategy)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration Testing](#continuous-integration-testing)
10. [Testing Best Practices](#testing-best-practices)

## Testing Overview

### Testing Philosophy
- **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E tests
- **TDD/BDD**: Test-driven and behavior-driven development approaches
- **Shift Left**: Test early and often in the development cycle
- **Automation First**: Automate repetitive tests
- **Coverage Goals**: Maintain minimum 80% code coverage

### Testing Stack
- **Unit Testing**: Jest, React Testing Library
- **Integration Testing**: Supertest, Jest
- **E2E Testing**: Cypress, Playwright
- **Performance Testing**: k6, Artillery
- **Security Testing**: OWASP ZAP, npm audit

## Testing Strategy

### 1. Test Pyramid

```mermaid
graph TB
    subgraph "Test Distribution"
        A[E2E Tests - 10%]
        B[Integration Tests - 30%]
        C[Unit Tests - 60%]
    end
    
    subgraph "Characteristics"
        D[Slow, Expensive, Brittle]
        E[Moderate Speed, Realistic]
        F[Fast, Isolated, Reliable]
    end
    
    A --> D
    B --> E
    C --> F
```

### 2. Testing Levels

| Level | Purpose | Tools | Execution Time |
|-------|---------|-------|----------------|
| Unit | Test individual functions/components | Jest, RTL | < 10s |
| Integration | Test module interactions | Supertest | < 1min |
| E2E | Test complete user flows | Cypress | < 5min |
| Performance | Test system performance | k6 | Variable |
| Security | Test security vulnerabilities | OWASP ZAP | Variable |

### 3. Test Coverage Requirements

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/controllers/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

## Unit Testing

### 1. Backend Unit Tests

#### Service Layer Testing
```typescript
// src/services/__tests__/authService.test.ts
import { AuthService } from '../authService';
import { PrismaClient } from '@prisma/client';
import { JWTService } from '../jwtService';
import { GoogleAuthService } from '../googleAuthService';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockGoogleAuth: jest.Mocked<GoogleAuthService>;

  beforeEach(() => {
    // Create mocks
    mockPrisma = createMockPrismaClient();
    mockJWTService = createMock<JWTService>();
    mockGoogleAuth = createMock<GoogleAuthService>();

    // Initialize service with mocks
    authService = new AuthService(
      mockPrisma,
      mockJWTService,
      mockGoogleAuth
    );
  });

  describe('authenticateWithGoogle', () => {
    it('should create new user on first login', async () => {
      // Arrange
      const googleUser = {
        email: 'newuser@example.com',
        sub: 'google-123',
        given_name: 'John',
        family_name: 'Doe'
      };

      mockGoogleAuth.verifyIdToken.mockResolvedValue(googleUser);
      mockPrisma.employee.findUnique.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue({
        id: 1,
        email: googleUser.email,
        googleId: googleUser.sub,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        employeeId: 'EMP001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };
      mockJWTService.generateTokens.mockReturnValue(tokens);

      // Act
      const result = await authService.authenticateWithGoogle('id-token');

      // Assert
      expect(mockGoogleAuth.verifyIdToken).toHaveBeenCalledWith('id-token');
      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: googleUser.email,
          googleId: googleUser.sub
        })
      });
      expect(result).toEqual({
        employee: expect.objectContaining({
          email: googleUser.email
        }),
        tokens
      });
    });

    it('should update existing user on subsequent login', async () => {
      // Arrange
      const existingUser = {
        id: 1,
        email: 'existing@example.com',
        googleId: 'google-123',
        lastLogin: new Date('2025-01-01')
      };

      mockGoogleAuth.verifyIdToken.mockResolvedValue({
        email: existingUser.email,
        sub: existingUser.googleId
      });
      mockPrisma.employee.findUnique.mockResolvedValue(existingUser);
      mockPrisma.employee.update.mockResolvedValue({
        ...existingUser,
        lastLogin: new Date()
      });

      // Act
      await authService.authenticateWithGoogle('id-token');

      // Assert
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { lastLogin: expect.any(Date) }
      });
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      mockGoogleAuth.verifyIdToken.mockRejectedValue(
        new Error('Invalid token')
      );

      // Act & Assert
      await expect(
        authService.authenticateWithGoogle('invalid-token')
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { sub: '1', type: 'refresh' };
      const employee = { id: 1, email: 'user@example.com' };

      mockJWTService.verifyRefreshToken.mockResolvedValue(decodedToken);
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockJWTService.generateAccessToken.mockReturnValue('new-access-token');

      // Act
      const result = await authService.refreshAccessToken(refreshToken);

      // Assert
      expect(result).toBe('new-access-token');
      expect(mockJWTService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });
  });
});

// Helper function to create Prisma mock
function createMockPrismaClient(): jest.Mocked<PrismaClient> {
  return {
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    // Add other models as needed
  } as any;
}
```

#### Controller Testing
```typescript
// src/controllers/__tests__/authController.test.ts
import { Request, Response } from 'express';
import { AuthController } from '../authController';
import { AuthService } from '../../services/authService';

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockAuthService = createMock<AuthService>();
    authController = new AuthController(mockAuthService);

    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('POST /auth/google/callback', () => {
    it('should authenticate user and return tokens', async () => {
      // Arrange
      mockRequest.body = {
        code: 'auth-code',
        state: 'state',
        codeVerifier: 'verifier'
      };

      const authResult = {
        employee: { id: 1, email: 'user@example.com' },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      };

      mockAuthService.handleGoogleCallback.mockResolvedValue(authResult);

      // Act
      await authController.handleGoogleCallback(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockAuthService.handleGoogleCallback).toHaveBeenCalledWith({
        code: 'auth-code',
        state: 'state',
        codeVerifier: 'verifier'
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accessToken: 'access-token',
          employee: authResult.employee
        }
      });
    });

    it('should handle authentication errors', async () => {
      // Arrange
      mockRequest.body = { code: 'invalid-code' };
      mockAuthService.handleGoogleCallback.mockRejectedValue(
        new Error('Invalid authorization code')
      );

      // Act
      await authController.handleGoogleCallback(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid authorization code'
        })
      );
    });
  });
});
```

### 2. Frontend Unit Tests

#### Component Testing
```typescript
// src/components/__tests__/LoginPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../LoginPage';
import { AuthContext } from '../../contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Mock the Google OAuth library
jest.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: any) => <div>{children}</div>,
  GoogleLogin: ({ onSuccess, onError }: any) => (
    <button
      onClick={() => onSuccess({ credential: 'mock-credential' })}
      data-testid="google-login-button"
    >
      Sign in with Google
    </button>
  )
}));

describe('LoginPage', () => {
  const mockLogin = jest.fn();
  
  const renderWithContext = (component: React.ReactElement) => {
    return render(
      <GoogleOAuthProvider clientId="test-client-id">
        <AuthContext.Provider value={{
          user: null,
          login: mockLogin,
          logout: jest.fn(),
          loading: false
        }}>
          {component}
        </AuthContext.Provider>
      </GoogleOAuthProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login page with Google sign-in button', () => {
    renderWithContext(<LoginPage />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('should call login function on successful Google authentication', async () => {
    renderWithContext(<LoginPage />);

    const googleButton = screen.getByTestId('google-login-button');
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('mock-credential');
    });
  });

  it('should display error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Login failed'));
    
    renderWithContext(<LoginPage />);

    const googleButton = screen.getByTestId('google-login-button');
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('should redirect authenticated users', () => {
    const { rerender } = renderWithContext(<LoginPage />);

    // Simulate authenticated user
    rerender(
      <GoogleOAuthProvider clientId="test-client-id">
        <AuthContext.Provider value={{
          user: { id: 1, email: 'user@example.com' },
          login: mockLogin,
          logout: jest.fn(),
          loading: false
        }}>
          <LoginPage />
        </AuthContext.Provider>
      </GoogleOAuthProvider>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
```

#### Hook Testing
```typescript
// src/hooks/__tests__/useAuth.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthContext } from '../../contexts/AuthContext';
import * as authApi from '../../services/authApi';

jest.mock('../../services/authApi');

describe('useAuth', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false
    }}>
      {children}
    </AuthContext.Provider>
  );

  it('should initialize with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should login user successfully', async () => {
    const mockUser = { id: 1, email: 'user@example.com' };
    (authApi.login as jest.Mock).mockResolvedValue({
      user: mockUser,
      accessToken: 'token'
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('google-credential');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle login errors', async () => {
    (authApi.login as jest.Mock).mockRejectedValue(new Error('Login failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login('invalid-credential');
      } catch (error) {
        expect(error.message).toBe('Login failed');
      }
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Login failed');
  });

  it('should logout user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // First login
    await act(async () => {
      await result.current.login('credential');
    });

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

## Integration Testing

### 1. API Integration Tests

```typescript
// tests/integration/auth.integration.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { redisClient } from '../../src/services/redis';

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
    await redisClient.connect();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear test data
    await prisma.employee.deleteMany();
    await prisma.oAuthState.deleteMany();
    await redisClient.flushall();
  });

  describe('Google OAuth Flow', () => {
    it('should complete full authentication flow', async () => {
      // Step 1: Get auth URL
      const authUrlResponse = await request(app)
        .get('/api/auth/google')
        .expect(200);

      expect(authUrlResponse.body).toMatchObject({
        success: true,
        data: {
          authUrl: expect.stringContaining('accounts.google.com'),
          state: expect.any(String),
          expiresAt: expect.any(String)
        }
      });

      const { state } = authUrlResponse.body.data;

      // Verify state is stored in database
      const storedState = await prisma.oAuthState.findUnique({
        where: { state }
      });
      expect(storedState).toBeTruthy();
      expect(storedState.codeVerifier).toBeTruthy();

      // Step 2: Simulate OAuth callback
      // Mock Google token verification
      jest.spyOn(googleAuthService, 'exchangeCodeForToken')
        .mockResolvedValue({
          id_token: 'mock-id-token',
          access_token: 'mock-access-token'
        });

      jest.spyOn(googleAuthService, 'verifyIdToken')
        .mockResolvedValue({
          email: 'test@example.com',
          sub: 'google-123',
          given_name: 'Test',
          family_name: 'User'
        });

      const callbackResponse = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state,
          codeVerifier: storedState.codeVerifier
        })
        .expect(200);

      expect(callbackResponse.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          employee: {
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        }
      });

      // Verify employee was created
      const employee = await prisma.employee.findUnique({
        where: { email: 'test@example.com' }
      });
      expect(employee).toBeTruthy();
      expect(employee.googleId).toBe('google-123');

      // Step 3: Access protected endpoint
      const { accessToken } = callbackResponse.body.data;

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.data.email).toBe('test@example.com');
    });

    it('should reject invalid state parameter', async () => {
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'auth-code',
          state: 'invalid-state',
          codeVerifier: 'verifier'
        })
        .expect(400);

      expect(response.body.error.code).toBe('OAUTH_STATE_INVALID');
    });

    it('should handle token refresh', async () => {
      // Setup: Create user and tokens
      const employee = await prisma.employee.create({
        data: {
          email: 'refresh@example.com',
          employeeId: 'EMP001',
          firstName: 'Test',
          lastName: 'User',
          googleId: 'google-123'
        }
      });

      const tokens = jwtService.generateTokens({
        sub: employee.id.toString(),
        email: employee.email
      });

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          employeeId: employee.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      // Test refresh
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      
      // Verify old refresh token is revoked
      const oldToken = await prisma.refreshToken.findUnique({
        where: { token: tokens.refreshToken }
      });
      expect(oldToken.revokedAt).toBeTruthy();
    });
  });

  describe('Authorization Integration', () => {
    let authToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Create test users with different roles
      const employee = await createTestEmployee('EMPLOYEE');
      const admin = await createTestEmployee('ADMIN');

      authToken = generateTestToken(employee);
      adminToken = generateTestToken(admin);
    });

    it('should allow access to protected endpoints with valid token', async () => {
      await request(app)
        .get('/api/employees/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should reject access without token', async () => {
      await request(app)
        .get('/api/employees/me')
        .expect(401);
    });

    it('should enforce role-based access', async () => {
      // Employee should not access admin endpoints
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Admin should access admin endpoints
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
```

### 2. Database Integration Tests

```typescript
// tests/integration/database.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { EmployeeRepository } from '../../src/repositories/employeeRepository';

describe('Database Integration Tests', () => {
  let prisma: PrismaClient;
  let employeeRepo: EmployeeRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    employeeRepo = new EmployeeRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.employeeRole.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.role.deleteMany();
  });

  describe('Employee Repository', () => {
    it('should create employee with roles', async () => {
      // Create role first
      const role = await prisma.role.create({
        data: {
          roleCode: 'EMPLOYEE',
          roleName: 'Employee',
          priority: 40
        }
      });

      // Create employee with role
      const employee = await employeeRepo.createWithRoles({
        email: 'test@example.com',
        employeeId: 'EMP001',
        firstName: 'Test',
        lastName: 'User',
        googleId: 'google-123',
        roleIds: [role.id]
      });

      // Verify employee and relationships
      const result = await prisma.employee.findUnique({
        where: { id: employee.id },
        include: {
          employeeRoles: {
            include: { role: true }
          }
        }
      });

      expect(result.employeeRoles).toHaveLength(1);
      expect(result.employeeRoles[0].role.roleCode).toBe('EMPLOYEE');
    });

    it('should handle concurrent updates correctly', async () => {
      const employee = await prisma.employee.create({
        data: {
          email: 'concurrent@example.com',
          employeeId: 'EMP002',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      // Simulate concurrent updates
      const updates = Array(5).fill(null).map((_, i) => 
        prisma.employee.update({
          where: { id: employee.id },
          data: { lastLogin: new Date() }
        })
      );

      // All updates should succeed
      await expect(Promise.all(updates)).resolves.toBeDefined();
    });

    it('should enforce unique constraints', async () => {
      await prisma.employee.create({
        data: {
          email: 'unique@example.com',
          employeeId: 'EMP003',
          firstName: 'Test',
          lastName: 'User'
        }
      });

      // Attempt to create duplicate
      await expect(
        prisma.employee.create({
          data: {
            email: 'unique@example.com', // Duplicate email
            employeeId: 'EMP004',
            firstName: 'Another',
            lastName: 'User'
          }
        })
      ).rejects.toThrow(/Unique constraint failed/);
    });

    it('should cascade delete relationships', async () => {
      const employee = await prisma.employee.create({
        data: {
          email: 'cascade@example.com',
          employeeId: 'EMP005',
          firstName: 'Test',
          lastName: 'User',
          sessions: {
            create: {
              sessionId: 'session-123',
              expiresAt: new Date(Date.now() + 86400000)
            }
          }
        }
      });

      // Delete employee
      await prisma.employee.delete({
        where: { id: employee.id }
      });

      // Verify session is also deleted
      const session = await prisma.session.findUnique({
        where: { sessionId: 'session-123' }
      });
      expect(session).toBeNull();
    });
  });
});
```

## End-to-End Testing

### 1. Cypress E2E Tests

```typescript
// cypress/e2e/auth-flow.cy.ts
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.task('db:seed'); // Seed test data
    cy.visit('/');
  });

  it('should complete Google login flow', () => {
    // Mock Google OAuth response
    cy.intercept('GET', '/api/auth/google', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          authUrl: 'http://localhost:3000/mock-google-auth',
          state: 'test-state'
        }
      }
    });

    cy.intercept('POST', '/api/auth/google/callback', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          accessToken: 'test-token',
          employee: {
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        }
      }
    });

    // Click login button
    cy.get('[data-testid="google-login-button"]').click();

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome, Test User');

    // Verify user menu
    cy.get('[data-testid="user-menu"]').click();
    cy.contains('test@example.com');
  });

  it('should handle authentication errors', () => {
    cy.intercept('POST', '/api/auth/google/callback', {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed'
        }
      }
    });

    cy.get('[data-testid="google-login-button"]').click();
    
    // Should show error message
    cy.contains('Authentication failed');
    cy.url().should('include', '/login');
  });

  it('should logout successfully', () => {
    // Login first
    cy.login('test@example.com');
    
    // Navigate to dashboard
    cy.visit('/dashboard');
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();

    // Should redirect to login
    cy.url().should('include', '/login');
    
    // Try to access protected route
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
});

// cypress/e2e/employee-management.cy.ts
describe('Employee Management', () => {
  beforeEach(() => {
    cy.task('db:seed');
    cy.login('admin@example.com'); // Login as admin
  });

  it('should display employee list', () => {
    cy.visit('/employees');

    // Should show employee table
    cy.get('[data-testid="employee-table"]').should('exist');
    cy.get('[data-testid="employee-row"]').should('have.length.at.least', 1);

    // Should have search functionality
    cy.get('[data-testid="search-input"]').type('John');
    cy.get('[data-testid="employee-row"]').should('contain', 'John');
  });

  it('should view employee details', () => {
    cy.visit('/employees');
    
    // Click first employee
    cy.get('[data-testid="employee-row"]').first().click();

    // Should navigate to details page
    cy.url().should('match', /\/employees\/\d+/);
    
    // Should display employee information
    cy.get('[data-testid="employee-name"]').should('exist');
    cy.get('[data-testid="employee-email"]').should('exist');
    cy.get('[data-testid="employee-roles"]').should('exist');
  });

  it('should update employee role', () => {
    cy.visit('/employees/1');

    // Click edit roles
    cy.get('[data-testid="edit-roles-button"]').click();

    // Select new role
    cy.get('[data-testid="role-select"]').select('MANAGER');
    cy.get('[data-testid="save-roles-button"]').click();

    // Should show success message
    cy.contains('Roles updated successfully');
    
    // Verify role is updated
    cy.get('[data-testid="employee-roles"]').should('contain', 'Manager');
  });

  it('should enforce permissions', () => {
    // Login as regular employee
    cy.login('employee@example.com');
    
    cy.visit('/employees');

    // Should not see admin actions
    cy.get('[data-testid="edit-roles-button"]').should('not.exist');
    cy.get('[data-testid="delete-employee-button"]').should('not.exist');
  });
});
```

### 2. Playwright E2E Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should complete login flow', async ({ page }) => {
    await page.goto('/');

    // Click Google login button
    await page.click('[data-testid="google-login-button"]');

    // Handle Google OAuth popup
    const googlePopup = await page.waitForEvent('popup');
    
    // Fill Google credentials (in test mode)
    await googlePopup.fill('#identifierId', 'test@example.com');
    await googlePopup.click('#identifierNext');
    await googlePopup.fill('input[type="password"]', 'test-password');
    await googlePopup.click('#passwordNext');

    // Wait for redirect back to app
    await page.waitForURL('**/dashboard');

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-email"]')).toContainText('test@example.com');
  });

  test('should persist session on refresh', async ({ page }) => {
    // Login
    await page.goto('/');
    await loginUser(page, 'test@example.com');

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
  });

  test('should handle session timeout', async ({ page }) => {
    await page.goto('/');
    await loginUser(page, 'test@example.com');

    // Simulate token expiry
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'expired-token');
    });

    // Try to access protected resource
    await page.goto('/employees');

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('.error-message')).toContainText('Session expired');
  });
});

test.describe('Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should filter employees by department', async ({ page }) => {
    await page.goto('/employees');

    // Select department filter
    await page.selectOption('[data-testid="department-filter"]', 'Engineering');

    // Verify filtered results
    const rows = page.locator('[data-testid="employee-row"]');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('.department')).toContainText('Engineering');
    }
  });

  test('should export employee data', async ({ page }) => {
    await page.goto('/employees');

    // Start waiting for download
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('[data-testid="export-button"]');

    // Wait for download
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toBe('employees.csv');
    
    // Save and verify content
    const path = await download.path();
    const content = await fs.readFile(path, 'utf-8');
    expect(content).toContain('Email,First Name,Last Name,Department');
  });
});

// Helper functions
async function loginUser(page: Page, email: string) {
  // Mock authentication for E2E tests
  await page.route('/api/auth/google/callback', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: 'test-token',
          employee: { email }
        }
      })
    });
  });

  await page.click('[data-testid="google-login-button"]');
  await page.waitForURL('**/dashboard');
}

async function loginAsAdmin(page: Page) {
  await loginUser(page, 'admin@example.com');
}
```

## Performance Testing

### 1. Load Testing with k6

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],             // Error rate must be below 10%
  },
};

const BASE_URL = 'http://localhost:5000';

export function setup() {
  // Get auth token for tests
  const loginRes = http.post(`${BASE_URL}/api/auth/google/callback`, JSON.stringify({
    code: 'test-code',
    state: 'test-state',
    codeVerifier: 'test-verifier'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  const token = JSON.parse(loginRes.body).data.accessToken;
  return { token };
}

export default function(data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test 1: Get current user
  const meRes = http.get(`${BASE_URL}/api/auth/me`, params);
  check(meRes, {
    'me status is 200': (r) => r.status === 200,
    'me response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(meRes.status !== 200);

  sleep(1);

  // Test 2: Get employees list
  const employeesRes = http.get(`${BASE_URL}/api/employees?page=1&limit=20`, params);
  check(employeesRes, {
    'employees status is 200': (r) => r.status === 200,
    'employees response time < 500ms': (r) => r.timings.duration < 500,
    'employees returns data': (r) => JSON.parse(r.body).data.length > 0,
  });
  errorRate.add(employeesRes.status !== 200);

  sleep(1);

  // Test 3: Search employees
  const searchRes = http.get(`${BASE_URL}/api/employees?search=john`, params);
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 300ms': (r) => r.timings.duration < 300,
  });
  errorRate.add(searchRes.status !== 200);

  sleep(1);
}

export function teardown(data) {
  // Cleanup after test
  console.log('Test completed');
}
```

### 2. Stress Testing

```javascript
// tests/performance/stress-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 400 },   // Ramp up to 400 users
    { duration: '5m', target: 400 },   // Stay at 400 users
    { duration: '2m', target: 600 },   // Ramp up to 600 users
    { duration: '5m', target: 600 },   // Stay at 600 users
    { duration: '5m', target: 0 },     // Ramp down
  ],
};

export default function() {
  // Stress test authentication endpoint
  const authRes = http.get('http://localhost:5000/api/auth/google');
  
  check(authRes, {
    'status is not 500': (r) => r.status !== 500,
    'status is not 502': (r) => r.status !== 502,
    'status is not 503': (r) => r.status !== 503,
  });

  // Monitor when system starts failing
  if (authRes.status >= 500) {
    console.error(`System failure at ${__VU} virtual users`);
  }
}
```

## Security Testing

### 1. Security Test Suite

```typescript
// tests/security/auth-security.test.ts
describe('Authentication Security Tests', () => {
  describe('PKCE Validation', () => {
    it('should reject requests without PKCE parameters', async () => {
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'auth-code',
          state: 'state'
          // Missing codeVerifier
        })
        .expect(400);

      expect(response.body.error.code).toBe('PKCE_REQUIRED');
    });

    it('should reject invalid code verifier', async () => {
      // Get auth URL
      const authResponse = await request(app)
        .get('/api/auth/google')
        .expect(200);

      const { state } = authResponse.body.data;

      // Use wrong code verifier
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'auth-code',
          state,
          codeVerifier: 'wrong-verifier'
        })
        .expect(400);

      expect(response.body.error.code).toBe('PKCE_VERIFICATION_FAILED');
    });
  });

  describe('State Parameter Security', () => {
    it('should reject expired state', async () => {
      // Create expired state
      const expiredState = await prisma.oAuthState.create({
        data: {
          state: 'expired-state',
          codeVerifier: 'verifier',
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
          ipAddress: '127.0.0.1'
        }
      });

      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'auth-code',
          state: 'expired-state',
          codeVerifier: 'verifier'
        })
        .expect(400);

      expect(response.body.error.code).toBe('STATE_EXPIRED');
    });

    it('should reject reused state', async () => {
      // Create used state
      const usedState = await prisma.oAuthState.create({
        data: {
          state: 'used-state',
          codeVerifier: 'verifier',
          expiresAt: new Date(Date.now() + 3600000),
          ipAddress: '127.0.0.1',
          used: true
        }
      });

      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'auth-code',
          state: 'used-state',
          codeVerifier: 'verifier'
        })
        .expect(400);

      expect(response.body.error.code).toBe('STATE_ALREADY_USED');
    });
  });

  describe('Token Security', () => {
    it('should not accept expired tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: '1', email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should not accept tokens with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { sub: '1', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should enforce token type validation', async () => {
      // Use refresh token as access token
      const refreshToken = jwt.sign(
        { sub: '1', type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle SQL injection attempts in search', async () => {
      const maliciousInput = "'; DROP TABLE employees; --";
      
      const response = await request(app)
        .get(`/api/employees?search=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should return empty results, not error
      expect(response.body.data).toEqual([]);

      // Verify table still exists
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'employees'
        )
      `;
      expect(tableExists[0].exists).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize user input', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .put('/api/employees/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: xssPayload,
          lastName: 'Test'
        })
        .expect(200);

      // Verify script tags are removed
      expect(response.body.data.firstName).not.toContain('<script>');
      expect(response.body.data.firstName).not.toContain('</script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .get('/api/auth/google')
          .expect((res) => {
            if (res.status === 429) {
              expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
            }
          })
      );

      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. OWASP Security Testing

```bash
# Run OWASP ZAP security scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r security-report.html

# Run dependency vulnerability scan
npm audit
npm audit fix

# Scan Docker images
docker scan employee-backend:latest

# Check for secrets in code
trufflehog --regex --entropy=True .
```

## Test Data Management

### 1. Test Data Factories

```typescript
// tests/factories/employee.factory.ts
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import { Employee, Role } from '@prisma/client';

export const employeeFactory = Factory.define<Employee>(() => ({
  id: faker.datatype.number(),
  employeeId: `EMP${faker.datatype.number({ min: 1000, max: 9999 })}`,
  email: faker.internet.email(),
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
  department: faker.helpers.arrayElement(['Engineering', 'Sales', 'Marketing', 'HR']),
  position: faker.name.jobTitle(),
  googleId: `google-${faker.datatype.uuid()}`,
  hireDate: faker.date.past(),
  isActive: true,
  lastLogin: faker.date.recent(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent()
}));

export const roleFactory = Factory.define<Role>(() => ({
  id: faker.datatype.number(),
  roleCode: faker.helpers.arrayElement(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER']),
  roleName: faker.name.jobTitle(),
  description: faker.lorem.sentence(),
  priority: faker.datatype.number({ min: 1, max: 100 }),
  isActive: true,
  createdAt: faker.date.past()
}));

// Usage in tests
const testEmployee = employeeFactory.build({
  email: 'specific@example.com',
  department: 'Engineering'
});

const testEmployees = employeeFactory.buildList(10);
```

### 2. Database Seeding

```typescript
// tests/seeds/test-seed.ts
import { PrismaClient } from '@prisma/client';
import { employeeFactory, roleFactory } from '../factories';

const prisma = new PrismaClient();

export async function seedTestDatabase() {
  // Clear existing data
  await prisma.employeeRole.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();

  // Create roles
  const roles = await Promise.all([
    prisma.role.create({
      data: {
        roleCode: 'SUPER_ADMIN',
        roleName: 'Super Administrator',
        priority: 100
      }
    }),
    prisma.role.create({
      data: {
        roleCode: 'ADMIN',
        roleName: 'Administrator',
        priority: 80
      }
    }),
    prisma.role.create({
      data: {
        roleCode: 'MANAGER',
        roleName: 'Manager',
        priority: 60
      }
    }),
    prisma.role.create({
      data: {
        roleCode: 'EMPLOYEE',
        roleName: 'Employee',
        priority: 40
      }
    })
  ]);

  // Create permissions
  const permissions = await Promise.all([
    prisma.permission.create({
      data: {
        permissionCode: 'USER_CREATE',
        permissionName: 'Create Users',
        resource: 'users',
        action: 'create'
      }
    }),
    prisma.permission.create({
      data: {
        permissionCode: 'USER_READ',
        permissionName: 'Read Users',
        resource: 'users',
        action: 'read'
      }
    }),
    prisma.permission.create({
      data: {
        permissionCode: 'USER_UPDATE',
        permissionName: 'Update Users',
        resource: 'users',
        action: 'update'
      }
    }),
    prisma.permission.create({
      data: {
        permissionCode: 'USER_DELETE',
        permissionName: 'Delete Users',
        resource: 'users',
        action: 'delete'
      }
    })
  ]);

  // Assign permissions to roles
  await prisma.rolePermission.createMany({
    data: [
      // Super Admin gets all permissions
      ...permissions.map(p => ({
        roleId: roles[0].id,
        permissionId: p.id
      })),
      // Admin gets most permissions
      ...permissions.filter(p => p.action !== 'delete').map(p => ({
        roleId: roles[1].id,
        permissionId: p.id
      })),
      // Manager gets read and update
      ...permissions.filter(p => ['read', 'update'].includes(p.action)).map(p => ({
        roleId: roles[2].id,
        permissionId: p.id
      })),
      // Employee gets read only
      ...permissions.filter(p => p.action === 'read').map(p => ({
        roleId: roles[3].id,
        permissionId: p.id
      }))
    ]
  });

  // Create test employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        email: 'admin@example.com',
        employeeId: 'EMP001',
        firstName: 'Admin',
        lastName: 'User',
        department: 'IT',
        position: 'System Administrator',
        googleId: 'google-admin-123',
        employeeRoles: {
          create: {
            roleId: roles[1].id // Admin role
          }
        }
      }
    }),
    prisma.employee.create({
      data: {
        email: 'manager@example.com',
        employeeId: 'EMP002',
        firstName: 'Manager',
        lastName: 'User',
        department: 'Engineering',
        position: 'Engineering Manager',
        googleId: 'google-manager-123',
        employeeRoles: {
          create: {
            roleId: roles[2].id // Manager role
          }
        }
      }
    }),
    prisma.employee.create({
      data: {
        email: 'employee@example.com',
        employeeId: 'EMP003',
        firstName: 'Regular',
        lastName: 'Employee',
        department: 'Engineering',
        position: 'Software Engineer',
        googleId: 'google-employee-123',
        employeeRoles: {
          create: {
            roleId: roles[3].id // Employee role
          }
        }
      }
    })
  ]);

  // Create additional random employees
  const randomEmployees = employeeFactory.buildList(20);
  await prisma.employee.createMany({
    data: randomEmployees
  });

  console.log('Test database seeded successfully');
}

// Run seeding
if (require.main === module) {
  seedTestDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

## Continuous Integration Testing

### 1. GitHub Actions CI

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: employee_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: |
          cd backend
          npx prisma migrate deploy
          npm run db:seed:test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/employee_test
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/employee_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit-tests
          name: codecov-umbrella

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: employee_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/employee_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: test-results/

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  security-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: npm audit --audit-level=high
      
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'employee-system'
          path: '.'
          format: 'HTML'
      
      - name: Upload dependency check results
        uses: actions/upload-artifact@v3
        with:
          name: dependency-check-report
          path: reports/
```

### 2. Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

## Testing Best Practices

### 1. Test Organization

```typescript
// Good test structure
describe('EmployeeService', () => {
  // Group related tests
  describe('createEmployee', () => {
    // Use descriptive test names
    it('should create employee with valid data', async () => {
      // Arrange - setup test data
      const employeeData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      // Act - perform the action
      const result = await employeeService.createEmployee(employeeData);

      // Assert - verify the outcome
      expect(result).toMatchObject({
        email: employeeData.email,
        firstName: employeeData.firstName,
        lastName: employeeData.lastName
      });
    });

    it('should throw error for duplicate email', async () => {
      // Test error cases
      await expect(
        employeeService.createEmployee({ email: 'duplicate@example.com' })
      ).rejects.toThrow('Email already exists');
    });
  });

  // Test edge cases
  describe('edge cases', () => {
    it('should handle null values gracefully', async () => {
      const result = await employeeService.findByDepartment(null);
      expect(result).toEqual([]);
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(1000);
      await expect(
        employeeService.createEmployee({ firstName: longString })
      ).rejects.toThrow('Input too long');
    });
  });
});
```

### 2. Test Data Isolation

```typescript
// Use transactions for test isolation
describe('Database Tests', () => {
  let tx: PrismaClient;

  beforeEach(async () => {
    // Start transaction
    tx = await prisma.$transaction.start();
  });

  afterEach(async () => {
    // Rollback transaction
    await tx.$transaction.rollback();
  });

  it('should not affect other tests', async () => {
    // All database operations use tx instead of prisma
    await tx.employee.create({ data: testEmployee });
    
    // Changes are rolled back after test
  });
});
```

### 3. Mocking Best Practices

```typescript
// Create reusable mock factories
export function createMockAuthService(): jest.Mocked<AuthService> {
  return {
    authenticateWithGoogle: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
    validateToken: jest.fn()
  };
}

// Use in tests
const mockAuthService = createMockAuthService();
mockAuthService.authenticateWithGoogle.mockResolvedValue({
  employee: testEmployee,
  tokens: testTokens
});
```

### 4. Async Testing Patterns

```typescript
// Always handle async properly
describe('Async Tests', () => {
  // ✅ Good: Use async/await
  it('should handle async operations', async () => {
    const result = await asyncOperation();
    expect(result).toBe('success');
  });

  // ✅ Good: Test rejected promises
  it('should handle errors', async () => {
    await expect(asyncOperation()).rejects.toThrow('Error message');
  });

  // ❌ Bad: Forgetting to await
  it('will pass incorrectly', () => {
    asyncOperation(); // This might pass even if it throws
  });
});
```

### 5. Snapshot Testing

```typescript
// Use snapshots for complex objects
describe('Component Snapshots', () => {
  it('should match snapshot', () => {
    const component = render(<EmployeeCard employee={testEmployee} />);
    expect(component).toMatchSnapshot();
  });

  // Update snapshots when needed
  // npm test -- -u
});
```

## Testing Checklist

### Before Committing
- [ ] All tests pass locally
- [ ] New features have tests
- [ ] Test coverage meets requirements
- [ ] No console.logs in tests
- [ ] Tests are deterministic (no random failures)
- [ ] Tests clean up after themselves

### Test Quality
- [ ] Tests are readable and well-named
- [ ] Tests cover happy path and error cases
- [ ] Edge cases are tested
- [ ] Tests are isolated (no dependencies between tests)
- [ ] Mocks are properly reset between tests
- [ ] No hardcoded test data (use factories)

### Performance
- [ ] Tests run quickly (< 5 minutes total)
- [ ] No unnecessary waits or delays
- [ ] Database queries are optimized
- [ ] Large datasets use pagination

---

Document Version: 1.0.0  
Last Updated: 2025-08-10  
Maintained by: QA Team