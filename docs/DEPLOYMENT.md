# Deployment Guide - Google Auth Employee System

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Deployment Methods](#deployment-methods)
5. [Production Configuration](#production-configuration)
6. [Database Setup](#database-setup)
7. [Security Hardening](#security-hardening)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)
11. [Rollback Procedures](#rollback-procedures)

## Overview

This guide provides comprehensive instructions for deploying the Google Auth Employee System to production environments. It covers multiple deployment methods, security configurations, and operational procedures.

### Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cloudflare │────▶│Load Balancer│────▶│  Web Tier   │
│     (CDN)    │     │   (Nginx)   │     │  (3 nodes)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                         ┌──────▼──────┐
                                         │  App Tier   │
                                         │  (3 nodes)  │
                                         └─────────────┘
                                                │
                                   ┌────────────┼────────────┐
                                   │            │            │
                            ┌──────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
                            │ PostgreSQL  │ │Redis │ │   S3/Blob   │
                            │  (Primary)  │ │Cluster│ │   Storage   │
                            └─────────────┘ └──────┘ └─────────────┘
                                   │
                            ┌──────▼──────┐
                            │ PostgreSQL  │
                            │  (Replica)  │
                            └─────────────┘
```

## Prerequisites

### System Requirements

#### Minimum Production Requirements
- **CPU**: 4 cores (8 recommended)
- **RAM**: 8 GB (16 GB recommended)
- **Storage**: 100 GB SSD
- **OS**: Ubuntu 22.04 LTS or RHEL 8+
- **Network**: 1 Gbps connection

#### Software Dependencies
```bash
# Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql-15

# Redis 7
sudo apt-get install redis-server

# Nginx
sudo apt-get install nginx

# Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# PM2 (Process Manager)
npm install -g pm2
```

### Google Cloud Setup

1. **Create OAuth 2.0 Credentials**
```bash
# Navigate to Google Cloud Console
# APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID

# Configure OAuth consent screen
# Add authorized redirect URIs:
# - https://your-domain.com/api/auth/google/callback
# - https://staging.your-domain.com/api/auth/google/callback
```

2. **Download Client Secret**
```bash
# Save as client_secret.json
# Store securely - never commit to version control
```

## Environment Setup

### Production Environment Variables

Create `.env.production`:

```bash
# Application
NODE_ENV=production
PORT=5000
APP_NAME="Employee Management System"
APP_URL=https://api.your-domain.com
FRONTEND_URL=https://app.your-domain.com

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/employee_db?schema=public&sslmode=require"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=your_redis_password
REDIS_TLS=true

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://api.your-domain.com/api/auth/google/callback

# JWT Secrets (Generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Security
SESSION_SECRET=your_session_secret
CORS_ORIGIN=https://app.your-domain.com
RATE_LIMIT_ENABLED=true
AUDIT_LOG_ENABLED=true

# Monitoring
LOG_LEVEL=error
SENTRY_DSN=https://xxxx@sentry.io/yyyy
NEW_RELIC_LICENSE_KEY=your_new_relic_key

# Email (for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
EMAIL_FROM=noreply@your-domain.com
```

### Generate Secure Secrets

```bash
#!/bin/bash
# generate-secrets.sh

echo "Generating secure secrets..."

# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)

# Generate database password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

cat << EOF > .env.secrets
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
SESSION_SECRET=$SESSION_SECRET
DB_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
EOF

echo "Secrets generated in .env.secrets"
echo "Remember to:"
echo "1. Store these securely"
echo "2. Never commit to version control"
echo "3. Rotate regularly"
```

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Build Docker Images

```bash
# Build backend image
docker build -f docker/Dockerfile.backend -t employee-api:latest .

# Build frontend image
docker build -f docker/Dockerfile.frontend -t employee-app:latest .
```

#### 2. Docker Compose Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/build:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    image: employee-api:latest
    env_file:
      - .env.production
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
      - db-network

  postgres:
    image: postgres:15-alpine
    env_file:
      - .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    networks:
      - db-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - db-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  app-network:
    driver: bridge
  db-network:
    driver: bridge
    internal: true
```

#### 3. Deploy with Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml employee-system

# Scale services
docker service scale employee-system_backend=3

# Monitor services
docker service ls
docker service logs employee-system_backend
```

### Method 2: PM2 Deployment

#### 1. Build Application

```bash
# Clone repository
git clone https://github.com/your-org/employee-system.git
cd employee-system

# Install dependencies
npm run install:all

# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

#### 2. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'employee-api',
      script: './backend/dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
    }
  ]
};
```

#### 3. Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup systemd

# Monitor
pm2 monit
```

### Method 3: Kubernetes Deployment

#### 1. Create Kubernetes Manifests

`k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: employee-api
  labels:
    app: employee-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: employee-api
  template:
    metadata:
      labels:
        app: employee-api
    spec:
      containers:
      - name: api
        image: your-registry/employee-api:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: employee-api-secrets
        - configMapRef:
            name: employee-api-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: employee-api-service
spec:
  selector:
    app: employee-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 5000
  type: LoadBalancer
```

#### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace employee-system

# Create secrets
kubectl create secret generic employee-api-secrets \
  --from-env-file=.env.production \
  -n employee-system

# Apply manifests
kubectl apply -f k8s/ -n employee-system

# Check deployment
kubectl get pods -n employee-system
kubectl get services -n employee-system

# Scale deployment
kubectl scale deployment employee-api --replicas=5 -n employee-system
```

## Production Configuration

### Nginx Configuration

`/etc/nginx/sites-available/employee-api`:

```nginx
upstream backend {
    least_conn;
    server localhost:5001 max_fails=3 fail_timeout=30s;
    server localhost:5002 max_fails=3 fail_timeout=30s;
    server localhost:5003 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Proxy Configuration
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Health Check Endpoint
    location /health {
        access_log off;
        proxy_pass http://backend/health;
    }

    # Static Files (if serving frontend)
    location / {
        root /var/www/employee-app;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logging
    access_log /var/log/nginx/api-access.log combined;
    error_log /var/log/nginx/api-error.log error;
}
```

### Database Optimization

#### PostgreSQL Configuration

`/etc/postgresql/15/main/postgresql.conf`:

```ini
# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Memory Settings
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 20MB

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1

# Logging
log_min_duration_statement = 100
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s

# SSL
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

#### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employee_roles_composite ON employee_roles(employee_id, role_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);

-- Partial indexes for common queries
CREATE INDEX idx_active_employees ON employees(email) WHERE status = 'active';
CREATE INDEX idx_recent_logins ON audit_logs(user_id, timestamp) 
  WHERE action = 'AUTH_SUCCESS' AND timestamp > NOW() - INTERVAL '30 days';

-- Full-text search index
CREATE INDEX idx_employees_search ON employees 
  USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));
```

### Redis Configuration

`/etc/redis/redis.conf`:

```ini
# Network
bind 127.0.0.1 ::1
protected-mode yes
port 6379

# Security
requirepass your_redis_password

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# Limits
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru

# Append Only File
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128
```

## Security Hardening

### System Security

#### 1. Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw allow from 10.0.0.0/8 to any port 5432  # PostgreSQL (internal)
sudo ufw allow from 10.0.0.0/8 to any port 6379  # Redis (internal)
sudo ufw enable
```

#### 2. SSH Hardening

`/etc/ssh/sshd_config`:

```bash
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowUsers deploy admin
```

#### 3. System Limits

`/etc/security/limits.conf`:

```bash
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
```

### Application Security

#### 1. Create Non-Root User

```bash
# Create application user
sudo useradd -m -s /bin/bash appuser
sudo usermod -aG sudo appuser

# Set permissions
sudo chown -R appuser:appuser /opt/employee-system
sudo chmod 750 /opt/employee-system
```

#### 2. Secure File Permissions

```bash
# Application files
find /opt/employee-system -type f -exec chmod 644 {} \;
find /opt/employee-system -type d -exec chmod 755 {} \;

# Sensitive files
chmod 600 /opt/employee-system/.env.production
chmod 600 /opt/employee-system/client_secret.json

# Logs
chmod 750 /var/log/employee-system
```

#### 3. SELinux/AppArmor

```bash
# SELinux (RHEL/CentOS)
sudo semanage port -a -t http_port_t -p tcp 5000
sudo setsebool -P httpd_can_network_connect 1

# AppArmor (Ubuntu)
sudo aa-enforce /etc/apparmor.d/usr.bin.node
```

## Monitoring & Logging

### Application Monitoring

#### 1. Health Check Endpoints

```typescript
// backend/src/routes/health.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabaseHealth(),
    redis: await checkRedisHealth()
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get('/ready', async (req, res) => {
  const ready = await isApplicationReady();
  res.status(ready ? 200 : 503).json({ ready });
});
```

#### 2. Prometheus Metrics

```typescript
// backend/src/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

#### 3. Application Performance Monitoring (APM)

```javascript
// New Relic configuration
require('newrelic');

// Or Datadog
const tracer = require('dd-trace').init({
  service: 'employee-api',
  env: 'production',
  version: process.env.APP_VERSION
});
```

### Log Management

#### 1. Centralized Logging

```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/employee-system/*.log
  multiline.pattern: '^\d{4}-\d{2}-\d{2}'
  multiline.negate: true
  multiline.match: after

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "employee-system-%{+yyyy.MM.dd}"
```

#### 2. Log Rotation

```bash
# /etc/logrotate.d/employee-system
/var/log/employee-system/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 appuser appuser
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Alerting

#### 1. Alert Rules (Prometheus)

```yaml
groups:
  - name: employee-system
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate detected

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Database is down

      - alert: HighMemoryUsage
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High memory usage detected
```

## Backup & Recovery

### Backup Strategy

#### 1. Database Backup

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backup/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="employee_db"

# Create backup
pg_dump -h localhost -U postgres -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz s3://your-backup-bucket/postgres/

# Keep only last 30 days locally
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup successful: backup_$TIMESTAMP.sql.gz"
else
    echo "Backup failed!" | mail -s "Database Backup Failed" admin@example.com
fi
```

#### 2. Application Backup

```bash
#!/bin/bash
# backup-application.sh

BACKUP_DIR="/backup/application"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/employee-system"

# Create tarball
tar -czf $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz \
    --exclude=$APP_DIR/node_modules \
    --exclude=$APP_DIR/logs \
    $APP_DIR

# Upload to S3
aws s3 cp $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz s3://your-backup-bucket/application/

# Keep only last 7 days locally
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

#### 3. Automated Backup Schedule

```bash
# Crontab entries
0 2 * * * /opt/scripts/backup-database.sh
0 3 * * * /opt/scripts/backup-application.sh
0 4 * * 0 /opt/scripts/backup-full-system.sh  # Weekly full backup
```

### Recovery Procedures

#### 1. Database Recovery

```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1
DB_NAME="employee_db"

# Stop application
pm2 stop all

# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -U postgres -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
gunzip < $BACKUP_FILE | psql -U postgres -d $DB_NAME

# Run migrations
cd /opt/employee-system/backend
npx prisma migrate deploy

# Restart application
pm2 start all

echo "Database restored from $BACKUP_FILE"
```

#### 2. Point-in-Time Recovery

```sql
-- PostgreSQL PITR configuration
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'

-- Recovery procedure
-- 1. Stop PostgreSQL
-- 2. Restore base backup
-- 3. Create recovery.conf
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2025-08-10 14:30:00'
recovery_target_action = 'promote'

-- 4. Start PostgreSQL
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs employee-api --lines 100
journalctl -u employee-api -n 100

# Verify environment variables
node -e "console.log(process.env)" | grep -E "(DATABASE|REDIS|GOOGLE)"

# Test database connection
psql -h localhost -U postgres -d employee_db -c "SELECT 1;"

# Test Redis connection
redis-cli -a $REDIS_PASSWORD ping

# Check port availability
sudo netstat -tlpn | grep 5000
```

#### 2. Authentication Failures

```bash
# Check Google OAuth configuration
curl https://accounts.google.com/.well-known/openid-configuration

# Verify redirect URI
echo $GOOGLE_REDIRECT_URI

# Check JWT keys
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({test: 1}, process.env.JWT_SECRET));"

# Review auth logs
grep "AUTH_" /var/log/employee-system/app.log | tail -50
```

#### 3. Performance Issues

```bash
# Check system resources
top -b -n 1
free -h
df -h

# Database slow queries
psql -U postgres -d employee_db -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Redis memory usage
redis-cli -a $REDIS_PASSWORD INFO memory

# Application memory
pm2 monit

# Network latency
ping -c 10 database_host
```

#### 4. Database Connection Pool Exhaustion

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- View connection details
SELECT pid, usename, application_name, client_addr, state, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND query_start < NOW() - INTERVAL '5 minutes';
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=*
export LOG_LEVEL=debug

# Start with verbose output
node --trace-warnings backend/dist/server.js

# Enable SQL logging
export DATABASE_LOG=true

# Profile application
node --prof backend/dist/server.js
# Process profile
node --prof-process isolate-*.log > profile.txt
```

## Rollback Procedures

### Application Rollback

```bash
#!/bin/bash
# rollback-application.sh

PREVIOUS_VERSION=$1

# Stop current version
pm2 stop all

# Backup current state
tar -czf /backup/rollback_$(date +%Y%m%d_%H%M%S).tar.gz /opt/employee-system

# Checkout previous version
cd /opt/employee-system
git fetch --all
git checkout $PREVIOUS_VERSION

# Install dependencies
npm run install:all

# Build application
npm run build

# Run database migrations (if needed)
cd backend
npx prisma migrate deploy

# Start application
pm2 start ecosystem.config.js --env production

echo "Rolled back to version $PREVIOUS_VERSION"
```

### Database Rollback

```bash
#!/bin/bash
# rollback-database.sh

MIGRATION_VERSION=$1

# Backup current database
pg_dump -U postgres -d employee_db > /backup/before_rollback_$(date +%Y%m%d_%H%M%S).sql

# Rollback migrations
cd /opt/employee-system/backend
npx prisma migrate resolve --rolled-back $MIGRATION_VERSION

# Verify schema
psql -U postgres -d employee_db -c "\dt"

echo "Database rolled back to migration $MIGRATION_VERSION"
```

### Emergency Rollback Checklist

1. **Immediate Actions**
   - [ ] Notify team of rollback initiation
   - [ ] Stop affected services
   - [ ] Create backup of current state

2. **Rollback Execution**
   - [ ] Execute rollback script
   - [ ] Verify service restoration
   - [ ] Test critical functionality

3. **Post-Rollback**
   - [ ] Monitor system stability
   - [ ] Document rollback reason
   - [ ] Plan fix for original issue

## Deployment Checklist

### Pre-Deployment

- [ ] Code review completed
- [ ] Tests passing (unit, integration, e2e)
- [ ] Security scan completed
- [ ] Dependencies updated
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Team notified of deployment

### Deployment

- [ ] Backup current system
- [ ] Deploy to staging first
- [ ] Run smoke tests on staging
- [ ] Deploy to production (rolling/blue-green)
- [ ] Verify health checks
- [ ] Run production smoke tests
- [ ] Monitor metrics and logs

### Post-Deployment

- [ ] Verify all services healthy
- [ ] Check error rates
- [ ] Validate performance metrics
- [ ] User acceptance testing
- [ ] Update deployment log
- [ ] Archive deployment artifacts
- [ ] Schedule post-mortem (if issues)

---

*Last Updated: 2025-08-10*
*Version: 1.0.0*
*Deployment Guide Version: Production-Ready*