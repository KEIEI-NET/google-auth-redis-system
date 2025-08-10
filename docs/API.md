# API Documentation - Google Auth Employee System

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [API Reference](#api-reference)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Webhooks](#webhooks)
8. [Testing](#testing)
9. [SDKs & Examples](#sdks--examples)

## Overview

The Google Auth Employee System API provides a secure, RESTful interface for employee management with Google OAuth 2.0 authentication and role-based access control.

### Base URLs
```
Development:  http://localhost:5000/api
Staging:      https://staging-api.example.com/api
Production:   https://api.example.com/api
```

### API Version
Current Version: `v1`
API Lifecycle: `Stable`

### Request/Response Format
- **Content Type**: `application/json`
- **Character Encoding**: `UTF-8`
- **Date Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Timezone**: UTC

## Getting Started

### Quick Start Guide

#### 1. Obtain API Credentials
```bash
# Request API access from admin
# You will receive:
# - Client ID (for OAuth)
# - Allowed redirect URIs
# - Rate limit tier
```

#### 2. Authenticate User
```javascript
// Initiate OAuth flow
const response = await fetch('http://localhost:5000/api/auth/google', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const { authUrl, state, codeVerifier } = await response.json();
// Store state and codeVerifier securely
// Redirect user to authUrl
```

#### 3. Handle Callback
```javascript
// After user authorizes, handle callback
const response = await fetch('http://localhost:5000/api/auth/google/callback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: authorizationCode,
    state: savedState,
    codeVerifier: savedCodeVerifier
  })
});

const { accessToken, refreshToken, user } = await response.json();
```

#### 4. Make Authenticated Requests
```javascript
// Use access token for API calls
const response = await fetch('http://localhost:5000/api/employees', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

## Authentication

### OAuth 2.0 Flow with PKCE

The API uses Google OAuth 2.0 with PKCE (Proof Key for Code Exchange) for enhanced security.

#### Authentication Endpoints

### `GET /api/auth/google`
Initiates Google OAuth authentication flow.

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "randomly_generated_state",
    "codeVerifier": "pkce_code_verifier"
  }
}
```

**Response Codes:**
- `200 OK` - Authentication URL generated successfully
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

### `POST /api/auth/google/callback`
Processes Google OAuth callback and exchanges code for tokens.

**Request Body:**
```json
{
  "code": "authorization_code_from_google",
  "state": "state_from_initial_request",
  "codeVerifier": "pkce_code_verifier"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "randomly_generated_refresh_token",
    "expiresIn": 900,
    "user": {
      "id": "emp_123456",
      "email": "john.doe@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": ["EMPLOYEE"],
      "permissions": ["employees:read:self"]
    }
  }
}
```

**Validation Rules:**
- `code`: Required, string, alphanumeric
- `state`: Required, string, must match stored state
- `codeVerifier`: Required, string, 43-128 characters

**Response Codes:**
- `200 OK` - Authentication successful
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid credentials or state
- `403 Forbidden` - User not authorized for this system
- `429 Too Many Requests` - Rate limit exceeded

---

### `POST /api/auth/refresh`
Refreshes expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "stored_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "expiresIn": 900
  }
}
```

**Response Codes:**
- `200 OK` - Token refreshed successfully
- `401 Unauthorized` - Invalid or expired refresh token
- `429 Too Many Requests` - Rate limit exceeded

---

### `POST /api/auth/logout`
Invalidates user session and tokens.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Response Codes:**
- `200 OK` - Logout successful
- `401 Unauthorized` - Invalid or missing token

---

### `GET /api/auth/me`
Returns current authenticated user information.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_123456",
    "email": "john.doe@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "roles": ["EMPLOYEE", "MANAGER"],
    "permissions": [
      "employees:read:all",
      "employees:update:team",
      "reports:read:team"
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastLogin": "2025-08-10T14:30:00.000Z"
  }
}
```

**Response Codes:**
- `200 OK` - User information retrieved
- `401 Unauthorized` - Invalid or missing token

## API Reference

### Employee Management

#### `GET /api/employees`
Retrieves list of employees (requires appropriate permissions).

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| page | integer | No | Page number (1-based) | 1 |
| limit | integer | No | Items per page (1-100) | 20 |
| sort | string | No | Sort field (name, email, department) | name |
| order | string | No | Sort order (asc, desc) | asc |
| search | string | No | Search query | - |
| department | string | No | Filter by department | - |
| role | string | No | Filter by role | - |
| status | string | No | Filter by status (active, inactive) | active |

**Response:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "emp_123456",
        "email": "john.doe@company.com",
        "firstName": "John",
        "lastName": "Doe",
        "department": "Engineering",
        "position": "Senior Developer",
        "roles": ["EMPLOYEE"],
        "status": "active",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Permission Requirements:**
- `employees:read:all` - View all employees
- `employees:read:team` - View team members only
- `employees:read:self` - View own profile only

**Response Codes:**
- `200 OK` - Employees retrieved successfully
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `400 Bad Request` - Invalid query parameters

---

#### `GET /api/employees/:id`
Retrieves specific employee details.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
- `id` - Employee ID (e.g., emp_123456)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_123456",
    "email": "john.doe@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "position": "Senior Developer",
    "managerId": "emp_789012",
    "roles": ["EMPLOYEE", "TEAM_LEAD"],
    "permissions": [
      "employees:read:team",
      "reports:create",
      "reports:read:team"
    ],
    "phoneNumber": "+1-555-0123",
    "officeLocation": "Building A, Floor 3",
    "startDate": "2020-03-15",
    "status": "active",
    "metadata": {
      "skills": ["JavaScript", "Python", "Docker"],
      "certifications": ["AWS Solutions Architect"],
      "emergencyContact": {
        "name": "Jane Doe",
        "relationship": "Spouse",
        "phone": "+1-555-0124"
      }
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2025-08-10T14:30:00.000Z"
  }
}
```

**Response Codes:**
- `200 OK` - Employee retrieved successfully
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Employee not found

---

#### `POST /api/employees`
Creates a new employee (Admin only).

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": "new.employee@company.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "department": "Marketing",
  "position": "Marketing Manager",
  "managerId": "emp_789012",
  "roles": ["EMPLOYEE"],
  "phoneNumber": "+1-555-0125",
  "officeLocation": "Building B, Floor 2",
  "startDate": "2025-09-01",
  "metadata": {
    "skills": ["SEO", "Content Marketing"],
    "certifications": []
  }
}
```

**Validation Rules:**
- `email`: Required, valid email, unique, must be company domain
- `firstName`: Required, 1-50 characters, letters only
- `lastName`: Required, 1-50 characters, letters only
- `department`: Required, must exist in system
- `position`: Required, 1-100 characters
- `roles`: Required, array of valid role codes
- `startDate`: Optional, ISO 8601 date format

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_345678",
    "email": "jane.smith@company.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "createdAt": "2025-08-10T15:00:00.000Z"
  }
}
```

**Response Codes:**
- `201 Created` - Employee created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - Email already exists

---

#### `PUT /api/employees/:id`
Updates employee information.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
- `id` - Employee ID

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe-Smith",
  "department": "Engineering",
  "position": "Engineering Manager",
  "phoneNumber": "+1-555-0126",
  "metadata": {
    "skills": ["Leadership", "Agile", "JavaScript"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp_345678",
    "email": "jane.smith@company.com",
    "firstName": "Jane",
    "lastName": "Doe-Smith",
    "updatedAt": "2025-08-10T16:00:00.000Z"
  }
}
```

**Permission Requirements:**
- `employees:update:all` - Update any employee
- `employees:update:team` - Update team members
- `employees:update:self` - Update own profile

**Response Codes:**
- `200 OK` - Employee updated successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Employee not found

---

#### `DELETE /api/employees/:id`
Soft deletes an employee (Admin only).

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
- `id` - Employee ID

**Response:**
```json
{
  "success": true,
  "message": "Employee deactivated successfully"
}
```

**Response Codes:**
- `200 OK` - Employee deleted successfully
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Employee not found

### Role & Permission Management

#### `GET /api/roles`
Lists all available roles.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": "role_001",
        "code": "SUPER_ADMIN",
        "name": "Super Administrator",
        "description": "Full system access",
        "priority": 100,
        "permissions": [
          "system:all",
          "employees:all",
          "roles:all"
        ]
      },
      {
        "id": "role_002",
        "code": "ADMIN",
        "name": "Administrator",
        "description": "Administrative access",
        "priority": 90,
        "permissions": [
          "employees:all",
          "roles:read",
          "reports:all"
        ]
      }
    ]
  }
}
```

---

#### `GET /api/permissions`
Lists all available permissions.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "permissions": [
      {
        "id": "perm_001",
        "code": "employees:read:all",
        "resource": "employees",
        "action": "read",
        "scope": "all",
        "description": "View all employees"
      },
      {
        "id": "perm_002",
        "code": "employees:update:self",
        "resource": "employees",
        "action": "update",
        "scope": "self",
        "description": "Update own profile"
      }
    ]
  }
}
```

---

#### `POST /api/permissions/check`
Checks if user has specific permissions.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "permissions": [
    "employees:read:all",
    "reports:create"
  ],
  "requireAll": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasPermission": true,
    "permissions": {
      "employees:read:all": true,
      "reports:create": false
    }
  }
}
```

### Admin Operations

#### `GET /api/admin/stats`
Retrieves system statistics (Admin only).

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEmployees": 150,
    "activeEmployees": 145,
    "inactiveEmployees": 5,
    "departmentBreakdown": {
      "Engineering": 45,
      "Sales": 30,
      "Marketing": 25,
      "HR": 15,
      "Finance": 20,
      "Operations": 15
    },
    "roleBreakdown": {
      "SUPER_ADMIN": 2,
      "ADMIN": 5,
      "MANAGER": 20,
      "EMPLOYEE": 118,
      "VIEWER": 5
    },
    "recentActivity": {
      "newEmployeesThisMonth": 8,
      "lastLoginStats": {
        "today": 120,
        "thisWeek": 140,
        "thisMonth": 145
      }
    }
  }
}
```

---

#### `GET /api/admin/audit-logs`
Retrieves audit logs (Admin only).

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| page | integer | No | Page number | 1 |
| limit | integer | No | Items per page (1-100) | 50 |
| userId | string | No | Filter by user ID | - |
| action | string | No | Filter by action type | - |
| startDate | string | No | Start date (ISO 8601) | - |
| endDate | string | No | End date (ISO 8601) | - |
| severity | string | No | Filter by severity | - |

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_001",
        "timestamp": "2025-08-10T14:30:00.000Z",
        "userId": "emp_123456",
        "userEmail": "john.doe@company.com",
        "action": "AUTH_SUCCESS",
        "resource": "auth",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "severity": "INFO",
        "metadata": {
          "provider": "google",
          "sessionId": "sess_abc123"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2500,
      "totalPages": 50
    }
  }
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Specific field error"
    },
    "requestId": "req_abc123xyz",
    "timestamp": "2025-08-10T14:30:00.000Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `AUTHENTICATION_REQUIRED` | 401 | Missing authentication |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `INSUFFICIENT_PERMISSIONS` | 403 | Lacks required permissions |
| `FORBIDDEN` | 403 | Action not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Examples

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "email": "Invalid email format",
      "firstName": "Field is required"
    },
    "requestId": "req_abc123xyz"
  }
}
```

#### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided access token is invalid or has expired",
    "requestId": "req_def456uvw"
  }
}
```

#### Permission Error
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to perform this action",
    "details": {
      "required": ["employees:update:all"],
      "current": ["employees:read:self"]
    },
    "requestId": "req_ghi789rst"
  }
}
```

## Rate Limiting

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1628784000
X-RateLimit-Reset-After: 900
```

### Rate Limit Tiers

| Endpoint Category | Default Limit | Window | Notes |
|-------------------|---------------|---------|-------|
| Authentication | 5 requests | 15 minutes | Per IP |
| General API | 100 requests | 15 minutes | Per user |
| Admin API | 500 requests | 15 minutes | Per user |
| Search | 30 requests | 1 minute | Per user |
| Bulk Operations | 10 requests | 1 hour | Per user |

### User Role Multipliers

| Role | Multiplier | Effective Limit (General API) |
|------|------------|-------------------------------|
| SUPER_ADMIN | 5x | 500 requests/15 min |
| ADMIN | 5x | 500 requests/15 min |
| MANAGER | 2x | 200 requests/15 min |
| EMPLOYEE | 1x | 100 requests/15 min |
| VIEWER | 0.5x | 50 requests/15 min |

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 900 seconds.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetAt": "2025-08-10T15:00:00.000Z",
      "retryAfter": 900
    }
  }
}
```

## Webhooks

### Webhook Events (Coming Soon)

The system will support webhooks for real-time event notifications:

| Event | Description | Payload |
|-------|-------------|---------|
| `employee.created` | New employee added | Employee object |
| `employee.updated` | Employee info updated | Updated fields |
| `employee.deleted` | Employee removed | Employee ID |
| `employee.role_changed` | Role assignment changed | Old/new roles |
| `auth.login` | User logged in | User info, IP |
| `auth.logout` | User logged out | User info |
| `auth.failed` | Login attempt failed | Email, IP |
| `security.alert` | Security event detected | Event details |

### Webhook Configuration

```json
{
  "url": "https://your-domain.com/webhooks",
  "events": ["employee.created", "employee.updated"],
  "secret": "webhook_secret_key",
  "active": true
}
```

### Webhook Security

- HMAC-SHA256 signature verification
- Retry logic with exponential backoff
- Event deduplication
- SSL/TLS required

## Testing

### Test Environment

```
Base URL: http://localhost:5000/api
Test Credentials: Available in .env.test
```

### Testing with cURL

#### Get Auth URL
```bash
curl -X GET http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json"
```

#### Exchange Code for Token
```bash
curl -X POST http://localhost:5000/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "auth_code",
    "state": "state_value",
    "codeVerifier": "verifier_value"
  }'
```

#### Get Employee List
```bash
curl -X GET http://localhost:5000/api/employees \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Testing with Postman

1. Import the Postman collection:
```json
{
  "info": {
    "name": "Google Auth Employee API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api"
    },
    {
      "key": "access_token",
      "value": ""
    }
  ]
}
```

2. Set environment variables
3. Run collection with test scripts

### Integration Testing

```javascript
// Jest example
describe('Employee API', () => {
  let accessToken;

  beforeAll(async () => {
    // Authenticate and get token
    const authResponse = await authenticateTestUser();
    accessToken = authResponse.accessToken;
  });

  test('GET /api/employees returns employee list', async () => {
    const response = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.employees)).toBe(true);
  });

  test('GET /api/employees/:id returns specific employee', async () => {
    const response = await request(app)
      .get('/api/employees/emp_123456')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('emp_123456');
  });
});
```

## SDKs & Examples

### JavaScript/TypeScript SDK

```typescript
import { EmployeeAPIClient } from '@company/employee-api-sdk';

const client = new EmployeeAPIClient({
  baseUrl: 'http://localhost:5000/api',
  clientId: 'your_client_id'
});

// Authenticate
const { authUrl } = await client.auth.getAuthUrl();
// ... handle OAuth flow ...

// Set access token
client.setAccessToken(accessToken);

// Get employees
const employees = await client.employees.list({
  page: 1,
  limit: 20,
  department: 'Engineering'
});

// Get specific employee
const employee = await client.employees.get('emp_123456');

// Update employee
const updated = await client.employees.update('emp_123456', {
  position: 'Senior Developer'
});
```

### Python SDK

```python
from employee_api import EmployeeAPIClient

client = EmployeeAPIClient(
    base_url='http://localhost:5000/api',
    client_id='your_client_id'
)

# Authenticate
auth_url = client.auth.get_auth_url()
# ... handle OAuth flow ...

# Set access token
client.set_access_token(access_token)

# Get employees
employees = client.employees.list(
    page=1,
    limit=20,
    department='Engineering'
)

# Get specific employee
employee = client.employees.get('emp_123456')

# Update employee
updated = client.employees.update('emp_123456', {
    'position': 'Senior Developer'
})
```

### React Hook Example

```jsx
import { useEmployeeAPI } from '@company/employee-api-react';

function EmployeeList() {
  const { employees, loading, error, refetch } = useEmployeeAPI({
    endpoint: '/employees',
    params: {
      department: 'Engineering',
      page: 1,
      limit: 20
    }
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {employees.map(emp => (
        <EmployeeCard key={emp.id} employee={emp} />
      ))}
    </div>
  );
}
```

### GraphQL Gateway (Future)

```graphql
query GetEmployees($department: String, $page: Int) {
  employees(department: $department, page: $page) {
    nodes {
      id
      email
      firstName
      lastName
      department
      roles {
        code
        name
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

## API Changelog

### Version 1.0.0 (2025-08-10)
- Initial release
- Google OAuth 2.0 with PKCE
- Employee CRUD operations
- Role-based access control
- Audit logging
- Rate limiting

### Upcoming Features (v1.1.0)
- Webhook support
- Bulk operations
- GraphQL endpoint
- Advanced search
- Export functionality
- Team management endpoints

---

*Last Updated: 2025-08-10*
*API Version: 1.0.0*
*Support: api-support@example.com*