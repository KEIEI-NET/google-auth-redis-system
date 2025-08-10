# Deployment Guide - Google Authentication Employee Management System

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Database Deployment](#database-deployment)
5. [Application Deployment](#application-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Cloud Deployment](#cloud-deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Backup and Recovery](#backup-and-recovery)
11. [Troubleshooting](#troubleshooting)

## Overview

This guide provides comprehensive instructions for deploying the Google Authentication Employee Management System in various environments. The system consists of:

- **Frontend**: React TypeScript application
- **Backend**: Node.js Express API server
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session management
- **Authentication**: Google OAuth 2.0 with PKCE

### Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Load Balancer │────▶│   Web Server    │────▶│  Static Assets  │
│    (Nginx)      │     │   (Nginx)       │     │   (React App)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   API Gateway   │────▶│   API Server    │────▶│   PostgreSQL    │
│                 │     │   (Node.js)     │     │   Database      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                │
                                ▼
                        ┌─────────────────┐
                        │                 │
                        │     Redis        │
                        │   Session Store  │
                        │                 │
                        └─────────────────┘
```

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04 LTS or higher

#### Recommended Production Requirements
- **CPU**: 4 vCPUs
- **RAM**: 8GB
- **Storage**: 50GB SSD with automated backups
- **OS**: Ubuntu 22.04 LTS

### Software Dependencies

#### Required Software
```bash
# Node.js 18.x or higher
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get -y install postgresql-15

# Redis 7.x
sudo apt-get install redis-server

# Nginx
sudo apt-get install nginx

# PM2 (Process Manager)
sudo npm install -g pm2

# Git
sudo apt-get install git

# Build tools
sudo apt-get install build-essential
```

### Domain and SSL Setup

1. **Domain Configuration**
   - Point your domain to server IP
   - Configure A records for both www and non-www
   - Set up CAA records for SSL certificate

2. **SSL Certificate (Let's Encrypt)**
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Environment Setup

### 1. Create Deployment User
```bash
# Create deploy user
sudo adduser deploy

# Add to sudo group (if needed)
sudo usermod -aG sudo deploy

# Switch to deploy user
sudo su - deploy
```

### 2. Directory Structure
```bash
# Create application directories
mkdir -p /home/deploy/apps/employee-system
mkdir -p /home/deploy/apps/employee-system/backend
mkdir -p /home/deploy/apps/employee-system/frontend
mkdir -p /home/deploy/apps/employee-system/logs
mkdir -p /home/deploy/apps/employee-system/backups
```

### 3. Environment Variables

Create environment files for each environment:

#### Production Backend (.env.production)
```bash
# Server Configuration
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database Configuration
DATABASE_URL=postgresql://employee_user:strong_password@localhost:5432/employee_prod
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=strong_redis_password
REDIS_DB=0
REDIS_KEY_PREFIX=emp_prod_

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback

# JWT Configuration
JWT_SECRET=your-production-jwt-secret-minimum-32-characters
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
JWT_ISSUER=yourdomain.com
JWT_AUDIENCE=yourdomain.com

# Session Configuration
SESSION_SECRET=your-production-session-secret-minimum-32-characters
SESSION_EXPIRES_IN=24h
SESSION_NAME=emp_session

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
TRUSTED_PROXIES=1

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=/home/deploy/apps/employee-system/logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=30d

# Monitoring
SENTRY_DSN=your-sentry-dsn
METRICS_ENABLED=true
METRICS_PORT=9090

# Email Configuration (if needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=Employee System <noreply@yourdomain.com>
```

#### Production Frontend (.env.production)
```bash
# API Configuration
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_API_VERSION=v1

# Google OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_ERROR_REPORTING=true

# Monitoring
REACT_APP_SENTRY_DSN=your-frontend-sentry-dsn
```

### 4. Security Hardening

#### System Security
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5000/tcp  # API port (restrict to localhost in production)
sudo ufw enable

# Fail2ban for SSH protection
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### Application Security
```bash
# Set secure file permissions
chmod 600 /home/deploy/apps/employee-system/backend/.env.production
chmod 600 /home/deploy/apps/employee-system/frontend/.env.production

# Create security headers file for Nginx
cat > /etc/nginx/snippets/security-headers.conf << EOF
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com;" always;
EOF
```

## Database Deployment

### 1. PostgreSQL Setup

#### Create Production Database
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database user
CREATE USER employee_user WITH ENCRYPTED PASSWORD 'strong_password';

-- Create database
CREATE DATABASE employee_prod OWNER employee_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE employee_prod TO employee_user;

-- Enable extensions
\c employee_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Exit
\q
```

#### Configure PostgreSQL
```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf

# Add/modify these settings:
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 1310kB
min_wal_size = 1GB
max_wal_size = 4GB

# Edit pg_hba.conf for security
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add for local connections:
local   all             employee_user                   md5
host    all             employee_user   127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 2. Database Migration

```bash
cd /home/deploy/apps/employee-system/backend

# Install dependencies
npm install

# Run migrations
npm run db:migrate:prod

# Seed initial data (if needed)
npm run db:seed:prod
```

### 3. Database Backup Strategy

#### Automated Backup Script
```bash
#!/bin/bash
# /home/deploy/scripts/backup-database.sh

BACKUP_DIR="/home/deploy/apps/employee-system/backups"
DB_NAME="employee_prod"
DB_USER="employee_user"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/employee_backup_$DATE.sql.gz"

# Create backup
PGPASSWORD="strong_password" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "employee_backup_*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_FILE s3://your-backup-bucket/database/
```

#### Schedule Backup
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /home/deploy/scripts/backup-database.sh
```

## Application Deployment

### 1. Backend Deployment

#### Build and Deploy
```bash
cd /home/deploy/apps/employee-system/backend

# Install production dependencies
npm ci --production

# Build TypeScript
npm run build

# Copy environment file
cp .env.production .env

# Run database migrations
npm run db:migrate:prod
```

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'employee-api',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/home/deploy/apps/employee-system/logs/pm2-error.log',
    out_file: '/home/deploy/apps/employee-system/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

#### Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u deploy --hp /home/deploy
```

### 2. Frontend Deployment

#### Build Production Bundle
```bash
cd /home/deploy/apps/employee-system/frontend

# Install dependencies
npm ci

# Build for production
npm run build

# The build output will be in the 'build' directory
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/employee-system

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server block
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    include /etc/nginx/snippets/security-headers.conf;

    # Logging
    access_log /var/log/nginx/employee-system-access.log;
    error_log /var/log/nginx/employee-system-error.log;

    # Frontend root
    root /home/deploy/apps/employee-system/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
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
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
```

#### Enable Site
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/employee-system /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Docker Deployment

### 1. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: employee-postgres
    environment:
      POSTGRES_USER: employee_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: employee_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - employee-network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U employee_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: employee-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - employee-network
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: employee-backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://employee_user:${DB_PASSWORD}@postgres:5432/employee_prod
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - employee-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        REACT_APP_API_URL: ${API_URL}
        REACT_APP_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    container_name: employee-frontend
    depends_on:
      - backend
    networks:
      - employee-network
    restart: always

  nginx:
    image: nginx:alpine
    container_name: employee-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_cache:/var/cache/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - employee-network
    restart: always

volumes:
  postgres_data:
  redis_data:
  nginx_cache:

networks:
  employee-network:
    driver: bridge
```

### 2. Production Dockerfiles

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_CLIENT_ID

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Deploy with Docker

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate:prod
```

## Cloud Deployment

### AWS Deployment

#### 1. EC2 Setup
```bash
# Launch EC2 instance (Ubuntu 22.04 LTS)
# Security Group: Allow ports 22, 80, 443, 5000 (from ALB only)

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Follow the Environment Setup section above
```

#### 2. RDS PostgreSQL
```bash
# Create RDS instance
# Engine: PostgreSQL 15
# Instance class: db.t3.medium (or as needed)
# Storage: 100GB SSD
# Multi-AZ: Yes (for production)
# Backup retention: 7 days

# Update DATABASE_URL in .env.production
DATABASE_URL=postgresql://employee_user:password@your-rds-endpoint:5432/employee_prod
```

#### 3. ElastiCache Redis
```bash
# Create ElastiCache cluster
# Engine: Redis 7.x
# Node type: cache.t3.micro (or as needed)
# Number of replicas: 1 (for production)

# Update Redis configuration in .env.production
REDIS_HOST=your-elasticache-endpoint
```

#### 4. Application Load Balancer
```bash
# Create ALB
# Target Group: Port 5000 (backend)
# Health check: /health
# SSL Certificate: ACM certificate

# Update security groups
# ALB: Allow 80, 443 from anywhere
# EC2: Allow 5000 from ALB security group only
```

### Google Cloud Platform Deployment

#### 1. Compute Engine
```bash
# Create VM instance
gcloud compute instances create employee-system \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --tags=http-server,https-server

# SSH into instance
gcloud compute ssh employee-system
```

#### 2. Cloud SQL PostgreSQL
```bash
# Create Cloud SQL instance
gcloud sql instances create employee-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database and user
gcloud sql databases create employee_prod --instance=employee-postgres
gcloud sql users create employee_user --instance=employee-postgres
```

#### 3. Memorystore Redis
```bash
# Create Redis instance
gcloud redis instances create employee-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

### Azure Deployment

#### 1. Virtual Machine
```bash
# Create resource group
az group create --name employee-system-rg --location eastus

# Create VM
az vm create \
  --resource-group employee-system-rg \
  --name employee-vm \
  --image UbuntuLTS \
  --size Standard_B2s \
  --admin-username deploy \
  --generate-ssh-keys
```

#### 2. Azure Database for PostgreSQL
```bash
# Create PostgreSQL server
az postgres server create \
  --resource-group employee-system-rg \
  --name employee-postgres \
  --location eastus \
  --admin-user employee_admin \
  --admin-password 'Strong_Password_123' \
  --sku-name B_Gen5_1 \
  --version 15
```

#### 3. Azure Cache for Redis
```bash
# Create Redis cache
az redis create \
  --resource-group employee-system-rg \
  --name employee-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '18.x'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci
          
      - name: Run tests
        run: |
          npm run test
          
      - name: Run linting
        run: |
          npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Build backend
        run: |
          cd backend
          npm ci
          npm run build
          
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          REACT_APP_API_URL: ${{ secrets.PRODUCTION_API_URL }}
          REACT_APP_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            backend/dist
            frontend/build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /home/deploy/apps/employee-system
            git pull origin main
            
            # Backend deployment
            cd backend
            npm ci --production
            npm run db:migrate:prod
            pm2 reload employee-api
            
            # Frontend deployment
            cd ../frontend
            npm ci
            npm run build
            
            # Restart services
            sudo systemctl reload nginx
            
            # Health check
            curl -f http://localhost:5000/health || exit 1

  notify:
    needs: deploy
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"

cache:
  paths:
    - node_modules/
    - backend/node_modules/
    - frontend/node_modules/

test:
  stage: test
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run test
    - npm run lint
  only:
    - merge_requests
    - main

build:backend:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - cd backend
    - npm ci
    - npm run build
  artifacts:
    paths:
      - backend/dist
    expire_in: 1 week
  only:
    - main

build:frontend:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - cd frontend
    - npm ci
    - npm run build
  artifacts:
    paths:
      - frontend/build
    expire_in: 1 week
  only:
    - main

deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $PRODUCTION_USER@$PRODUCTION_HOST "
        cd /home/deploy/apps/employee-system &&
        git pull origin main &&
        cd backend &&
        npm ci --production &&
        npm run db:migrate:prod &&
        pm2 reload employee-api &&
        cd ../frontend &&
        npm ci &&
        npm run build &&
        sudo systemctl reload nginx
      "
  environment:
    name: production
    url: https://yourdomain.com
  only:
    - main
```

## Monitoring and Logging

### 1. Application Monitoring

#### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Process list
pm2 list

# View logs
pm2 logs employee-api

# Process details
pm2 show employee-api
```

#### Health Checks
```bash
# Create health check script
cat > /home/deploy/scripts/health-check.sh << 'EOF'
#!/bin/bash

# API health check
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)

if [ $API_HEALTH -ne 200 ]; then
    echo "API health check failed with status $API_HEALTH"
    # Send alert (email, Slack, etc.)
    # Restart service if needed
    pm2 restart employee-api
fi

# Database health check
DB_CHECK=$(PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost -d employee_prod -c "SELECT 1" -t)

if [ -z "$DB_CHECK" ]; then
    echo "Database health check failed"
    # Send alert
fi

# Redis health check
REDIS_CHECK=$(redis-cli -a $REDIS_PASSWORD ping)

if [ "$REDIS_CHECK" != "PONG" ]; then
    echo "Redis health check failed"
    # Send alert
fi
EOF

# Schedule health checks
crontab -e
# Add: */5 * * * * /home/deploy/scripts/health-check.sh
```

### 2. Log Management

#### Centralized Logging Structure
```bash
/home/deploy/apps/employee-system/logs/
├── access.log          # Nginx access logs
├── error.log           # Nginx error logs
├── api-access.log      # API access logs
├── api-error.log       # API error logs
├── api-debug.log       # API debug logs (dev only)
├── pm2-out.log         # PM2 stdout logs
├── pm2-error.log       # PM2 stderr logs
└── audit.log           # Security audit logs
```

#### Log Rotation
```bash
# /etc/logrotate.d/employee-system
/home/deploy/apps/employee-system/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        /usr/bin/killall -SIGUSR1 node
        pm2 reloadLogs
    endscript
}
```

### 3. Monitoring Stack

#### Prometheus + Grafana Setup
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: always

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    restart: always

  node_exporter:
    image: prom/node-exporter:latest
    container_name: node_exporter
    ports:
      - "9100:9100"
    restart: always

volumes:
  prometheus_data:
  grafana_data:
```

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'employee-api'
    static_configs:
      - targets: ['localhost:9091']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

### 4. Alerting

#### Alert Rules
```yaml
# prometheus/alerts.yml
groups:
  - name: employee-system
    rules:
      - alert: APIDown
        expr: up{job="employee-api"} == 0
        for: 5m
        annotations:
          summary: "API is down"
          description: "Employee API has been down for more than 5 minutes"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate"
          description: "Error rate is above 5%"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"

      - alert: DatabaseDown
        expr: pg_up == 0
        for: 1m
        annotations:
          summary: "PostgreSQL is down"
          description: "PostgreSQL database is not responding"
```

## Backup and Recovery

### 1. Backup Strategy

#### Automated Backup System
```bash
#!/bin/bash
# /home/deploy/scripts/backup-system.sh

set -e

# Configuration
BACKUP_DIR="/home/deploy/apps/employee-system/backups"
S3_BUCKET="s3://your-backup-bucket"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR/{database,files,configs}

# 1. Database backup
echo "Backing up database..."
PGPASSWORD=$DB_PASSWORD pg_dump -U employee_user -h localhost employee_prod | gzip > $BACKUP_DIR/database/employee_db_$DATE.sql.gz

# 2. Application files backup
echo "Backing up application files..."
tar -czf $BACKUP_DIR/files/app_files_$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.git' \
  /home/deploy/apps/employee-system

# 3. Configuration backup
echo "Backing up configurations..."
tar -czf $BACKUP_DIR/configs/configs_$DATE.tar.gz \
  /home/deploy/apps/employee-system/backend/.env.production \
  /home/deploy/apps/employee-system/frontend/.env.production \
  /etc/nginx/sites-available/employee-system \
  /home/deploy/.pm2/ecosystem.config.js

# 4. Redis backup (if persistent data)
echo "Backing up Redis..."
redis-cli -a $REDIS_PASSWORD --rdb $BACKUP_DIR/database/redis_$DATE.rdb

# 5. Upload to S3
echo "Uploading to S3..."
aws s3 sync $BACKUP_DIR $S3_BUCKET/employee-system/ --exclude "*" --include "*_$DATE*"

# 6. Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

# 7. Verify backups
echo "Verifying backups..."
if [ -f "$BACKUP_DIR/database/employee_db_$DATE.sql.gz" ]; then
    echo "Database backup successful"
else
    echo "Database backup failed!"
    exit 1
fi

echo "Backup completed successfully at $(date)"
```

### 2. Recovery Procedures

#### Database Recovery
```bash
#!/bin/bash
# /home/deploy/scripts/restore-database.sh

# Stop application
pm2 stop employee-api

# Restore from backup
BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore-database.sh <backup_file>"
    exit 1
fi

# Create temporary database
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost -c "CREATE DATABASE employee_restore;"

# Restore backup
gunzip < $BACKUP_FILE | PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_restore

# Verify restoration
VERIFY=$(PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_restore -c "SELECT COUNT(*) FROM employees;" -t)
if [ -z "$VERIFY" ]; then
    echo "Restoration verification failed"
    exit 1
fi

# Switch databases
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost <<EOF
ALTER DATABASE employee_prod RENAME TO employee_old;
ALTER DATABASE employee_restore RENAME TO employee_prod;
EOF

# Restart application
pm2 restart employee-api

echo "Database restored successfully"
```

#### Full System Recovery
```bash
#!/bin/bash
# /home/deploy/scripts/disaster-recovery.sh

# 1. Restore application files
tar -xzf /path/to/app_files_backup.tar.gz -C /

# 2. Restore configurations
tar -xzf /path/to/configs_backup.tar.gz -C /

# 3. Restore database
./restore-database.sh /path/to/database_backup.sql.gz

# 4. Restore Redis data
redis-cli -a $REDIS_PASSWORD --rdb /path/to/redis_backup.rdb

# 5. Install dependencies
cd /home/deploy/apps/employee-system/backend
npm ci --production

cd ../frontend
npm ci
npm run build

# 6. Restart services
pm2 restart all
sudo systemctl restart nginx
sudo systemctl restart redis
sudo systemctl restart postgresql

# 7. Verify services
./health-check.sh
```

### 3. Backup Testing

```bash
# Monthly backup test procedure
1. Create test environment
2. Restore latest backup
3. Verify data integrity
4. Test application functionality
5. Document any issues
6. Update recovery procedures
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start
```bash
# Check PM2 logs
pm2 logs employee-api --lines 100

# Check system resources
free -h
df -h
top

# Check port availability
sudo lsof -i :5000

# Verify environment variables
cd /home/deploy/apps/employee-system/backend
node -e "console.log(require('./dist/config/env').config)"

# Check database connection
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_prod -c "SELECT 1"

# Check Redis connection
redis-cli -a $REDIS_PASSWORD ping
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Test connection
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_prod

# Check connection pool
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_prod -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_prod -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'employee_prod' AND pid <> pg_backend_pid();"
```

#### 3. High Memory Usage
```bash
# Check memory usage by process
ps aux --sort=-%mem | head -20

# Check PM2 memory
pm2 monit

# Restart with memory limit
pm2 delete employee-api
pm2 start ecosystem.config.js --max-memory-restart 1G

# Clear Redis cache if needed
redis-cli -a $REDIS_PASSWORD FLUSHDB
```

#### 4. SSL Certificate Issues
```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check Nginx SSL configuration
sudo nginx -t
```

#### 5. Performance Issues
```bash
# Check slow queries (PostgreSQL)
PGPASSWORD=$DB_PASSWORD psql -U employee_user -h localhost employee_prod -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check Redis performance
redis-cli -a $REDIS_PASSWORD --latency

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5000/health

# Check disk I/O
iostat -x 1 10

# Check network connections
netstat -an | grep :5000 | wc -l
```

### Debug Mode

```bash
# Enable debug mode temporarily
export NODE_ENV=development
export DEBUG=*
pm2 restart employee-api

# View detailed logs
pm2 logs employee-api

# Disable debug mode
export NODE_ENV=production
unset DEBUG
pm2 restart employee-api
```

### Emergency Procedures

#### 1. Emergency Rollback
```bash
#!/bin/bash
# /home/deploy/scripts/emergency-rollback.sh

# Stop current deployment
pm2 stop all

# Checkout previous version
cd /home/deploy/apps/employee-system
git checkout HEAD~1

# Rebuild and restart
cd backend
npm ci --production
npm run build
pm2 restart employee-api

cd ../frontend
npm ci
npm run build

# Restart services
sudo systemctl reload nginx
```

#### 2. Emergency Maintenance Mode
```nginx
# /etc/nginx/sites-available/maintenance
server {
    listen 80;
    listen 443 ssl;
    server_name yourdomain.com;
    
    location / {
        return 503;
    }
    
    error_page 503 @maintenance;
    location @maintenance {
        root /usr/share/nginx/html;
        rewrite ^(.*)$ /maintenance.html break;
    }
}
```

```bash
# Enable maintenance mode
sudo ln -sf /etc/nginx/sites-available/maintenance /etc/nginx/sites-enabled/employee-system
sudo systemctl reload nginx

# Disable maintenance mode
sudo ln -sf /etc/nginx/sites-available/employee-system /etc/nginx/sites-enabled/employee-system
sudo systemctl reload nginx
```

---

Document Version: 1.0.0  
Last Updated: 2025-08-10  
Maintained by: DevOps Team