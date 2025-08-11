# Contributing to Google Auth Redis System

Thank you for your interest in contributing to the Google Auth Redis System! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Security](#security)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept responsibility for mistakes
- Prioritize the community's best interests

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0+
- PostgreSQL 15+
- Redis 7.0+
- Docker and Docker Compose
- Git

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/google-auth-redis-system.git
   cd google-auth-redis-system
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/KEIEI-NET/google-auth-redis-system.git
   ```

4. **Install dependencies**
   ```bash
   npm run install:all
   ```

5. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   # Edit the .env files with your configuration
   ```

6. **Start development environment**
   ```bash
   docker-compose up -d
   npm run dev
   ```

## 💻 Development Process

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-oauth-provider`)
- `fix/` - Bug fixes (e.g., `fix/session-timeout`)
- `docs/` - Documentation updates (e.g., `docs/update-api-spec`)
- `refactor/` - Code refactoring (e.g., `refactor/optimize-redis-calls`)
- `test/` - Test additions or fixes (e.g., `test/add-session-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Development Workflow

1. **Create a new branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `security`: Security improvements

**Examples:**
```bash
feat(auth): add Microsoft OAuth provider
fix(redis): handle connection timeout gracefully
docs(api): update authentication endpoints
test(session): add fallback mechanism tests
```

## 🔄 Pull Request Process

1. **Update your fork**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Go to GitHub and click "New Pull Request"
   - Choose your branch and main branch
   - Fill in the PR template
   - Link related issues

### PR Template

```markdown
## Description
Brief description of the changes

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
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No security vulnerabilities introduced
```

## 📝 Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Avoid `any` type - use proper typing
- Use async/await instead of callbacks
- Handle errors properly with try/catch
- Use meaningful variable and function names

```typescript
// Good
async function getEmployeePermissions(employeeId: number): Promise<Permission[]> {
  try {
    const cached = await CacheService.getEmployeePermissions(employeeId);
    if (cached) return cached;
    
    const permissions = await prisma.permission.findMany({
      where: { employeeId }
    });
    
    await CacheService.setEmployeePermissions(employeeId, permissions);
    return permissions;
  } catch (error) {
    logger.error('Failed to get permissions:', error);
    throw new AppError('Permission fetch failed', 500);
  }
}

// Bad
function getPerms(id) {
  return prisma.permission.findMany({ where: { employeeId: id } });
}
```

### React Components

- Use functional components with hooks
- Use TypeScript interfaces for props
- Keep components small and focused
- Use proper error boundaries

```tsx
// Good
interface DashboardProps {
  user: User;
  permissions: Permission[];
}

export const Dashboard: React.FC<DashboardProps> = ({ user, permissions }) => {
  const [loading, setLoading] = useState(false);
  
  // Component logic
  
  return (
    <ErrorBoundary>
      {/* Component JSX */}
    </ErrorBoundary>
  );
};
```

### File Organization

```
src/
├── components/       # React components
│   └── ComponentName/
│       ├── index.tsx
│       ├── ComponentName.tsx
│       ├── ComponentName.test.tsx
│       └── ComponentName.styles.ts
├── services/        # Business logic
├── utils/          # Utility functions
├── types/          # TypeScript types
└── __tests__/      # Test files
```

## 🧪 Testing Guidelines

### Test Coverage Requirements

- Minimum 80% code coverage
- All new features must have tests
- Critical paths require integration tests

### Writing Tests

```typescript
// Unit Test Example
describe('RedisManager', () => {
  let manager: RedisManager;
  
  beforeEach(() => {
    manager = RedisManager.getInstance();
  });
  
  describe('connect', () => {
    it('should establish connection successfully', async () => {
      await expect(manager.connect()).resolves.not.toThrow();
      expect(manager.isHealthy()).toBe(true);
    });
    
    it('should handle connection failures', async () => {
      // Test implementation
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- RedisManager.test.ts

# Run in watch mode
npm run test:watch
```

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Include parameter descriptions
- Provide usage examples

```typescript
/**
 * Creates a new session for the authenticated user
 * @param sessionId - Unique session identifier
 * @param employeeId - Employee database ID
 * @param ipAddress - Client IP address for validation
 * @param userAgent - Client user agent for validation
 * @returns Promise that resolves when session is created
 * @throws {AppError} When session creation fails
 * @example
 * await SessionService.createSession('abc123', 1, '192.168.1.1', 'Mozilla/5.0');
 */
```

### README Updates

Update README.md when:
- Adding new features
- Changing configuration
- Modifying API endpoints
- Updating dependencies

## 🔒 Security

### Security Guidelines

1. **Never commit secrets**
   - Use environment variables
   - Add sensitive files to .gitignore
   - Use git-secrets or similar tools

2. **Validate all inputs**
   ```typescript
   // Use validation libraries
   const schema = z.object({
     email: z.string().email(),
     role: z.enum(['ADMIN', 'USER'])
   });
   ```

3. **Handle authentication properly**
   - Use httpOnly cookies for tokens
   - Implement CSRF protection
   - Add rate limiting

4. **Report vulnerabilities**
   - Don't create public issues for security problems
   - Email security concerns to maintainers
   - Include steps to reproduce

### Security Checklist

Before submitting PR:
- [ ] No hardcoded secrets
- [ ] Input validation added
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens implemented
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive info

## 🎯 Areas for Contribution

### High Priority

- [ ] Add more OAuth providers (Microsoft, GitHub)
- [ ] Implement role-based UI components
- [ ] Add more comprehensive E2E tests
- [ ] Improve error handling and recovery
- [ ] Add performance monitoring

### Good First Issues

- [ ] Improve documentation
- [ ] Add more unit tests
- [ ] Fix typos and formatting
- [ ] Add code comments
- [ ] Improve error messages

### Feature Requests

Check our [Issues](https://github.com/KEIEI-NET/google-auth-redis-system/issues) page for feature requests and enhancements.

## 📮 Getting Help

- **Discord**: [Join our Discord](https://discord.gg/example)
- **Issues**: [GitHub Issues](https://github.com/KEIEI-NET/google-auth-redis-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KEIEI-NET/google-auth-redis-system/discussions)

## 🏆 Recognition

Contributors will be:
- Listed in our [Contributors](#) section
- Mentioned in release notes
- Given credit in documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Google Auth Redis System! 🎉