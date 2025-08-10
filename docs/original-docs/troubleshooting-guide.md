# Troubleshooting Guide - Google Authentication Employee Management System

## Table of Contents
1. [Overview](#overview)
2. [Common Issues](#common-issues)
3. [Authentication Problems](#authentication-problems)
4. [Database Issues](#database-issues)
5. [API Errors](#api-errors)
6. [Frontend Issues](#frontend-issues)
7. [Performance Problems](#performance-problems)
8. [Docker and Deployment Issues](#docker-and-deployment-issues)
9. [Debugging Tools](#debugging-tools)
10. [Emergency Procedures](#emergency-procedures)

## Overview

This guide provides solutions to common issues encountered with the Google Authentication Employee Management System. Each section includes symptoms, causes, and step-by-step solutions.

### Quick Diagnostic Commands

```bash
# Check system status
npm run status

# Run health checks
curl http://localhost:5000/health

# Check logs
pm2 logs employee-api --lines 100

# Database connection test
npm run db:test

# Redis connection test
redis-cli -a $REDIS_PASSWORD ping
```

## Common Issues

### 1. Application Won't Start

#### Symptoms
- Server fails to start
- PM2 shows application as errored
- No response on expected port

#### Diagnostic Steps
```bash
# Check if port is already in use
lsof -i :5000

# Check PM2 status
pm2 status

# View detailed error logs
pm2 logs employee-api --err --lines 200

# Check environment variables
node -e "console.log(require('dotenv').config())"
```

#### Common Causes and Solutions

**Cause 1: Port Already in Use**
```bash
# Find process using port
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>

# Or use a different port
PORT=5001 npm start
```

**Cause 2: Missing Environment Variables**
```bash
# Check required variables
node scripts/check-env.js

# Copy and configure environment file
cp .env.example .env
nano .env
```

**Cause 3: Database Connection Failed**
```bash
# Test database connection
PGPASSWORD=$DATABASE_PASSWORD psql -U $DATABASE_USER -h localhost -d $DATABASE_NAME -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### 2. Module Not Found Errors

#### Symptoms
```
Error: Cannot find module 'express'
Error: Cannot find module '@prisma/client'
```

#### Solutions
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# For Prisma specifically
npm run prisma:generate

# For production
npm ci --production

# Check Node version
node --version  # Should be 18.x or higher
```

### 3. TypeScript Compilation Errors

#### Symptoms
```
TSError: ⨯ Unable to compile TypeScript
error TS2307: Cannot find module
```

#### Solutions
```bash
# Clean build
rm -rf dist
npm run build

# Check TypeScript configuration
npx tsc --showConfig

# Type checking only
npm run typecheck

# Update type definitions
npm install --save-dev @types/node@latest @types/express@latest
```

## Authentication Problems

### 1. Google OAuth Redirect Error

#### Symptoms
- "redirect_uri_mismatch" error
- User redirected to error page after Google login
- OAuth state validation fails

#### Diagnostic Steps
```bash
# Check configured redirect URI
echo $GOOGLE_REDIRECT_URI

# Verify Google Console settings
# Go to: https://console.cloud.google.com/apis/credentials
```

#### Solutions

**Solution 1: Update Redirect URI**
1. Go to Google Cloud Console
2. Navigate to APIs & Services > Credentials
3. Click on your OAuth 2.0 Client ID
4. Add authorized redirect URIs:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

**Solution 2: Fix Environment Variables**
```bash
# Backend (.env)
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Frontend (.env)
REACT_APP_API_URL=http://localhost:5000/api
```

### 2. JWT Token Invalid

#### Symptoms
- "Invalid token" errors
- 401 Unauthorized responses
- Token expired immediately

#### Diagnostic Tools
```javascript
// Debug JWT token
const jwt = require('jsonwebtoken');
const token = 'your-token-here';

try {
  const decoded = jwt.decode(token, { complete: true });
  console.log('Header:', decoded.header);
  console.log('Payload:', decoded.payload);
  console.log('Expires:', new Date(decoded.payload.exp * 1000));
} catch (error) {
  console.error('Invalid token:', error.message);
}
```

#### Solutions

**Solution 1: Clock Synchronization**
```bash
# Check system time
date

# Sync with NTP
sudo ntpdate -s time.nist.gov

# Or using systemd
sudo timedatectl set-ntp true
```

**Solution 2: Token Configuration**
```bash
# Check token expiry settings
JWT_ACCESS_TOKEN_EXPIRES_IN=15m  # Should be 15m, not 15s
JWT_REFRESH_TOKEN_EXPIRES_IN=7d  # Should be 7d, not 7m

# Verify JWT secret
echo -n $JWT_SECRET | wc -c  # Should be at least 32 characters
```

### 3. PKCE Verification Failed

#### Symptoms
- "Invalid code_verifier" error
- OAuth callback fails with PKCE error

#### Debug PKCE Flow
```javascript
// Test PKCE generation
const crypto = require('crypto');

// Generate code verifier
const codeVerifier = crypto.randomBytes(32).toString('base64url');
console.log('Code Verifier:', codeVerifier);

// Generate code challenge
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
console.log('Code Challenge:', codeChallenge);

// Verify
const computedChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
console.log('Verification:', computedChallenge === codeChallenge);
```

#### Solutions
1. Ensure code_verifier is stored properly in session/database
2. Check that the same code_verifier is sent in callback
3. Verify base64url encoding (no padding characters)

### 4. Session/Cookie Issues

#### Symptoms
- User logged out unexpectedly
- Session not persisting
- "No session found" errors

#### Solutions

**Solution 1: Cookie Configuration**
```javascript
// Check cookie settings in app.ts
app.use(session({
  cookie: {
    secure: false, // Set to false for localhost
    httpOnly: true,
    sameSite: 'lax', // Change from 'strict' for OAuth
    maxAge: 24 * 60 * 60 * 1000
  }
}));
```

**Solution 2: CORS Configuration**
```javascript
// Ensure credentials are allowed
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true  // Important for cookies
}));

// Frontend axios configuration
axios.defaults.withCredentials = true;
```

## Database Issues

### 1. Prisma Migration Errors

#### Symptoms
- "P1001: Can't reach database server" error
- Migration pending errors
- Schema out of sync

#### Diagnostic Commands
```bash
# Check migration status
npx prisma migrate status

# View current schema
npx prisma db pull

# Validate schema
npx prisma validate
```

#### Solutions

**Solution 1: Reset Database (Development Only)**
```bash
# WARNING: This will delete all data
npx prisma migrate reset

# Apply migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

**Solution 2: Fix Connection String**
```bash
# Test connection
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"

# With SSL (production)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

### 2. Connection Pool Exhausted

#### Symptoms
- "Too many connections" error
- Slow database queries
- Application hangs

#### Diagnostic Queries
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- View active queries
SELECT pid, age(clock_timestamp(), query_start), usename, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start desc;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND query_start < now() - interval '5 minutes';
```

#### Solutions

**Solution 1: Configure Connection Pool**
```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection limit
  connection_limit = 10
}

// Or in connection string
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10"
```

**Solution 2: Fix Connection Leaks**
```javascript
// Always use try-finally
async function queryDatabase() {
  const prisma = new PrismaClient();
  try {
    return await prisma.employee.findMany();
  } finally {
    await prisma.$disconnect();
  }
}
```

### 3. Slow Queries

#### Symptoms
- API endpoints timing out
- High database CPU usage
- Slow page loads

#### Identify Slow Queries
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries over 1 second
SELECT pg_reload_conf();

-- View slow queries
SELECT mean_exec_time, calls, query 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

#### Solutions

**Solution 1: Add Indexes**
```sql
-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Add indexes for common queries
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department) WHERE is_active = true;
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
```

**Solution 2: Optimize Queries**
```javascript
// Bad: N+1 query problem
const employees = await prisma.employee.findMany();
for (const emp of employees) {
  emp.roles = await prisma.employeeRole.findMany({
    where: { employeeId: emp.id }
  });
}

// Good: Include related data
const employees = await prisma.employee.findMany({
  include: {
    employeeRoles: {
      include: {
        role: true
      }
    }
  }
});
```

## API Errors

### 1. CORS Errors

#### Symptoms
```
Access to XMLHttpRequest blocked by CORS policy
No 'Access-Control-Allow-Origin' header present
```

#### Solutions

**Solution 1: Configure CORS Properly**
```javascript
// backend/src/app.ts
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400
};

app.use(cors(corsOptions));
```

**Solution 2: Proxy Configuration (Development)**
```json
// frontend/package.json
{
  "proxy": "http://localhost:5000"
}

// Or setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true
    })
  );
};
```

### 2. Request Timeout

#### Symptoms
- API calls timing out after 30-60 seconds
- "ECONNRESET" errors
- "Socket hang up" errors

#### Solutions

**Solution 1: Increase Timeouts**
```javascript
// Backend timeout configuration
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});

// Frontend axios configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 60000 // 60 seconds
});
```

**Solution 2: Optimize Long-Running Operations**
```javascript
// Use pagination for large datasets
app.get('/api/employees', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({ skip, take: limit }),
    prisma.employee.count()
  ]);

  res.json({
    data: employees,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});
```

### 3. Rate Limiting Errors

#### Symptoms
- 429 Too Many Requests
- "Rate limit exceeded" errors

#### Check Rate Limit Status
```bash
# View rate limit headers
curl -I http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Check Redis rate limit keys
redis-cli -a $REDIS_PASSWORD
KEYS rl:*
TTL rl:api:192.168.1.1
```

#### Solutions

**Solution 1: Adjust Rate Limits**
```javascript
// Increase limits for authenticated users
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.user) return 200; // Authenticated
    return 100; // Anonymous
  }
});
```

**Solution 2: Implement Retry Logic**
```javascript
// Frontend retry with exponential backoff
async function apiCallWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Frontend Issues

### 1. React App Won't Start

#### Symptoms
- Blank white page
- "Cannot GET /" error
- Build errors

#### Diagnostic Steps
```bash
# Check for build errors
npm run build

# View console errors
# Open browser DevTools > Console

# Check React version compatibility
npm list react react-dom
```

#### Solutions

**Solution 1: Clear Cache and Rebuild**
```bash
# Clear all caches
rm -rf node_modules/.cache
rm -rf build
npm cache clean --force

# Reinstall and build
npm install
npm run build
npm start
```

**Solution 2: Fix Import Errors**
```javascript
// Check for case-sensitive imports
// Wrong
import component from './Component';

// Correct
import Component from './Component';

// Check for missing exports
// components/index.ts
export { default as LoginPage } from './LoginPage';
export { default as Dashboard } from './Dashboard';
```

### 2. State Management Issues

#### Symptoms
- User logged out on page refresh
- State not updating
- Infinite re-renders

#### Solutions

**Solution 1: Persist Auth State**
```javascript
// AuthContext.tsx
const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Restore from localStorage
    const stored = localStorage.getItem('auth_user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    // Persist to localStorage
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [user]);

  // Verify token on mount
  useEffect(() => {
    if (user?.accessToken) {
      verifyToken(user.accessToken).catch(() => {
        setUser(null);
      });
    }
  }, []);
};
```

**Solution 2: Fix Infinite Loops**
```javascript
// Wrong: Missing dependency array
useEffect(() => {
  fetchData();
}); // Runs on every render

// Correct: With dependencies
useEffect(() => {
  fetchData();
}, []); // Runs once on mount

// With cleanup
useEffect(() => {
  const timer = setInterval(refreshToken, 60000);
  return () => clearInterval(timer);
}, []);
```

### 3. Google OAuth Integration Issues

#### Symptoms
- Google sign-in button not appearing
- "popup_closed_by_user" error
- OAuth flow not completing

#### Solutions

**Solution 1: Configure Google OAuth Client**
```javascript
// App.tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  return (
    <GoogleOAuthProvider 
      clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID!}
      onScriptLoadError={() => console.error('Google OAuth script failed to load')}
      onScriptLoadSuccess={() => console.log('Google OAuth ready')}
    >
      <Router>
        <Routes>
          {/* routes */}
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}
```

**Solution 2: Handle Popup Blockers**
```javascript
// LoginPage.tsx
const handleGoogleLogin = useCallback(async () => {
  try {
    // Check for popup blockers
    const testPopup = window.open('', '', 'width=1,height=1');
    if (!testPopup || testPopup.closed) {
      alert('Please enable popups for this site');
      return;
    }
    testPopup.close();

    // Proceed with login
    const result = await googleLogin();
    // Handle result
  } catch (error) {
    console.error('Login failed:', error);
  }
}, []);
```

## Performance Problems

### 1. Slow API Response Times

#### Symptoms
- API calls taking > 1 second
- High server CPU usage
- Memory leaks

#### Performance Monitoring
```javascript
// Add request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
    
    // Alert on slow requests
    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        duration,
        query: req.query
      });
    }
  });
  
  next();
});
```

#### Solutions

**Solution 1: Implement Caching**
```javascript
// Redis caching middleware
const cache = (duration: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.originalUrl}`;
    
    const cached = await redisClient.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Store original json method
    const originalJson = res.json;
    res.json = function(data) {
      // Cache the response
      redisClient.setex(key, duration, JSON.stringify(data));
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Use on endpoints
app.get('/api/employees', cache(600), getEmployees);
```

**Solution 2: Database Query Optimization**
```javascript
// Use select to limit fields
const employees = await prisma.employee.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    department: true
    // Don't include large fields unless needed
  }
});

// Use pagination
const employees = await prisma.employee.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' }
});
```

### 2. Memory Leaks

#### Symptoms
- Increasing memory usage over time
- Application crashes with "heap out of memory"
- PM2 restarting frequently

#### Diagnostic Tools
```bash
# Monitor memory usage
pm2 monit

# Generate heap snapshot
node --inspect server.js
# Open chrome://inspect in Chrome
# Take heap snapshot

# Use memory profiling
node --prof server.js
node --prof-process isolate-*.log > profile.txt
```

#### Solutions

**Solution 1: Fix Event Listener Leaks**
```javascript
// Wrong: Listener not removed
class Service {
  constructor() {
    process.on('SIGTERM', this.cleanup);
  }
}

// Correct: Remove listeners
class Service {
  constructor() {
    this.cleanup = this.cleanup.bind(this);
    process.on('SIGTERM', this.cleanup);
  }
  
  destroy() {
    process.off('SIGTERM', this.cleanup);
  }
}
```

**Solution 2: Close Resources Properly**
```javascript
// Ensure database connections are closed
app.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  
  await prisma.$disconnect();
  await redisClient.quit();
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### 3. High CPU Usage

#### Symptoms
- CPU at 100%
- Slow response times
- System unresponsive

#### Diagnostic Commands
```bash
# Find CPU-intensive processes
top -p $(pgrep -d',' node)

# Profile Node.js CPU usage
node --cpu-prof server.js
# Generates CPU profile file

# Analyze with Chrome DevTools
# chrome://inspect > Open dedicated DevTools for Node
```

#### Solutions

**Solution 1: Optimize Synchronous Operations**
```javascript
// Wrong: Synchronous operation blocks event loop
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Correct: Use async version
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
```

**Solution 2: Implement Worker Threads**
```javascript
// main.js
const { Worker } = require('worker_threads');

function runHeavyTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-task-worker.js', {
      workerData: data
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// heavy-task-worker.js
const { parentPort, workerData } = require('worker_threads');

// Perform CPU-intensive task
const result = performHeavyComputation(workerData);

parentPort.postMessage(result);
```

## Docker and Deployment Issues

### 1. Docker Container Won't Start

#### Symptoms
- Container exits immediately
- "Container failed to start" error
- No logs available

#### Diagnostic Commands
```bash
# Check container status
docker ps -a

# View container logs
docker logs employee-backend

# Inspect container
docker inspect employee-backend

# Run container interactively
docker run -it --rm employee-backend /bin/sh
```

#### Solutions

**Solution 1: Fix Dockerfile Issues**
```dockerfile
# Ensure proper Node.js installation
FROM node:18-alpine

# Install required system dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy and install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Use non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/server.js"]
```

**Solution 2: Environment Variable Issues**
```yaml
# docker-compose.yml
services:
  backend:
    image: employee-backend
    env_file:
      - .env.docker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
    depends_on:
      postgres:
        condition: service_healthy
```

### 2. Docker Networking Issues

#### Symptoms
- Cannot connect to database from container
- Service discovery not working
- Connection refused errors

#### Solutions

**Solution 1: Use Docker Network Names**
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      # Use service name, not localhost
      DATABASE_URL: postgresql://user:pass@postgres:5432/db
      REDIS_HOST: redis
    networks:
      - app-network

  postgres:
    networks:
      - app-network

  redis:
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**Solution 2: Expose Correct Ports**
```yaml
services:
  backend:
    ports:
      - "5000:5000"  # host:container
    expose:
      - "5000"       # Internal exposure
```

### 3. Production Deployment Failures

#### Symptoms
- Deployment script fails
- Application not accessible after deployment
- SSL certificate errors

#### Pre-deployment Checklist
```bash
#!/bin/bash
# pre-deploy-check.sh

echo "Running pre-deployment checks..."

# Check environment variables
required_vars=(
  "NODE_ENV"
  "DATABASE_URL"
  "REDIS_HOST"
  "JWT_SECRET"
  "GOOGLE_CLIENT_ID"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Missing required variable: $var"
    exit 1
  fi
done

# Test database connection
pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER || exit 1

# Test Redis connection
redis-cli -h $REDIS_HOST ping || exit 1

# Run tests
npm test || exit 1

echo "All checks passed!"
```

#### Solutions

**Solution 1: Zero-Downtime Deployment**
```bash
#!/bin/bash
# deploy.sh

# Build new version
docker build -t employee-backend:new .

# Start new container
docker run -d --name employee-backend-new employee-backend:new

# Wait for health check
timeout 60 bash -c 'until curl -f http://localhost:5001/health; do sleep 1; done'

# Switch traffic (update nginx/load balancer)
ln -sfn /etc/nginx/sites-available/employee-new /etc/nginx/sites-enabled/employee
nginx -s reload

# Stop old container
docker stop employee-backend-old
docker rm employee-backend-old

# Rename new to current
docker rename employee-backend-new employee-backend
```

**Solution 2: Rollback Procedure**
```bash
#!/bin/bash
# rollback.sh

# Tag current version
docker tag employee-backend:latest employee-backend:rollback

# Restore previous version
docker tag employee-backend:previous employee-backend:latest

# Restart services
docker-compose up -d --force-recreate backend

# Verify rollback
curl -f http://localhost:5000/health || echo "Rollback failed!"
```

## Debugging Tools

### 1. Node.js Debugging

#### Using Chrome DevTools
```bash
# Start with inspector
node --inspect dist/server.js

# With break on start
node --inspect-brk dist/server.js

# Open chrome://inspect in Chrome
```

#### Using VS Code
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 2. Database Debugging

#### Query Logging
```javascript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' }
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Duration: ' + e.duration + 'ms');
});
```

#### PostgreSQL Query Analysis
```sql
-- Enable query timing
\timing on

-- Explain query plan
EXPLAIN ANALYZE
SELECT e.*, er.role_id
FROM employees e
LEFT JOIN employee_roles er ON e.id = er.employee_id
WHERE e.department = 'Engineering';

-- View index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### 3. Network Debugging

#### API Request Debugging
```bash
# Verbose curl
curl -v http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# With request/response headers
curl -i http://localhost:5000/api/auth/me

# Trace network timing
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5000/health

# curl-format.txt
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
```

#### WebSocket Debugging
```javascript
// Debug socket connections
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });
});
```

## Emergency Procedures

### 1. Application Crash Recovery

#### Immediate Actions
```bash
#!/bin/bash
# emergency-restart.sh

echo "Emergency restart initiated at $(date)"

# 1. Capture current state
pm2 describe employee-api > crash-report-$(date +%s).log
pm2 logs employee-api --lines 1000 --nostream > crash-logs-$(date +%s).log

# 2. Attempt graceful restart
pm2 restart employee-api

# 3. Check if restart successful
sleep 5
if ! pm2 list | grep -q "online.*employee-api"; then
  echo "Graceful restart failed, forcing restart..."
  pm2 delete employee-api
  pm2 start ecosystem.config.js --env production
fi

# 4. Verify application is responding
if ! curl -f http://localhost:5000/health; then
  echo "Health check failed after restart!"
  # Send alert to team
fi
```

### 2. Database Emergency Recovery

#### Connection Pool Reset
```javascript
// emergency-db-reset.js
const { PrismaClient } = require('@prisma/client');

async function resetDatabaseConnections() {
  console.log('Resetting database connections...');
  
  // Force disconnect all Prisma clients
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  
  // Kill all database connections (run as superuser)
  await prisma.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
  `);
  
  console.log('Database connections reset');
}

resetDatabaseConnections().catch(console.error);
```

### 3. Security Incident Response

#### Immediate Security Lockdown
```bash
#!/bin/bash
# security-lockdown.sh

echo "SECURITY LOCKDOWN INITIATED"

# 1. Block all external traffic except SSH
iptables -P INPUT DROP
iptables -P OUTPUT DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A OUTPUT -p tcp --sport 22 -j ACCEPT

# 2. Revoke all active sessions
redis-cli -a $REDIS_PASSWORD FLUSHDB

# 3. Disable all user accounts except admin
psql -U postgres -d employee_db -c "UPDATE employees SET is_active = false WHERE email != 'admin@company.com';"

# 4. Rotate all secrets
node scripts/rotate-secrets.js

# 5. Enable detailed logging
export DEBUG=*
pm2 restart all

echo "Lockdown complete. Review logs and investigate incident."
```

### 4. Data Recovery

#### Point-in-Time Recovery
```bash
#!/bin/bash
# restore-to-point-in-time.sh

RECOVERY_TIME=$1

if [ -z "$RECOVERY_TIME" ]; then
  echo "Usage: ./restore-to-point-in-time.sh '2025-08-10 14:30:00'"
  exit 1
fi

# 1. Stop application
pm2 stop all

# 2. Create backup of current state
pg_dump -U postgres employee_db > backup-before-recovery-$(date +%s).sql

# 3. Restore to point in time
pg_restore -U postgres -d employee_db_recovery \
  --recovery-target-time="$RECOVERY_TIME" \
  /var/lib/postgresql/backups/latest.dump

# 4. Verify recovery
psql -U postgres -d employee_db_recovery -c "SELECT COUNT(*) FROM employees;"

# 5. Switch databases
psql -U postgres <<EOF
ALTER DATABASE employee_db RENAME TO employee_db_old;
ALTER DATABASE employee_db_recovery RENAME TO employee_db;
EOF

# 6. Restart application
pm2 restart all
```

## Maintenance Scripts

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

check_service() {
  local service=$1
  local url=$2
  
  if curl -sf "$url" > /dev/null; then
    echo "✓ $service is healthy"
    return 0
  else
    echo "✗ $service is unhealthy"
    return 1
  fi
}

echo "Running system health check..."
echo "================================"

# Check services
check_service "API" "http://localhost:5000/health"
check_service "Frontend" "http://localhost:3000"
check_service "PostgreSQL" "http://localhost:5432" || pg_isready
check_service "Redis" "http://localhost:6379" || redis-cli ping

# Check disk space
echo ""
echo "Disk Usage:"
df -h | grep -E '^/dev/'

# Check memory
echo ""
echo "Memory Usage:"
free -h

# Check process status
echo ""
echo "Process Status:"
pm2 list

# Check logs for errors
echo ""
echo "Recent Errors:"
grep -i error /home/deploy/apps/employee-system/logs/*.log | tail -10
```

### Cleanup Script
```bash
#!/bin/bash
# cleanup.sh

echo "Running cleanup tasks..."

# Clean old logs
find /home/deploy/apps/employee-system/logs -name "*.log" -mtime +30 -delete

# Clean old backups
find /home/deploy/apps/employee-system/backups -name "*.gz" -mtime +7 -delete

# Clean Docker resources
docker system prune -af --volumes

# Clean npm cache
npm cache clean --force

# Clean Prisma generate files
rm -rf node_modules/.prisma

# Vacuum PostgreSQL
psql -U postgres -d employee_db -c "VACUUM ANALYZE;"

# Clean Redis expired keys
redis-cli -a $REDIS_PASSWORD --scan --pattern "*" | xargs -L 1000 redis-cli -a $REDIS_PASSWORD DEL

echo "Cleanup completed"
```

---

Document Version: 1.0.0  
Last Updated: 2025-08-10  
Support Contact: support@company.com  
Emergency Contact: oncall@company.com