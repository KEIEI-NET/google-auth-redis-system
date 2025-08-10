# Deployment Guide

This guide provides comprehensive instructions for deploying the Google Auth Employee System to production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **CPU**: Minimum 2 cores, recommended 4 cores
- **RAM**: Minimum 4GB, recommended 8GB
- **Storage**: Minimum 20GB SSD
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- SSL certificates (for production)

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/google-auth-employee-system.git
cd google-auth-employee-system
```

### 2. Configure Environment Variables
```bash
cp .env.production.example .env.production
nano .env.production
```

**Required Environment Variables:**
```env
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

# Security (generate secure random strings)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Database
POSTGRES_PASSWORD=$(openssl rand -base64 16)
DATABASE_PASSWORD=$(openssl rand -base64 16)

# Redis
REDIS_PASSWORD=$(openssl rand -base64 16)

# Monitoring
GRAFANA_PASSWORD=$(openssl rand -base64 16)
```

### 3. Generate Secure Secrets
```bash
# Generate all secrets automatically
./scripts/generate-secrets.sh >> .env.production
```

## Docker Deployment

### Quick Start
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy application
./scripts/deploy.sh
```

### Manual Deployment

#### 1. Build Images
```bash
docker-compose -f docker-compose.prod.yml build
```

#### 2. Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Run Migrations
```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

#### 4. Seed Database (Optional)
```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### Docker Swarm Deployment

#### 1. Initialize Swarm
```bash
docker swarm init --advertise-addr <your-server-ip>
```

#### 2. Create Secrets
```bash
echo "your-password" | docker secret create postgres_password -
echo "your-password" | docker secret create redis_password -
echo "your-jwt-secret" | docker secret create jwt_secret -
```

#### 3. Deploy Stack
```bash
docker stack deploy -c docker-compose.prod.yml google-auth
```

## Cloud Deployment

### AWS EC2 Deployment

#### 1. Launch EC2 Instance
- **Instance Type**: t3.medium or larger
- **AMI**: Ubuntu 20.04 LTS
- **Security Group**: Open ports 80, 443, 22

#### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 3. Deploy Application
```bash
# Clone repository
git clone https://github.com/yourusername/google-auth-employee-system.git
cd google-auth-employee-system

# Configure and deploy
cp .env.production.example .env.production
# Edit .env.production with your values
./scripts/deploy.sh
```

### Google Cloud Platform (GCP)

#### Using Cloud Run
```bash
# Build and push image to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/google-auth-backend

# Deploy to Cloud Run
gcloud run deploy google-auth-backend \
  --image gcr.io/PROJECT-ID/google-auth-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### Azure Container Instances

```bash
# Create resource group
az group create --name google-auth-rg --location eastus

# Create container instance
az container create \
  --resource-group google-auth-rg \
  --name google-auth-backend \
  --image yourdockerhub/google-auth-backend:latest \
  --ports 3000 \
  --environment-variables NODE_ENV=production
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

#### 1. Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

#### 2. Generate Certificates
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 3. Update Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ... rest of configuration
}
```

#### 4. Auto-renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab
0 0,12 * * * certbot renew --quiet
```

## Monitoring Setup

### 1. Access Grafana
- URL: `http://your-server:3002`
- Default credentials: admin / [GRAFANA_PASSWORD]

### 2. Import Dashboards
1. Navigate to Dashboards → Import
2. Upload JSON files from `monitoring/grafana/dashboards/`
3. Select Prometheus as data source

### 3. Configure Alerts
```yaml
# monitoring/alerts/alerts.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: High error rate detected
```

### 4. Setup Alert Channels
1. Go to Alerting → Notification channels
2. Add channel (Email, Slack, PagerDuty, etc.)
3. Configure alert rules to use the channel

## Backup and Recovery

### Automated Backups
```bash
# Setup daily backups via cron
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /path/to/google-auth-employee-system/scripts/backup.sh
```

### Manual Backup
```bash
./scripts/backup.sh
```

### Recovery Process

#### 1. Database Recovery
```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore database
gunzip < backup_20240101_020000.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres

# Start application
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Full System Recovery
```bash
# Extract application backup
tar -xzf google-auth-employee-system_app_20240101_020000.tar.gz

# Restore Docker volumes
docker volume create postgres_data
docker volume create redis_data

# Import data and start services
./scripts/deploy.sh
```

## Performance Optimization

### 1. Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_sessions_employee_id ON sessions(employee_id);
```

### 2. Redis Configuration
```redis
# Set max memory and eviction policy
CONFIG SET maxmemory 512mb
CONFIG SET maxmemory-policy allkeys-lru
```

### 3. Node.js Clustering
```javascript
// Enable PM2 clustering in production
module.exports = {
  apps: [{
    name: 'google-auth-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check container status
docker ps -a

# Verify environment variables
docker-compose -f docker-compose.prod.yml config
```

#### 2. Database Connection Issues
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec backend npx prisma db pull

# Reset database
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate reset
```

#### 3. Redis Connection Issues
```bash
# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Clear Redis cache
docker-compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL
```

### Health Checks
```bash
# Backend health
curl http://localhost:3000/health

# Frontend health
curl http://localhost/health

# Database health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Redis health
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Log Analysis
```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs

# Follow specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Export logs
docker-compose -f docker-compose.prod.yml logs > deployment.log
```

## Security Checklist

- [ ] All environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Database passwords changed from defaults
- [ ] JWT secrets are unique and secure
- [ ] CORS origins properly configured
- [ ] Rate limiting enabled
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented
- [ ] Security headers configured in Nginx
- [ ] Container images scanned for vulnerabilities
- [ ] Non-root users configured in containers

## Support

For issues or questions:
1. Check the [troubleshooting section](#troubleshooting)
2. Review logs: `docker-compose logs`
3. Open an issue on GitHub
4. Contact the development team

## License

This deployment guide is part of the Google Auth Employee System project.