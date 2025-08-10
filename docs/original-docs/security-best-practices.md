# Security Best Practices Guide - Google Authentication Employee Management System

## Table of Contents
1. [Overview](#overview)
2. [Authentication Security](#authentication-security)
3. [Authorization Security](#authorization-security)
4. [Data Protection](#data-protection)
5. [Network Security](#network-security)
6. [Application Security](#application-security)
7. [Infrastructure Security](#infrastructure-security)
8. [Security Monitoring](#security-monitoring)
9. [Incident Response](#incident-response)
10. [Compliance and Auditing](#compliance-and-auditing)

## Overview

This document outlines comprehensive security best practices for the Google Authentication Employee Management System. Security is paramount in this system as it handles sensitive employee data and authentication credentials.

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal necessary permissions
3. **Zero Trust**: Verify everything, trust nothing
4. **Secure by Default**: Security enabled from the start
5. **Continuous Monitoring**: Real-time threat detection

### Threat Model

Key threats to consider:
- **Authentication bypass**: Unauthorized access attempts
- **Session hijacking**: Token or session theft
- **Data breaches**: Unauthorized data access
- **Injection attacks**: SQL, NoSQL, command injection
- **Cross-site attacks**: XSS, CSRF
- **Denial of Service**: Resource exhaustion
- **Insider threats**: Malicious employees

## Authentication Security

### 1. Google OAuth 2.0 Security

#### PKCE Implementation
```typescript
// Secure PKCE implementation
import crypto from 'crypto';

export class PKCEService {
  // Generate cryptographically secure code verifier
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Generate code challenge using SHA256
  generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  // Verify PKCE challenge
  verifyChallenge(verifier: string, challenge: string): boolean {
    const computedChallenge = this.generateCodeChallenge(verifier);
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(challenge),
      Buffer.from(computedChallenge)
    );
  }
}
```

#### State Parameter Security
```typescript
// Secure state parameter handling
export class StateService {
  private readonly STATE_EXPIRY = 15 * 60 * 1000; // 15 minutes

  async generateState(ipAddress: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('base64url');
    
    // Store with additional security context
    await prisma.oAuthState.create({
      data: {
        state,
        ipAddress,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + this.STATE_EXPIRY),
        fingerprint: this.generateFingerprint(req)
      }
    });

    return state;
  }

  async validateState(
    state: string, 
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    const storedState = await prisma.oAuthState.findUnique({
      where: { state }
    });

    if (!storedState || storedState.used) {
      return false;
    }

    // Validate all security parameters
    const isValid = 
      storedState.ipAddress === ipAddress &&
      storedState.userAgent === userAgent &&
      storedState.expiresAt > new Date();

    // Mark as used to prevent replay
    await prisma.oAuthState.update({
      where: { state },
      data: { used: true }
    });

    return isValid;
  }

  private generateFingerprint(req: Request): string {
    // Create browser fingerprint for additional validation
    const data = [
      req.headers['accept'],
      req.headers['accept-language'],
      req.headers['accept-encoding'],
      req.headers['user-agent']
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
```

### 2. JWT Token Security

#### Secure Token Generation
```typescript
// JWT security configuration
export class JWTService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;
  private readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;
  
  // Use different secrets for different token types
  generateTokens(payload: TokenPayload) {
    // Access token with short expiry
    const accessToken = jwt.sign(
      {
        ...payload,
        type: 'access',
        jti: crypto.randomUUID(), // Unique token ID
      },
      this.ACCESS_TOKEN_SECRET,
      {
        expiresIn: '15m',
        algorithm: 'HS256',
        issuer: 'employee-system',
        audience: 'employee-api'
      }
    );

    // Refresh token with longer expiry
    const refreshToken = jwt.sign(
      {
        sub: payload.sub,
        type: 'refresh',
        jti: crypto.randomUUID(),
        // Include token family for rotation tracking
        family: crypto.randomUUID()
      },
      this.REFRESH_TOKEN_SECRET,
      {
        expiresIn: '7d',
        algorithm: 'HS256'
      }
    );

    return { accessToken, refreshToken };
  }

  // Secure token validation
  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        algorithms: ['HS256'],
        issuer: 'employee-system',
        audience: 'employee-api'
      }) as TokenPayload;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(decoded.jti)) {
        return null;
      }

      // Additional validation
      if (decoded.type !== 'access') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Token rotation for refresh tokens
  async rotateRefreshToken(oldToken: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(oldToken, this.REFRESH_TOKEN_SECRET) as any;
      
      // Check token family for reuse detection
      const tokenFamily = await this.getTokenFamily(decoded.family);
      if (tokenFamily.revoked) {
        // Potential token reuse attack - revoke entire family
        await this.revokeTokenFamily(decoded.family);
        return null;
      }

      // Generate new token in same family
      const newToken = jwt.sign(
        {
          sub: decoded.sub,
          type: 'refresh',
          jti: crypto.randomUUID(),
          family: decoded.family
        },
        this.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      // Revoke old token
      await this.revokeToken(decoded.jti);

      return newToken;
    } catch (error) {
      return null;
    }
  }
}
```

### 3. Session Security

#### Secure Session Management
```typescript
// Redis session configuration
export const sessionConfig = {
  store: new RedisStore({
    client: redisClient,
    prefix: 'emp:sess:',
    ttl: 86400, // 24 hours
    disableTouch: false
  }),
  secret: process.env.SESSION_SECRET!,
  name: 'emp_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 86400000, // 24 hours
    sameSite: 'strict' as const,
    domain: process.env.COOKIE_DOMAIN
  },
  genid: () => crypto.randomUUID(),
  // Regenerate session ID on login
  regenerate: true
};

// Session security middleware
export class SessionSecurity {
  // Bind session to user fingerprint
  async createSecureSession(req: Request, userId: number) {
    const fingerprint = this.generateFingerprint(req);
    
    req.session.userId = userId;
    req.session.fingerprint = fingerprint;
    req.session.createdAt = Date.now();
    req.session.lastActivity = Date.now();
    
    // Regenerate session ID to prevent fixation
    await new Promise((resolve) => req.session.regenerate(resolve));
  }

  // Validate session integrity
  validateSession(req: Request): boolean {
    if (!req.session.userId || !req.session.fingerprint) {
      return false;
    }

    // Check fingerprint match
    const currentFingerprint = this.generateFingerprint(req);
    if (req.session.fingerprint !== currentFingerprint) {
      this.destroySession(req);
      return false;
    }

    // Check session age
    const sessionAge = Date.now() - req.session.createdAt;
    if (sessionAge > 24 * 60 * 60 * 1000) {
      this.destroySession(req);
      return false;
    }

    // Update last activity
    req.session.lastActivity = Date.now();
    return true;
  }

  private generateFingerprint(req: Request): string {
    const data = [
      req.ip,
      req.headers['user-agent'],
      req.headers['accept-language']
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async destroySession(req: Request) {
    await new Promise((resolve) => req.session.destroy(resolve));
  }
}
```

### 4. Multi-Factor Authentication (Future Enhancement)

```typescript
// MFA implementation blueprint
export class MFAService {
  // Generate TOTP secret
  generateSecret(userId: number): string {
    const secret = speakeasy.generateSecret({
      name: `Employee System (${userId})`,
      issuer: 'Employee Management System'
    });

    return secret.base32;
  }

  // Verify TOTP token
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 intervals tolerance
    });
  }

  // Backup codes generation
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex'));
    }
    return codes;
  }
}
```

## Authorization Security

### 1. Role-Based Access Control (RBAC)

#### Secure Permission Checking
```typescript
// Authorization middleware
export class AuthorizationService {
  // Check permissions with caching
  async hasPermission(
    userId: number,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = `perm:${userId}:${resource}:${action}`;
    const cached = await redisClient.get(cacheKey);
    if (cached !== null) {
      return cached === '1';
    }

    // Query database with optimized query
    const permission = await prisma.employee.findFirst({
      where: {
        id: userId,
        isActive: true,
        employeeRoles: {
          some: {
            isActive: true,
            role: {
              isActive: true,
              rolePermissions: {
                some: {
                  permission: {
                    resource,
                    action,
                    isActive: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const hasPermission = permission !== null;
    
    // Cache result for 5 minutes
    await redisClient.setex(cacheKey, 300, hasPermission ? '1' : '0');
    
    return hasPermission;
  }

  // Middleware for route protection
  requirePermission(resource: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const hasPermission = await this.hasPermission(userId, resource, action);
      
      if (!hasPermission) {
        // Log authorization failure
        await auditService.log({
          eventType: 'AUTHORIZATION_DENIED',
          severity: 'medium',
          employeeId: userId,
          resource,
          action,
          result: 'denied'
        });

        return res.status(403).json({
          success: false,
          error: { 
            code: 'FORBIDDEN', 
            message: 'Insufficient permissions',
            details: { resource, action }
          }
        });
      }

      next();
    };
  }
}
```

### 2. Resource-Level Security

```typescript
// Resource ownership validation
export class ResourceSecurity {
  // Validate resource ownership
  async canAccessResource(
    userId: number,
    resourceType: string,
    resourceId: number
  ): Promise<boolean> {
    switch (resourceType) {
      case 'employee':
        return this.canAccessEmployee(userId, resourceId);
      case 'report':
        return this.canAccessReport(userId, resourceId);
      default:
        return false;
    }
  }

  private async canAccessEmployee(
    userId: number,
    employeeId: number
  ): Promise<boolean> {
    // Self access always allowed
    if (userId === employeeId) {
      return true;
    }

    // Check if user has employee management permission
    const hasPermission = await authorizationService.hasPermission(
      userId,
      'employees',
      'read'
    );

    if (!hasPermission) {
      return false;
    }

    // Additional checks for hierarchical access
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      include: { employeeRoles: { include: { role: true } } }
    });

    // Managers can only access their department
    if (user?.employeeRoles.some(er => er.role.roleCode === 'MANAGER')) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId }
      });

      return user.department === targetEmployee?.department;
    }

    return true;
  }
}
```

## Data Protection

### 1. Encryption at Rest

```typescript
// Field-level encryption for sensitive data
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');

  encrypt(text: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  decrypt(data: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));
    
    let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Prisma middleware for automatic encryption
prisma.$use(async (params, next) => {
  // Encrypt sensitive fields before save
  if (params.model === 'Employee' && params.action === 'create') {
    if (params.args.data.ssn) {
      params.args.data.ssn = encryptionService.encrypt(params.args.data.ssn);
    }
  }
  
  const result = await next(params);
  
  // Decrypt sensitive fields after fetch
  if (params.model === 'Employee' && result && result.ssn) {
    result.ssn = encryptionService.decrypt(result.ssn);
  }
  
  return result;
});
```

### 2. Data Masking and Redaction

```typescript
// Data masking for logs and responses
export class DataMasking {
  // Mask sensitive fields in objects
  maskSensitiveData(data: any): any {
    const masked = { ...data };
    
    // Define sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'refreshToken',
      'accessToken',
      'clientSecret',
      'ssn',
      'creditCard',
      'apiKey'
    ];

    // Recursively mask fields
    const maskObject = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.includes(key)) {
          obj[key] = this.maskValue(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          maskObject(obj[key]);
        }
      }
    };

    maskObject(masked);
    return masked;
  }

  private maskValue(value: string): string {
    if (!value || value.length < 4) {
      return '****';
    }

    // Show first and last 2 characters
    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    const middle = '*'.repeat(Math.max(4, value.length - 4));
    
    return `${start}${middle}${end}`;
  }

  // Mask email addresses
  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '**';
    
    return `${maskedLocal}@${domain}`;
  }
}
```

### 3. Data Retention and Purging

```typescript
// Automated data retention policy
export class DataRetentionService {
  // Schedule daily cleanup
  async enforceRetentionPolicies() {
    // Remove expired OAuth states
    await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    // Remove old refresh tokens
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });

    // Archive old audit logs
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const oldLogs = await prisma.auditLog.findMany({
      where: { timestamp: { lt: sixMonthsAgo } }
    });

    // Archive to cold storage
    await this.archiveToS3(oldLogs);

    // Remove from hot storage
    await prisma.auditLog.deleteMany({
      where: { timestamp: { lt: sixMonthsAgo } }
    });
  }

  // Secure data deletion
  async secureDelete(model: string, id: number) {
    // Overwrite with random data before deletion
    const randomData = crypto.randomBytes(32).toString('hex');
    
    await prisma[model].update({
      where: { id },
      data: { 
        // Overwrite all string fields
        email: randomData,
        firstName: randomData,
        lastName: randomData
      }
    });

    // Then delete
    await prisma[model].delete({ where: { id } });
  }
}
```

## Network Security

### 1. HTTPS Configuration

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # SSL optimizations
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

### 2. API Security Headers

```typescript
// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  next();
};
```

### 3. Rate Limiting and DDoS Protection

```typescript
// Advanced rate limiting
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Different rate limits for different endpoints
export const rateLimiters = {
  // Strict limit for auth endpoints
  auth: rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:auth:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts',
    standardHeaders: true,
    legacyHeaders: false,
    // Custom key generator
    keyGenerator: (req) => {
      return req.ip + ':' + req.body?.email || '';
    },
    // Skip successful requests
    skipSuccessfulRequests: true
  }),

  // General API limit
  api: rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:api:'
    }),
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Strict limit for password reset
  passwordReset: rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:reset:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    skipSuccessfulRequests: false
  })
};

// DDoS protection with dynamic blocking
export class DDoSProtection {
  private readonly threshold = 1000; // requests per minute
  private readonly blockDuration = 3600; // 1 hour in seconds

  async checkAndBlock(ip: string): Promise<boolean> {
    const key = `ddos:${ip}`;
    const count = await redisClient.incr(key);
    
    if (count === 1) {
      await redisClient.expire(key, 60); // Reset counter after 1 minute
    }
    
    if (count > this.threshold) {
      // Block IP
      await redisClient.setex(`blocked:${ip}`, this.blockDuration, '1');
      
      // Log incident
      await auditService.log({
        eventType: 'DDOS_DETECTED',
        severity: 'critical',
        ipAddress: ip,
        details: { requestCount: count }
      });
      
      return true;
    }
    
    return false;
  }

  async isBlocked(ip: string): Promise<boolean> {
    const blocked = await redisClient.get(`blocked:${ip}`);
    return blocked === '1';
  }
}
```

## Application Security

### 1. Input Validation and Sanitization

```typescript
// Comprehensive input validation
import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

export const validators = {
  // Email validation with additional checks
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .custom(async (email) => {
      // Check against disposable email domains
      const domain = email.split('@')[1];
      const isDisposable = await checkDisposableEmail(domain);
      if (isDisposable) {
        throw new Error('Disposable email addresses not allowed');
      }
      return true;
    }),

  // Strong password validation
  password: body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character')
    .custom((password) => {
      // Check against common passwords
      const commonPasswords = ['Password123!', 'Admin123!', 'Welcome123!'];
      if (commonPasswords.includes(password)) {
        throw new Error('Password is too common');
      }
      return true;
    }),

  // SQL injection prevention for search queries
  search: query('search')
    .trim()
    .escape()
    .isLength({ max: 100 })
    .matches(/^[a-zA-Z0-9\s\-_.@]+$/)
    .withMessage('Invalid search characters'),

  // ID validation
  id: param('id')
    .isInt({ min: 1 })
    .toInt(),

  // Sanitize HTML content
  sanitizeHtml: (value: string) => {
    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br'],
      ALLOWED_ATTR: []
    });
  }
};

// Validation error handler
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation attempts
    auditService.log({
      eventType: 'VALIDATION_FAILED',
      severity: 'low',
      ipAddress: req.ip,
      details: { errors: errors.array() }
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  
  next();
};
```

### 2. SQL Injection Prevention

```typescript
// Safe database queries with Prisma
export class SafeQueryBuilder {
  // Parameterized queries only
  async findEmployeesByDepartment(department: string) {
    // Prisma automatically parameterizes queries
    return await prisma.employee.findMany({
      where: {
        department: department,
        isActive: true
      }
    });
  }

  // Safe raw queries when needed
  async searchEmployees(searchTerm: string) {
    // Validate and sanitize search term
    const sanitized = searchTerm.replace(/[^\w\s]/gi, '');
    
    // Use parameterized raw query
    return await prisma.$queryRaw`
      SELECT id, email, "firstName", "lastName", department
      FROM employees
      WHERE 
        "isActive" = true AND
        ("firstName" ILIKE ${`%${sanitized}%`} OR
         "lastName" ILIKE ${`%${sanitized}%`} OR
         email ILIKE ${`%${sanitized}%`})
      LIMIT 50
    `;
  }

  // Prevent query injection in dynamic queries
  async dynamicQuery(filters: Record<string, any>) {
    // Whitelist allowed fields
    const allowedFields = ['department', 'position', 'isActive'];
    const where: any = {};
    
    for (const [key, value] of Object.entries(filters)) {
      if (allowedFields.includes(key)) {
        where[key] = value;
      }
    }
    
    return await prisma.employee.findMany({ where });
  }
}
```

### 3. XSS Prevention

```typescript
// XSS prevention middleware
export class XSSProtection {
  // Sanitize all input
  sanitizeRequest(req: Request, res: Response, next: NextFunction) {
    // Sanitize body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }
    
    // Sanitize params
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }
    
    next();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  private sanitizeString(str: string): string {
    // Remove script tags and event handlers
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
}

// React component XSS prevention
const SafeDisplay: React.FC<{ content: string }> = ({ content }) => {
  // Use DOMPurify for client-side sanitization
  const sanitized = DOMPurify.sanitize(content);
  
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
};
```

### 4. CSRF Protection

```typescript
// CSRF token generation and validation
export class CSRFProtection {
  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token in Redis with session binding
    redisClient.setex(
      `csrf:${sessionId}`,
      3600, // 1 hour
      token
    );
    
    return token;
  }

  async validateToken(
    sessionId: string,
    token: string
  ): Promise<boolean> {
    const storedToken = await redisClient.get(`csrf:${sessionId}`);
    
    if (!storedToken || !token) {
      return false;
    }
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(storedToken),
      Buffer.from(token)
    );
  }

  // Middleware for CSRF protection
  protect() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      const token = req.headers['x-csrf-token'] as string;
      const sessionId = req.session?.id;
      
      if (!sessionId || !await this.validateToken(sessionId, token)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_VALIDATION_FAILED',
            message: 'Invalid CSRF token'
          }
        });
      }
      
      next();
    };
  }
}
```

## Infrastructure Security

### 1. Container Security

```dockerfile
# Secure Docker configuration
FROM node:18-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files with specific ownership
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies as non-root
USER nodejs
RUN npm ci --only=production

# Copy application files
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Use non-root user
USER nodejs

# Security configurations
ENV NODE_ENV=production

# Expose only necessary port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run application
CMD ["node", "dist/server.js"]
```

### 2. Secrets Management

```typescript
// Secure secrets management
export class SecretsManager {
  private cache = new Map<string, string>();
  
  // Fetch secrets from secure vault
  async getSecret(key: string): Promise<string> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Fetch from environment or secret manager
    let secret: string;
    
    if (process.env.USE_AWS_SECRETS === 'true') {
      // AWS Secrets Manager
      secret = await this.getFromAWS(key);
    } else if (process.env.USE_VAULT === 'true') {
      // HashiCorp Vault
      secret = await this.getFromVault(key);
    } else {
      // Environment variable
      secret = process.env[key] || '';
    }

    // Validate secret
    if (!secret) {
      throw new Error(`Secret ${key} not found`);
    }

    // Cache for 5 minutes
    this.cache.set(key);
    setTimeout(() => this.cache.delete(key), 5 * 60 * 1000);

    return secret;
  }

  // Rotate secrets periodically
  async rotateSecrets() {
    const secrets = [
      'JWT_SECRET',
      'SESSION_SECRET',
      'ENCRYPTION_KEY',
      'DATABASE_PASSWORD'
    ];

    for (const secret of secrets) {
      await this.rotateSecret(secret);
    }
  }

  private async rotateSecret(key: string) {
    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString('base64');
    
    // Update in secret store
    await this.updateSecret(key, newSecret);
    
    // Clear cache
    this.cache.delete(key);
    
    // Log rotation
    auditService.log({
      eventType: 'SECRET_ROTATED',
      severity: 'high',
      details: { secretKey: key }
    });
  }
}
```

### 3. Network Isolation

```yaml
# Docker network isolation
version: '3.8'

networks:
  frontend:
    driver: bridge
    internal: false
  backend:
    driver: bridge
    internal: true
  database:
    driver: bridge
    internal: true

services:
  nginx:
    networks:
      - frontend
      - backend

  api:
    networks:
      - backend
      - database
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis

  postgres:
    networks:
      - database

  redis:
    networks:
      - database
```

## Security Monitoring

### 1. Security Event Logging

```typescript
// Comprehensive security logging
export class SecurityLogger {
  private readonly sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /authorization/i
  ];

  async logSecurityEvent(event: SecurityEvent) {
    // Sanitize event data
    const sanitized = this.sanitizeEvent(event);
    
    // Add context
    const enriched = {
      ...sanitized,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: 'employee-api',
      version: process.env.APP_VERSION
    };

    // Log to multiple destinations
    await Promise.all([
      this.logToDatabase(enriched),
      this.logToSIEM(enriched),
      this.logToFile(enriched)
    ]);

    // Alert on critical events
    if (event.severity === 'critical') {
      await this.sendAlert(enriched);
    }
  }

  private sanitizeEvent(event: any): any {
    const sanitized = { ...event };
    
    // Remove sensitive data from logs
    const removeSensitive = (obj: any) => {
      for (const key in obj) {
        if (this.sensitivePatterns.some(pattern => pattern.test(key))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          removeSensitive(obj[key]);
        }
      }
    };

    removeSensitive(sanitized);
    return sanitized;
  }

  // Real-time alerting for critical events
  private async sendAlert(event: SecurityEvent) {
    // Send to multiple channels
    await Promise.all([
      this.sendEmail(event),
      this.sendSlack(event),
      this.sendPagerDuty(event)
    ]);
  }
}
```

### 2. Intrusion Detection

```typescript
// Behavioral anomaly detection
export class IntrusionDetection {
  // Detect suspicious patterns
  async detectAnomalies(userId: number, activity: UserActivity) {
    const anomalies: string[] = [];

    // Check login anomalies
    if (await this.isLoginAnomaly(userId, activity)) {
      anomalies.push('unusual_login_location');
    }

    // Check access patterns
    if (await this.isAccessAnomaly(userId, activity)) {
      anomalies.push('unusual_access_pattern');
    }

    // Check time-based anomalies
    if (this.isTimeAnomaly(userId, activity)) {
      anomalies.push('unusual_access_time');
    }

    // Check request volume
    if (await this.isVolumeAnomaly(userId, activity)) {
      anomalies.push('high_request_volume');
    }

    if (anomalies.length > 0) {
      await this.handleAnomalies(userId, anomalies);
    }
  }

  private async isLoginAnomaly(
    userId: number,
    activity: UserActivity
  ): Promise<boolean> {
    // Get user's typical login locations
    const locations = await this.getUserLoginLocations(userId);
    const currentLocation = await this.getLocationFromIP(activity.ipAddress);

    // Calculate distance from typical locations
    for (const location of locations) {
      const distance = this.calculateDistance(location, currentLocation);
      if (distance < 100) { // Within 100km
        return false;
      }
    }

    // New location detected
    return true;
  }

  private async handleAnomalies(userId: number, anomalies: string[]) {
    // Log anomaly
    await securityLogger.logSecurityEvent({
      eventType: 'ANOMALY_DETECTED',
      severity: 'high',
      employeeId: userId,
      anomalies,
      action: 'investigation_required'
    });

    // Take protective action based on severity
    if (anomalies.length >= 3) {
      // Multiple anomalies - lock account
      await this.lockAccount(userId);
    } else if (anomalies.includes('unusual_login_location')) {
      // Require additional verification
      await this.requireMFA(userId);
    }
  }
}
```

### 3. Security Metrics and Dashboards

```typescript
// Security metrics collection
export class SecurityMetrics {
  // Collect and export metrics
  async collectMetrics() {
    const metrics = {
      // Authentication metrics
      login_attempts: await this.getLoginAttempts(),
      failed_logins: await this.getFailedLogins(),
      successful_logins: await this.getSuccessfulLogins(),
      
      // Authorization metrics
      permission_denials: await this.getPermissionDenials(),
      
      // Security events
      security_events: await this.getSecurityEvents(),
      blocked_ips: await this.getBlockedIPs(),
      
      // System health
      ssl_certificate_expiry: await this.getSSLExpiry(),
      vulnerability_scan_results: await this.getVulnScanResults()
    };

    // Export to monitoring system
    await this.exportToPrometheus(metrics);
    await this.exportToDatadog(metrics);
  }

  // Generate security report
  async generateSecurityReport(): Promise<SecurityReport> {
    const report = {
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      summary: {
        totalLoginAttempts: 0,
        failedLogins: 0,
        blockedIPs: 0,
        securityIncidents: 0
      },
      incidents: [],
      recommendations: []
    };

    // Populate report data
    report.summary = await this.getSummaryStats();
    report.incidents = await this.getIncidents();
    report.recommendations = this.generateRecommendations(report);

    return report;
  }
}
```

## Incident Response

### 1. Incident Response Plan

```typescript
// Automated incident response
export class IncidentResponse {
  async handleSecurityIncident(incident: SecurityIncident) {
    // 1. Detect and classify
    const severity = this.classifyIncident(incident);
    
    // 2. Contain
    await this.containIncident(incident);
    
    // 3. Investigate
    const investigation = await this.investigateIncident(incident);
    
    // 4. Remediate
    await this.remediateIncident(incident, investigation);
    
    // 5. Document
    await this.documentIncident(incident, investigation);
    
    // 6. Learn
    await this.updateSecurityPolicies(incident);
  }

  private async containIncident(incident: SecurityIncident) {
    switch (incident.type) {
      case 'account_compromise':
        // Lock affected accounts
        await this.lockAccounts(incident.affectedUsers);
        // Revoke all sessions
        await this.revokeSessions(incident.affectedUsers);
        break;
        
      case 'data_breach':
        // Isolate affected systems
        await this.isolateSystem(incident.affectedSystem);
        // Block suspicious IPs
        await this.blockIPs(incident.suspiciousIPs);
        break;
        
      case 'malware_detection':
        // Quarantine affected files
        await this.quarantineFiles(incident.affectedFiles);
        // Scan all systems
        await this.initiateFullScan();
        break;
    }
  }

  private async investigateIncident(
    incident: SecurityIncident
  ): Promise<Investigation> {
    const investigation = {
      timeline: await this.buildTimeline(incident),
      affectedSystems: await this.identifyAffectedSystems(incident),
      dataExposure: await this.assessDataExposure(incident),
      rootCause: await this.findRootCause(incident),
      indicators: await this.collectIOCs(incident)
    };

    return investigation;
  }
}
```

### 2. Forensics and Evidence Collection

```typescript
// Digital forensics
export class ForensicsCollector {
  async collectEvidence(incidentId: string) {
    const evidence = {
      logs: await this.collectLogs(incidentId),
      memory: await this.captureMemory(),
      network: await this.captureNetworkTraffic(),
      disk: await this.createDiskImage(),
      metadata: {
        collectedAt: new Date(),
        collectedBy: 'automated-system',
        chain_of_custody: []
      }
    };

    // Ensure evidence integrity
    evidence.hash = this.calculateHash(evidence);
    
    // Store securely
    await this.storeEvidence(evidence);
    
    return evidence;
  }

  private async collectLogs(incidentId: string) {
    // Collect all relevant logs
    const logs = {
      application: await this.getApplicationLogs(),
      system: await this.getSystemLogs(),
      security: await this.getSecurityLogs(),
      network: await this.getNetworkLogs(),
      database: await this.getDatabaseLogs()
    };

    // Filter by time window
    const timeWindow = this.getIncidentTimeWindow(incidentId);
    return this.filterLogsByTime(logs, timeWindow);
  }

  // Create tamper-proof evidence
  private calculateHash(evidence: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(evidence));
    return hash.digest('hex');
  }
}
```

## Compliance and Auditing

### 1. Compliance Monitoring

```typescript
// Compliance checker
export class ComplianceMonitor {
  // Check GDPR compliance
  async checkGDPRCompliance(): Promise<ComplianceReport> {
    const report = {
      compliant: true,
      issues: [],
      checks: []
    };

    // Data minimization
    const dataMinimization = await this.checkDataMinimization();
    report.checks.push(dataMinimization);

    // Consent management
    const consent = await this.checkConsentManagement();
    report.checks.push(consent);

    // Right to erasure
    const erasure = await this.checkRightToErasure();
    report.checks.push(erasure);

    // Data portability
    const portability = await this.checkDataPortability();
    report.checks.push(portability);

    // Update compliance status
    report.compliant = report.checks.every(check => check.passed);
    report.issues = report.checks
      .filter(check => !check.passed)
      .map(check => check.issue);

    return report;
  }

  // Generate audit trail
  async generateAuditTrail(
    startDate: Date,
    endDate: Date
  ): Promise<AuditTrail> {
    const trail = {
      period: { start: startDate, end: endDate },
      events: await this.getAuditEvents(startDate, endDate),
      summary: {
        totalEvents: 0,
        byType: {},
        bySeverity: {},
        byUser: {}
      }
    };

    // Calculate summary statistics
    trail.summary = this.calculateSummary(trail.events);

    // Sign audit trail for integrity
    trail.signature = this.signAuditTrail(trail);

    return trail;
  }

  private signAuditTrail(trail: AuditTrail): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(trail));
    return signer.sign(process.env.AUDIT_SIGNING_KEY!, 'hex');
  }
}
```

### 2. Security Audit Automation

```typescript
// Automated security audits
export class SecurityAuditor {
  async runSecurityAudit(): Promise<AuditReport> {
    const report = {
      timestamp: new Date(),
      checks: [],
      vulnerabilities: [],
      recommendations: []
    };

    // Run all security checks
    const checks = [
      this.auditAuthentication(),
      this.auditAuthorization(),
      this.auditEncryption(),
      this.auditNetworkSecurity(),
      this.auditAccessControls(),
      this.auditDataProtection(),
      this.auditLogging(),
      this.auditDependencies()
    ];

    report.checks = await Promise.all(checks);

    // Identify vulnerabilities
    report.vulnerabilities = this.identifyVulnerabilities(report.checks);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    // Store audit report
    await this.storeAuditReport(report);

    return report;
  }

  private async auditDependencies(): Promise<AuditCheck> {
    // Check for vulnerable dependencies
    const vulnCheck = await exec('npm audit --json');
    const vulnerabilities = JSON.parse(vulnCheck);

    return {
      name: 'Dependency Vulnerabilities',
      passed: vulnerabilities.vulnerabilities === 0,
      findings: vulnerabilities.advisories,
      severity: this.calculateSeverity(vulnerabilities)
    };
  }

  private async auditAccessControls(): Promise<AuditCheck> {
    const issues = [];

    // Check for overly permissive roles
    const roles = await prisma.role.findMany({
      include: { rolePermissions: true }
    });

    for (const role of roles) {
      if (role.rolePermissions.length > 20) {
        issues.push(`Role ${role.roleCode} has too many permissions`);
      }
    }

    // Check for unused accounts
    const inactiveUsers = await prisma.employee.findMany({
      where: {
        lastLogin: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        },
        isActive: true
      }
    });

    if (inactiveUsers.length > 0) {
      issues.push(`${inactiveUsers.length} inactive users found`);
    }

    return {
      name: 'Access Controls',
      passed: issues.length === 0,
      findings: issues,
      severity: issues.length > 5 ? 'high' : 'medium'
    };
  }
}
```

## Security Checklist

### Pre-Deployment Checklist
- [ ] All dependencies updated to latest secure versions
- [ ] Security headers configured correctly
- [ ] SSL/TLS certificates valid and properly configured
- [ ] Environment variables secured and not exposed
- [ ] Database connections using SSL
- [ ] All API endpoints require authentication
- [ ] Rate limiting configured on all endpoints
- [ ] Input validation on all user inputs
- [ ] CORS properly configured
- [ ] Security logging enabled
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested
- [ ] Incident response plan documented and tested
- [ ] Security audit completed
- [ ] Penetration testing performed

### Ongoing Security Tasks
- [ ] Weekly dependency vulnerability scan
- [ ] Monthly security patch review
- [ ] Quarterly security audit
- [ ] Semi-annual penetration testing
- [ ] Annual security training for team
- [ ] Continuous monitoring of security logs
- [ ] Regular review of access controls
- [ ] Periodic password rotation
- [ ] Regular backup verification
- [ ] Incident response drills

---

Document Version: 1.0.0  
Last Updated: 2025-08-10  
Security Contact: security@company.com  
Maintained by: Security Team