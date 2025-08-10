#!/bin/bash

# Production Deployment Script
# This script handles the deployment of the Google Auth Employee System

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="google-auth-employee-system"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose is installed"
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found"
        print_warning "Please copy .env.production.example to .env.production and configure it"
        exit 1
    fi
    print_success "Environment file found"
}

# Backup database
backup_database() {
    echo "Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Generate backup filename with timestamp
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Run backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "Database backed up to $BACKUP_FILE"
    else
        print_warning "Database backup failed or no existing database"
    fi
}

# Build images
build_images() {
    echo "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    print_success "Docker images built successfully"
}

# Deploy application
deploy() {
    echo "Deploying application..."
    
    # Stop existing containers
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start new containers
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_success "Application deployed successfully"
}

# Run database migrations
run_migrations() {
    echo "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run migrations
    docker-compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        print_success "Database migrations completed"
    else
        print_error "Database migrations failed"
        exit 1
    fi
}

# Health check
health_check() {
    echo "Performing health checks..."
    
    # Check backend health
    sleep 5
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
    fi
    
    # Check frontend health
    if curl -f http://localhost/health > /dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_warning "Frontend health check failed (might need more time to start)"
    fi
}

# Show logs
show_logs() {
    echo ""
    print_warning "Showing recent logs..."
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
}

# Main deployment process
main() {
    echo "========================================="
    echo "  $PROJECT_NAME Deployment"
    echo "========================================="
    echo ""
    
    # Parse command line arguments
    case "$1" in
        --skip-backup)
            SKIP_BACKUP=true
            ;;
        --skip-build)
            SKIP_BUILD=true
            ;;
        --rollback)
            ROLLBACK=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-backup    Skip database backup"
            echo "  --skip-build     Skip building Docker images"
            echo "  --rollback       Rollback to previous version"
            echo "  --help           Show this help message"
            exit 0
            ;;
    esac
    
    # Check prerequisites
    check_prerequisites
    
    # Backup database (unless skipped)
    if [ "$SKIP_BACKUP" != true ]; then
        backup_database
    fi
    
    # Build images (unless skipped)
    if [ "$SKIP_BUILD" != true ]; then
        build_images
    fi
    
    # Deploy application
    deploy
    
    # Run migrations
    run_migrations
    
    # Health check
    health_check
    
    echo ""
    echo "========================================="
    print_success "Deployment completed successfully!"
    echo "========================================="
    echo ""
    echo "Application URLs:"
    echo "  - Frontend: http://localhost"
    echo "  - Backend API: http://localhost:3000"
    echo "  - Grafana: http://localhost:3002"
    echo ""
    echo "To view logs, run:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f"
    echo ""
}

# Run main function
main "$@"