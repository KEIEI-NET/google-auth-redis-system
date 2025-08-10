#!/bin/bash

# Backup Script for Google Auth Employee System
# Creates backups of database and uploads to cloud storage

set -e

# Configuration
BACKUP_DIR="/tmp/backups"
PROJECT_NAME="google-auth-employee-system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    print_success "Backup directory created: $BACKUP_DIR"
}

# Backup PostgreSQL database
backup_postgres() {
    print_info "Starting PostgreSQL backup..."
    
    DB_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_db_${TIMESTAMP}.sql.gz"
    
    docker-compose -f docker-compose.prod.yml exec -T postgres pg_dumpall -U postgres | gzip > "$DB_BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "Database backed up to: $DB_BACKUP_FILE"
        echo "$DB_BACKUP_FILE"
    else
        print_error "Database backup failed"
        exit 1
    fi
}

# Backup Redis data
backup_redis() {
    print_info "Starting Redis backup..."
    
    REDIS_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_redis_${TIMESTAMP}.rdb"
    
    docker-compose -f docker-compose.prod.yml exec -T redis redis-cli --raw BGSAVE
    sleep 2
    docker cp google-auth-redis:/data/dump.rdb "$REDIS_BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "Redis backed up to: $REDIS_BACKUP_FILE"
        echo "$REDIS_BACKUP_FILE"
    else
        print_error "Redis backup failed"
    fi
}

# Backup application files
backup_application() {
    print_info "Starting application files backup..."
    
    APP_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_app_${TIMESTAMP}.tar.gz"
    
    tar -czf "$APP_BACKUP_FILE" \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=build \
        --exclude=.git \
        --exclude=logs \
        backend/ frontend/ prisma/ docker-compose.prod.yml
    
    if [ $? -eq 0 ]; then
        print_success "Application backed up to: $APP_BACKUP_FILE"
        echo "$APP_BACKUP_FILE"
    else
        print_error "Application backup failed"
        exit 1
    fi
}

# Upload to S3 (AWS)
upload_to_s3() {
    local FILE=$1
    local S3_BUCKET=${S3_BUCKET:-"your-backup-bucket"}
    local S3_PATH="backups/${PROJECT_NAME}/$(basename $FILE)"
    
    if command -v aws &> /dev/null; then
        print_info "Uploading to S3: $S3_PATH"
        aws s3 cp "$FILE" "s3://${S3_BUCKET}/${S3_PATH}" \
            --storage-class GLACIER_IR \
            --metadata "timestamp=${TIMESTAMP},project=${PROJECT_NAME}"
        
        if [ $? -eq 0 ]; then
            print_success "Uploaded to S3: $S3_PATH"
        else
            print_error "S3 upload failed"
        fi
    else
        print_info "AWS CLI not installed, skipping S3 upload"
    fi
}

# Clean old backups
clean_old_backups() {
    print_info "Cleaning backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -type f -name "${PROJECT_NAME}_*" -mtime +$RETENTION_DAYS -delete
    
    print_success "Old backups cleaned"
}

# Create backup manifest
create_manifest() {
    MANIFEST_FILE="$BACKUP_DIR/${PROJECT_NAME}_manifest_${TIMESTAMP}.json"
    
    cat > "$MANIFEST_FILE" <<EOF
{
    "project": "${PROJECT_NAME}",
    "timestamp": "${TIMESTAMP}",
    "date": "$(date -Iseconds)",
    "backups": {
        "database": "$(basename $1)",
        "redis": "$(basename $2)",
        "application": "$(basename $3)"
    },
    "retention_days": ${RETENTION_DAYS},
    "docker_images": $(docker images --format json | jq -s .)
}
EOF
    
    print_success "Manifest created: $MANIFEST_FILE"
    echo "$MANIFEST_FILE"
}

# Main backup process
main() {
    echo "========================================="
    echo "  Backup Process Started"
    echo "  $(date)"
    echo "========================================="
    echo ""
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    DB_BACKUP=$(backup_postgres)
    REDIS_BACKUP=$(backup_redis)
    APP_BACKUP=$(backup_application)
    
    # Create manifest
    MANIFEST=$(create_manifest "$DB_BACKUP" "$REDIS_BACKUP" "$APP_BACKUP")
    
    # Upload to cloud storage
    if [ "${UPLOAD_TO_CLOUD}" = "true" ]; then
        upload_to_s3 "$DB_BACKUP"
        upload_to_s3 "$REDIS_BACKUP"
        upload_to_s3 "$APP_BACKUP"
        upload_to_s3 "$MANIFEST"
    fi
    
    # Clean old backups
    clean_old_backups
    
    echo ""
    echo "========================================="
    print_success "Backup completed successfully!"
    echo "========================================="
    echo ""
    echo "Backup files:"
    echo "  - Database: $DB_BACKUP"
    echo "  - Redis: $REDIS_BACKUP"
    echo "  - Application: $APP_BACKUP"
    echo "  - Manifest: $MANIFEST"
    echo ""
}

# Run main function
main