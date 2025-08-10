# API Documentation - Google Authentication Employee Management System

## Table of Contents
1. [Overview](#overview)
2. [Base Configuration](#base-configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Security Considerations](#security-considerations)
8. [Testing Guide](#testing-guide)

## Overview

This document provides comprehensive documentation for the Google Authentication Employee Management System API. The system implements Google OAuth 2.0 with PKCE for secure authentication and provides employee management capabilities with role-based access control.

### API Design Principles
- RESTful architecture
- JSON-based communication
- Stateless authentication using JWT
- Consistent error responses
- Comprehensive audit logging
- Security-first approach

## Base Configuration

### Base URLs
```
Development: http://localhost:5000/api
Staging: https://staging-api.example.com/api
Production: https://api.example.com/api
```

### Request Headers
All API requests should include the following headers:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <access_token>  # For authenticated endpoints
X-Request-ID: <unique-request-id>     # Optional, for request tracking
```

### Response Format
All API responses follow a standardized format:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "timestamp": "2025-08-10T10:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Error Response:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    },
    "timestamp": "2025-08-10T10:00:00Z"
  }
}
```

## Authentication

### Authentication Flow

The system implements the OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange) for enhanced security.

#### 1. Initiate Authentication
**Endpoint:** `GET /api/auth/google`

**Description:** Generates a Google OAuth 2.0 authentication URL with PKCE parameters.

**Request:**
```http
GET /api/auth/google
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid%20email%20profile&state=...&code_challenge=...&code_challenge_method=S256",
    "state": "randomly_generated_state_string",
    "expiresAt": "2025-08-10T10:15:00Z"
  }
}
```

**Implementation Details:**
- Generates cryptographically secure `state` parameter
- Creates PKCE `code_verifier` (43-128 characters)
- Calculates `code_challenge` using SHA256
- Stores state and code_verifier in database with IP address
- State expires after 15 minutes

#### 2. Handle Callback
**Endpoint:** `POST /api/auth/google/callback`

**Description:** Processes the authorization code from Google and exchanges it for tokens.

**Request:**
```json
{
  "code": "authorization_code_from_google",
  "state": "state_from_initial_request",
  "codeVerifier": "original_code_verifier"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "refresh_token_string",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "employee": {
      "id": 1,
      "employeeId": "EMP001",
      "email": "user@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "position": "Senior Developer",
      "roles": ["EMPLOYEE"],
      "permissions": ["DATA_VIEW", "REPORT_VIEW"],
      "isActive": true,
      "lastLogin": "2025-08-10T10:00:00Z"
    }
  }
}
```

**Validation Steps:**
1. Verify state parameter exists and matches stored state
2. Check state hasn't expired
3. Validate IP address matches original request
4. Verify code_verifier against stored code_challenge
5. Exchange authorization code with Google
6. Validate Google ID token
7. Create or update employee record
8. Generate JWT tokens
9. Create audit log entry

#### 3. Refresh Token
**Endpoint:** `POST /api/auth/refresh`

**Description:** Refreshes an expired access token using a valid refresh token.

**Request:**
```json
{
  "refreshToken": "valid_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

**Security Measures:**
- Refresh tokens are rotated on each use
- Old refresh token is immediately revoked
- Refresh tokens expire after 7 days
- Client info and IP address are logged

#### 4. Logout
**Endpoint:** `POST /api/auth/logout`

**Description:** Invalidates the current session and revokes tokens.

**Request:**
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "current_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

**Actions Performed:**
- Revokes refresh token
- Clears session data
- Creates audit log entry
- Optional: Notifies other services

#### 5. Get Current User
**Endpoint:** `GET /api/auth/me`

**Description:** Retrieves the authenticated user's profile and permissions.

**Request:**
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "employeeId": "EMP001",
    "email": "user@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "position": "Senior Developer",
    "googleId": "117234567890123456789",
    "roles": [
      {
        "id": 1,
        "roleCode": "EMPLOYEE",
        "roleName": "Employee",
        "priority": 40
      }
    ],
    "permissions": [
      {
        "id": 1,
        "permissionCode": "DATA_VIEW",
        "resource": "data",
        "action": "view"
      },
      {
        "id": 2,
        "permissionCode": "REPORT_VIEW",
        "resource": "reports",
        "action": "view"
      }
    ],
    "isActive": true,
    "lastLogin": "2025-08-10T10:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

## API Endpoints

### Employee Management (Planned)

#### List Employees
**Endpoint:** `GET /api/employees`

**Description:** Retrieves a paginated list of employees.

**Required Permission:** `USER_READ`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search by name or email
- `department` (string): Filter by department
- `role` (string): Filter by role code
- `isActive` (boolean): Filter by active status
- `sortBy` (string): Sort field (name, email, department, createdAt)
- `sortOrder` (string): Sort direction (asc, desc)

**Request:**
```http
GET /api/employees?page=1&limit=20&department=Engineering&isActive=true
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employeeId": "EMP001",
      "email": "john.doe@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "position": "Senior Developer",
      "roles": ["EMPLOYEE"],
      "isActive": true,
      "lastLogin": "2025-08-10T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### Get Employee Details
**Endpoint:** `GET /api/employees/:id`

**Description:** Retrieves detailed information about a specific employee.

**Required Permission:** `USER_READ` or own profile

**Request:**
```http
GET /api/employees/123
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "employeeId": "EMP123",
    "email": "employee@company.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "department": "Marketing",
    "position": "Marketing Manager",
    "hireDate": "2020-03-15T00:00:00Z",
    "googleId": "117234567890123456789",
    "roles": [
      {
        "id": 2,
        "roleCode": "MANAGER",
        "roleName": "Manager",
        "priority": 60,
        "assignedDate": "2022-01-01T00:00:00Z",
        "assignedBy": 1
      }
    ],
    "permissions": [
      {
        "id": 1,
        "permissionCode": "USER_READ",
        "permissionName": "Read Users",
        "resource": "users",
        "action": "read"
      },
      {
        "id": 2,
        "permissionCode": "DATA_EDIT",
        "permissionName": "Edit Data",
        "resource": "data",
        "action": "edit"
      }
    ],
    "isActive": true,
    "lastLogin": "2025-08-10T09:00:00Z",
    "createdAt": "2020-03-15T00:00:00Z",
    "updatedAt": "2025-08-10T09:00:00Z"
  }
}
```

#### Update Employee
**Endpoint:** `PUT /api/employees/:id`

**Description:** Updates employee information.

**Required Permission:** `USER_UPDATE`

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "department": "Marketing",
  "position": "Senior Marketing Manager",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "employeeId": "EMP123",
    "email": "employee@company.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "department": "Marketing",
    "position": "Senior Marketing Manager",
    "isActive": true,
    "updatedAt": "2025-08-10T10:00:00Z"
  }
}
```

#### Assign Role
**Endpoint:** `POST /api/employees/:id/roles`

**Description:** Assigns a role to an employee.

**Required Permission:** `ROLE_MANAGE`

**Request:**
```json
{
  "roleId": 3,
  "effectiveDate": "2025-08-15T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employeeId": 123,
    "roleId": 3,
    "roleCode": "MANAGER",
    "assignedDate": "2025-08-10T10:00:00Z",
    "assignedBy": 1,
    "effectiveDate": "2025-08-15T00:00:00Z"
  }
}
```

### Permission Management (Planned)

#### Check Permissions
**Endpoint:** `POST /api/permissions/check`

**Description:** Checks if the current user has specific permissions.

**Request:**
```json
{
  "permissions": ["USER_READ", "USER_UPDATE"],
  "resource": "users",
  "resourceId": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasAllPermissions": false,
    "permissions": {
      "USER_READ": true,
      "USER_UPDATE": false
    },
    "missingPermissions": ["USER_UPDATE"]
  }
}
```

## Error Handling

### Error Response Structure
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context",
      "value": "Invalid value"
    },
    "timestamp": "2025-08-10T10:00:00Z",
    "path": "/api/auth/login",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Common Error Codes

#### Authentication Errors (401)
| Code | Message | Description |
|------|---------|-------------|
| `UNAUTHORIZED` | Authentication required | No valid authentication token provided |
| `INVALID_TOKEN` | Invalid authentication token | Token is malformed or signature invalid |
| `TOKEN_EXPIRED` | Authentication token expired | Access token has expired |
| `INVALID_REFRESH_TOKEN` | Invalid refresh token | Refresh token is invalid or revoked |
| `SESSION_EXPIRED` | Session has expired | User session no longer valid |

#### Authorization Errors (403)
| Code | Message | Description |
|------|---------|-------------|
| `FORBIDDEN` | Access forbidden | User lacks required permissions |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | Missing specific permissions |
| `ROLE_REQUIRED` | Required role not assigned | User doesn't have required role |
| `RESOURCE_ACCESS_DENIED` | Access to resource denied | No access to specific resource |

#### Validation Errors (400)
| Code | Message | Description |
|------|---------|-------------|
| `VALIDATION_ERROR` | Validation failed | Input data validation failed |
| `INVALID_INPUT` | Invalid input data | General input error |
| `MISSING_REQUIRED_FIELD` | Required field missing | Required field not provided |
| `INVALID_FORMAT` | Invalid data format | Data format doesn't match expected |
| `CONSTRAINT_VIOLATION` | Constraint violation | Database constraint violated |

#### Resource Errors (404/409)
| Code | Message | Description |
|------|---------|-------------|
| `NOT_FOUND` | Resource not found | Requested resource doesn't exist |
| `EMPLOYEE_NOT_FOUND` | Employee not found | Employee record doesn't exist |
| `ALREADY_EXISTS` | Resource already exists | Duplicate resource creation attempt |
| `CONFLICT` | Resource conflict | Operation conflicts with current state |

#### OAuth Errors (400/500)
| Code | Message | Description |
|------|---------|-------------|
| `OAUTH_STATE_INVALID` | Invalid OAuth state | State parameter mismatch or expired |
| `OAUTH_CODE_INVALID` | Invalid authorization code | Authorization code invalid or expired |
| `OAUTH_PKCE_FAILED` | PKCE verification failed | Code verifier doesn't match challenge |
| `GOOGLE_AUTH_FAILED` | Google authentication failed | Error from Google OAuth service |
| `OAUTH_TOKEN_EXCHANGE_FAILED` | Token exchange failed | Failed to exchange code for tokens |

#### Server Errors (500)
| Code | Message | Description |
|------|---------|-------------|
| `INTERNAL_SERVER_ERROR` | Internal server error | Unexpected server error |
| `DATABASE_ERROR` | Database operation failed | Database query or connection error |
| `EXTERNAL_SERVICE_ERROR` | External service error | Third-party service failure |
| `CONFIGURATION_ERROR` | Configuration error | Missing or invalid configuration |

#### Rate Limiting (429)
| Code | Message | Description |
|------|---------|-------------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Too many requests in time window |

### Error Handling Best Practices

1. **Client-Side Error Handling**
```javascript
try {
  const response = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    switch (data.error.code) {
      case 'TOKEN_EXPIRED':
        // Attempt to refresh token
        await refreshAccessToken();
        break;
      case 'FORBIDDEN':
        // Redirect to unauthorized page
        window.location.href = '/unauthorized';
        break;
      default:
        // Show error message to user
        showError(data.error.message);
    }
  }
} catch (error) {
  // Handle network errors
  console.error('Network error:', error);
}
```

2. **Retry Strategy**
- Implement exponential backoff for 5xx errors
- Don't retry 4xx errors (except 429)
- Maximum 3 retry attempts
- Include jitter to prevent thundering herd

## Rate Limiting

### Default Limits
- **General API:** 100 requests per 15 minutes per IP
- **Authentication endpoints:** 20 requests per 15 minutes per IP
- **Search endpoints:** 30 requests per 15 minutes per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1628686800
Retry-After: 900
```

### Rate Limit Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "window": "15 minutes",
      "retryAfter": 900
    }
  }
}
```

## Security Considerations

### Authentication Security
1. **PKCE Implementation**
   - Code verifier: 43-128 characters
   - Code challenge: SHA256 hash, base64url encoded
   - State parameter: cryptographically secure random string
   - Both stored with request IP for validation

2. **Token Security**
   - Access tokens: 15-minute expiry
   - Refresh tokens: 7-day expiry, single use
   - Tokens signed with RS256 (production) or HS256 (development)
   - Refresh token rotation on use

3. **Session Security**
   - Sessions tied to IP address and user agent
   - Automatic session invalidation on suspicious activity
   - Concurrent session limits enforced

### API Security Headers
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### Input Validation
- All inputs sanitized and validated
- SQL injection prevention via Prisma ORM
- XSS prevention through proper encoding
- Request size limits enforced

### Audit Logging
All security-relevant events are logged:
- Authentication attempts (success/failure)
- Authorization failures
- Token refresh/revocation
- Role/permission changes
- Suspicious activities

## Testing Guide

### Authentication Testing

#### Test Case 1: Successful Authentication Flow
```bash
# 1. Get auth URL
curl -X GET http://localhost:5000/api/auth/google

# 2. Complete OAuth flow in browser
# 3. Exchange code for tokens
curl -X POST http://localhost:5000/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization_code",
    "state": "state_from_step_1",
    "codeVerifier": "your_code_verifier"
  }'

# 4. Use access token
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

#### Test Case 2: Token Refresh
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token"
  }'
```

### Integration Testing
```javascript
describe('Authentication API', () => {
  test('should complete full authentication flow', async () => {
    // 1. Get auth URL
    const authResponse = await request(app)
      .get('/api/auth/google')
      .expect(200);
    
    expect(authResponse.body.data.authUrl).toBeDefined();
    expect(authResponse.body.data.state).toBeDefined();
    
    // 2. Simulate callback
    const callbackResponse = await request(app)
      .post('/api/auth/google/callback')
      .send({
        code: 'test_code',
        state: authResponse.body.data.state,
        codeVerifier: 'test_verifier'
      })
      .expect(200);
    
    expect(callbackResponse.body.data.accessToken).toBeDefined();
    expect(callbackResponse.body.data.refreshToken).toBeDefined();
  });
});
```

### Load Testing
```yaml
# k6 load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  const response = http.get('http://localhost:5000/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## Appendix

### Environment Variables
```bash
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/employee_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Session
SESSION_SECRET=your_session_secret_min_32_chars

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Useful cURL Commands
```bash
# Health check
curl http://localhost:5000/health

# Get auth URL
curl http://localhost:5000/api/auth/google | jq

# Get current user (authenticated)
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/auth/me | jq

# Refresh token
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}' | jq
```

### Postman Collection
A complete Postman collection is available at `/docs/postman/google-auth-api.json` with:
- Environment variables setup
- Authentication flow examples
- All API endpoints
- Test scripts for validation

---

Document Version: 1.0.0  
Last Updated: 2025-08-10  
Maintained by: Development Team