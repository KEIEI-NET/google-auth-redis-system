# Development Guide - Google Auth Employee System

## Table of Contents
1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Style Guidelines](#code-style-guidelines)
4. [Development Workflow](#development-workflow)
5. [Testing Strategy](#testing-strategy)
6. [Debugging Guide](#debugging-guide)
7. [Performance Optimization](#performance-optimization)
8. [Contributing Guidelines](#contributing-guidelines)
9. [Best Practices](#best-practices)
10. [Common Issues & Solutions](#common-issues--solutions)

## Getting Started

### Current System Status (2025-08-11)
✅ **Operational**: System is running with development workarounds
- Docker containers: Running (PostgreSQL, Redis)
- Backend API: http://localhost:5000 
- Frontend: http://localhost:3000
- Google OAuth: Working via `/api/auth/google/dev` endpoint

⚠️ **Known Issues**:
- Prisma authentication issue (using dev workaround)
- Security vulnerabilities identified (12 total)
- No test coverage yet

### Prerequisites

Ensure you have the following installed:
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker**: v24.0.0 or higher
- **Docker Compose**: v2.20.0 or higher
- **Git**: v2.40.0 or higher
- **PostgreSQL Client**: v15 or higher (optional, for direct DB access)
- **Redis Client**: v7 or higher (optional, for direct cache access)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/google-auth-employee-system.git
cd google-auth-employee-system

# Install dependencies
npm run install:all

# Set up environment variables
cp .env.example .env.development
# Edit .env.development with your configuration

# Start Docker services (PostgreSQL & Redis)
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:setup

# Seed the database with test data
npm run db:seed

# Start development servers
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

## Development Setup

### Environment Configuration

#### 1. Create Environment Files

```bash
# Development environment
.env.development

# Test environment
.env.test

# Local overrides (gitignored)
.env.local
```

#### 2. Essential Environment Variables

```bash
# .env.development
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/employee_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# JWT Secrets (Generate with: openssl rand -base64 32)
JWT_SECRET=development_jwt_secret_change_in_production
JWT_REFRESH_SECRET=development_refresh_secret_change_in_production

# Security (Relaxed for development)
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_ENABLED=false
SECURE_COOKIES=false

# Logging
LOG_LEVEL=debug
```

### Docker Development Environment

#### 1. Docker Compose Configuration

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: employee_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_dev_data:
  redis_dev_data:
```

#### 2. Database Management

```bash
# Start database
docker-compose -f docker-compose.dev.yml up -d postgres

# Access PostgreSQL CLI
docker exec -it employee-system-postgres psql -U postgres -d employee_dev

# Access pgAdmin
# Open browser: http://localhost:5050
# Login: admin@example.com / admin

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

### IDE Configuration

#### VS Code Settings

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true,
    "**/coverage": true
  }
}
```

#### Recommended Extensions

`.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "wayou.vscode-todo-highlight",
    "gruntfuggly.todo-tree",
    "eamodio.gitlens",
    "usernamehw.errorlens",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### Git Configuration

#### Git Hooks with Husky

```bash
# Install Husky
npm install -D husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"

# Add commit-msg hook
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

#### `.lintstagedrc.json`:

```json
{
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.prisma": [
    "prisma format"
  ]
}
```

## Code Style Guidelines

### TypeScript Guidelines

#### 1. Type Definitions

```typescript
// ✅ Good - Explicit types
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

// ❌ Bad - Using any
const processUser = (user: any) => {
  // ...
};

// ✅ Good - Proper typing
const processUser = (user: User): ProcessedUser => {
  // ...
};
```

#### 2. Async/Await Pattern

```typescript
// ✅ Good - Async/await with proper error handling
async function fetchUser(id: string): Promise<User> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true }
    });
    
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    
    return user;
  } catch (error) {
    logger.error('Failed to fetch user', { id, error });
    throw error;
  }
}

// ❌ Bad - Callback hell
function fetchUser(id: string, callback: Function) {
  prisma.user.findUnique({ where: { id } })
    .then(user => {
      if (!user) {
        callback(new Error('Not found'));
      } else {
        callback(null, user);
      }
    })
    .catch(callback);
}
```

#### 3. Error Handling

```typescript
// Custom error classes
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

// Usage
if (!isValidEmail(email)) {
  throw new ValidationError('Invalid email format', { email });
}
```

### React/Frontend Guidelines

#### 1. Component Structure

```typescript
// ✅ Good - Functional component with proper typing
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  className
}) => {
  const { hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    
    setIsLoading(true);
    try {
      await onDelete(user.id);
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id, onDelete]);

  return (
    <Card className={className}>
      <CardContent>
        <Typography variant="h6">
          {user.firstName} {user.lastName}
        </Typography>
        <Typography color="textSecondary">
          {user.email}
        </Typography>
      </CardContent>
      {hasPermission('users:delete') && (
        <CardActions>
          <Button 
            onClick={handleDelete}
            disabled={isLoading}
            color="error"
          >
            Delete
          </Button>
        </CardActions>
      )}
    </Card>
  );
};
```

#### 2. Custom Hooks

```typescript
// ✅ Good - Custom hook with proper error handling
export function useApi<T>(url: string, options?: RequestOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get<T>(url, {
          ...options,
          signal: controller.signal
        });
        
        setData(response.data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err as Error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}
```

### Backend Guidelines

#### 1. Controller Pattern

```typescript
// ✅ Good - Clean controller with validation
export class EmployeeController {
  static async getEmployees(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page = 1, limit = 20, department } = req.query;
      
      const employees = await EmployeeService.findAll({
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        department: department as string
      });

      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      next(error);
    }
  }
}
```

#### 2. Service Layer

```typescript
// ✅ Good - Service layer with business logic
export class EmployeeService {
  static async findAll(options: FindAllOptions): Promise<PaginatedResult<Employee>> {
    const { page, limit, department } = options;
    const offset = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      status: 'active',
      ...(department && { department })
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          roles: {
            include: {
              role: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.employee.count({ where })
    ]);

    return {
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
```

#### 3. Middleware Pattern

```typescript
// ✅ Good - Reusable middleware
export const validateRequest = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.reduce((acc, detail) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {} as Record<string, string>);

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      });
    }

    req.body = value;
    next();
  };
};
```

## Development Workflow

### Branch Strategy

```bash
main
├── develop
│   ├── feature/user-management
│   ├── feature/oauth-integration
│   └── feature/admin-panel
├── release/v1.0.0
└── hotfix/security-patch
```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <subject>

# Examples
feat(auth): add Google OAuth integration
fix(api): resolve rate limiting issue
docs(readme): update installation instructions
style(frontend): format code with prettier
refactor(backend): extract validation logic
test(auth): add integration tests
chore(deps): update dependencies
perf(db): add database indexes
```

### Pull Request Process

#### 1. Create Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

#### 2. Make Changes

```bash
# Make your changes
git add .
git commit -m "feat(scope): description"

# Keep branch updated
git fetch origin
git rebase origin/develop
```

#### 3. Run Tests

```bash
# Run all tests
npm test

# Run specific tests
npm run test:unit
npm run test:integration
npm run test:e2e

# Check coverage
npm run test:coverage
```

#### 4. Create Pull Request

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

## Testing Strategy

### Test Structure

```
tests/
├── unit/               # Unit tests
│   ├── services/
│   ├── utils/
│   └── middleware/
├── integration/        # Integration tests
│   ├── api/
│   ├── database/
│   └── auth/
├── e2e/               # End-to-end tests
│   ├── auth.spec.ts
│   ├── employee.spec.ts
│   └── admin.spec.ts
└── fixtures/          # Test data
    ├── users.json
    └── mockData.ts
```

### Unit Testing

```typescript
// Example unit test
describe('JWTService', () => {
  describe('generateAccessToken', () => {
    it('should generate valid JWT token', () => {
      const user = { id: '123', email: 'test@example.com' };
      const token = JWTService.generateAccessToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
    });

    it('should include expiration time', () => {
      const token = JWTService.generateAccessToken({ id: '123' });
      const decoded = jwt.decode(token) as any;
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });
});
```

### Integration Testing

```typescript
// Example integration test
describe('POST /api/auth/google/callback', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should authenticate user with valid code', async () => {
    // Mock Google OAuth response
    nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, {
        access_token: 'mock_access_token',
        id_token: 'mock_id_token'
      });

    const response = await request(app)
      .post('/api/auth/google/callback')
      .send({
        code: 'valid_code',
        state: 'valid_state',
        codeVerifier: 'valid_verifier'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.user).toBeDefined();
  });
});
```

### E2E Testing

```typescript
// Example E2E test with Cypress
describe('Employee Management', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password');
    cy.visit('/employees');
  });

  it('should display employee list', () => {
    cy.get('[data-testid="employee-list"]').should('be.visible');
    cy.get('[data-testid="employee-card"]').should('have.length.at.least', 1);
  });

  it('should create new employee', () => {
    cy.get('[data-testid="add-employee-btn"]').click();
    
    cy.get('input[name="email"]').type('new.employee@example.com');
    cy.get('input[name="firstName"]').type('John');
    cy.get('input[name="lastName"]').type('Doe');
    cy.get('select[name="department"]').select('Engineering');
    
    cy.get('button[type="submit"]').click();
    
    cy.get('[data-testid="success-message"]').should('be.visible');
    cy.url().should('include', '/employees');
  });
});
```

## Debugging Guide

### Backend Debugging

#### 1. VS Code Debug Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/src/server.ts",
      "preLaunchTask": "tsc: build - backend/tsconfig.json",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      }
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Process",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### 2. Debug with Chrome DevTools

```bash
# Start with inspect flag
node --inspect=9229 backend/dist/server.js

# Or with nodemon
nodemon --inspect=9229 backend/dist/server.js

# Open Chrome
chrome://inspect
```

#### 3. Logging Strategy

```typescript
// Structured logging with Winston
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'employee-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Usage
logger.info('User logged in', { userId: user.id, ip: req.ip });
logger.error('Database connection failed', { error });
```

### Frontend Debugging

#### 1. React Developer Tools

```javascript
// Enable React DevTools Profiler
if (process.env.NODE_ENV === 'development') {
  import('react-devtools').then(devtools => {
    // DevTools loaded
  });
}
```

#### 2. Redux DevTools (if using Redux)

```typescript
const store = createStore(
  rootReducer,
  composeWithDevTools(
    applyMiddleware(thunk, logger)
  )
);
```

#### 3. Network Debugging

```typescript
// Axios interceptors for debugging
axios.interceptors.request.use(request => {
  console.log('Starting Request:', request);
  return request;
});

axios.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('Error:', error.response);
    return Promise.reject(error);
  }
);
```

## Performance Optimization

### Frontend Optimization

#### 1. Code Splitting

```typescript
// Lazy load components
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// Use Suspense
<Suspense fallback={<Loading />}>
  <AdminPanel />
</Suspense>
```

#### 2. Memoization

```typescript
// Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// Memoize components
const MemoizedComponent = memo(ExpensiveComponent);
```

#### 3. Virtual Scrolling

```typescript
// Use react-window for large lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={employees.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <EmployeeRow style={style} employee={employees[index]} />
  )}
</FixedSizeList>
```

### Backend Optimization

#### 1. Database Query Optimization

```typescript
// Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true
  }
});

// Use pagination
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit
});

// Use indexes
// schema.prisma
model User {
  id    String @id
  email String @unique
  
  @@index([email, status])
}
```

#### 2. Caching Strategy

```typescript
// Redis caching
class CacheService {
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, data);
    } else {
      await this.redis.set(key, data);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
```

#### 3. Connection Pooling

```typescript
// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection pool
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});
```

## Contributing Guidelines

### Code Review Checklist

- [ ] **Functionality**
  - Does the code do what it's supposed to do?
  - Are edge cases handled?
  - Is error handling appropriate?

- [ ] **Code Quality**
  - Is the code readable and self-documenting?
  - Are functions and variables named appropriately?
  - Is the code DRY (Don't Repeat Yourself)?

- [ ] **Testing**
  - Are there adequate tests?
  - Do tests cover edge cases?
  - Are tests maintainable?

- [ ] **Performance**
  - Are there any obvious performance issues?
  - Is pagination implemented for large datasets?
  - Are database queries optimized?

- [ ] **Security**
  - Is user input validated and sanitized?
  - Are authentication and authorization properly implemented?
  - Are sensitive data properly protected?

- [ ] **Documentation**
  - Is the code well-commented?
  - Is API documentation updated?
  - Are breaking changes documented?

### Documentation Standards

#### 1. Code Comments

```typescript
/**
 * Authenticates a user with Google OAuth 2.0
 * 
 * @param code - Authorization code from Google
 * @param state - CSRF protection state
 * @param codeVerifier - PKCE code verifier
 * @returns User object with tokens
 * @throws {ValidationError} If parameters are invalid
 * @throws {AuthenticationError} If authentication fails
 */
async function authenticateWithGoogle(
  code: string,
  state: string,
  codeVerifier: string
): Promise<AuthResponse> {
  // Validate state to prevent CSRF attacks
  if (!await validateState(state)) {
    throw new ValidationError('Invalid state parameter');
  }
  
  // Exchange code for tokens...
}
```

#### 2. API Documentation

```typescript
/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get list of employees
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of employees
 *       401:
 *         description: Unauthorized
 */
```

## Best Practices

### Security Best Practices

1. **Never commit secrets**
```bash
# Use environment variables
const apiKey = process.env.API_KEY;

# Not hardcoded
const apiKey = "sk-1234567890";
```

2. **Validate all inputs**
```typescript
const schema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});
```

3. **Use parameterized queries**
```typescript
// Good
const user = await prisma.user.findUnique({
  where: { email }
});

// Bad - SQL injection risk
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### Performance Best Practices

1. **Optimize bundle size**
```typescript
// Tree-shaking friendly imports
import { debounce } from 'lodash-es';

// Not entire library
import _ from 'lodash';
```

2. **Lazy load routes**
```typescript
const routes = [
  {
    path: '/admin',
    component: lazy(() => import('./pages/Admin'))
  }
];
```

3. **Use database indexes**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_created ON users(status, created_at);
```

### Code Organization Best Practices

1. **Single Responsibility Principle**
```typescript
// Each class/function should have one reason to change
class UserService {
  // Only handles user-related business logic
}

class EmailService {
  // Only handles email sending
}
```

2. **Dependency Injection**
```typescript
class UserController {
  constructor(
    private userService: UserService,
    private emailService: EmailService
  ) {}
}
```

3. **Error Boundaries**
```tsx
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

## Common Issues & Solutions

### Current Known Issues (2025-08-11)

#### Prisma Authentication Error
**Problem**: DATABASE_URL authentication fails with special characters
**Current Workaround**: Use development endpoint `/api/auth/google/dev`
**Permanent Fix**:
```typescript
// Properly encode special characters
const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD);
const DATABASE_URL = `postgresql://user:${encodedPassword}@host:5432/db`;
```

#### Security Vulnerabilities
**Problem**: 12 vulnerabilities identified (4 CRITICAL, 6 HIGH, 2 MEDIUM)
**Action Required**: See `/docs/security-reports/2025-08-11-security-analysis-results.md`
**Priority**: Fix CRITICAL issues first

### Issue 1: Docker Container Won't Start

**Problem**: PostgreSQL container fails to initialize

**Solution**:
```bash
# Remove old volumes
docker-compose down -v

# Rebuild and start
docker-compose up --build -d

# Check logs
docker-compose logs postgres
```

### Issue 2: Prisma Migration Errors

**Problem**: Migration fails with "database does not exist"

**Solution**:
```bash
# Create database manually
docker exec -it postgres_container psql -U postgres
CREATE DATABASE employee_dev;

# Run migrations
npx prisma migrate dev
```

### Issue 3: Authentication Failures

**Problem**: Google OAuth callback fails

**Solution**:
1. Verify redirect URI in Google Console matches exactly
2. Check client ID and secret are correct
3. Ensure cookies are enabled
4. Check CORS configuration

### Issue 4: TypeScript Compilation Errors

**Problem**: Type errors in node_modules

**Solution**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### Issue 5: Memory Leaks

**Problem**: Node.js process memory keeps growing

**Solution**:
```bash
# Profile memory usage
node --inspect --max-old-space-size=4096 dist/server.js

# Use Chrome DevTools Memory Profiler
chrome://inspect
```

### Issue 6: Slow Database Queries

**Problem**: API responses are slow

**Solution**:
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM employees WHERE department = 'Engineering';

-- Add appropriate indexes
CREATE INDEX idx_employees_department ON employees(department);

-- Update statistics
ANALYZE employees;
```

## Sub-Agent Execution Results (2025-08-11)

Three specialized sub-agents were executed to analyze the system:

### 1. Security Analysis Sub-Agent
- **Result**: Found 12 vulnerabilities (4 CRITICAL, 6 HIGH, 2 MEDIUM)
- **Score**: 6.5/10 (needs improvement to 9.0/10)
- **Details**: `/docs/security-reports/2025-08-11-security-analysis-results.md`

### 2. Debug Sub-Agent
- **Result**: System operational with workarounds
- **Key Fix**: Development OAuth endpoint created
- **Status**: All services running

### 3. Code Review Sub-Agent
- **Result**: 7.5/10 overall score
- **Strengths**: Good architecture, TypeScript usage
- **Weaknesses**: No tests, security issues

For complete details, see `/docs/implementation-logs/2025-08-11-subagent-execution-summary.md`

---

*Last Updated: 2025-08-11 20:00*
*Version: 1.1.0*
*Development Guide Version: Production-Ready with Security Analysis*