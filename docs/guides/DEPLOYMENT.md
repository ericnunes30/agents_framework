# Hybrid Agent Framework Deployment Guide

## Overview

This guide covers deploying the Hybrid Agent Framework in various environments: development, production, Docker, and cloud platforms.

## Quick Start

### Prerequisites

- Node.js 18+ 
- Redis 7+
- NPM or Yarn
- Environment variables configured

### Development Setup

```bash
# Clone and install
git clone <repository>
cd agentes_framework
npm install

# Start Redis (using Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

The server will start on http://localhost:3000 with hot-reload enabled.

### Production Setup

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Environment Configuration

### Required Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Keys (at least one required)
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Hybrid Server (enabled by default)
USE_HYBRID=true
```

### Optional Environment Variables

```bash
# CORS Configuration
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # requests per window

# TTL Configuration (seconds)
TTL_EXECUTIONS=3600          # 1 hour
TTL_CONFIGS=86400           # 24 hours
TTL_RESULTS=14400           # 4 hours
TTL_STATS=86400             # 1 day

# Logging
DEBUG=true
LOG_LEVEL=info

# MCP Configuration
MCP_SERVERS=filesystem,web_search
```

## Docker Deployment

### Using Docker Compose (Recommended)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  agent-framework:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - USE_HYBRID=true
    depends_on:
      - redis
    restart: unless-stopped
    volumes:
      - ./configs:/app/configs:ro
      - ./logs:/app/logs

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

Deploy:

```bash
# Create .env file with your API keys
echo "OPENAI_API_KEY=your_key" >> .env
echo "OPENROUTER_API_KEY=your_key" >> .env

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Custom Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
# Build image
docker build -t agent-framework:latest .

# Run container
docker run -d \
  --name agent-framework \
  -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e OPENAI_API_KEY=your_key \
  agent-framework:latest
```

## Cloud Deployment

### AWS ECS with Fargate

Create `task-definition.json`:

```json
{
  "family": "agent-framework",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "agent-framework",
      "image": "your-account.dkr.ecr.region.amazonaws.com/agent-framework:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "REDIS_URL", "value": "redis://your-elasticache-endpoint:6379"},
        {"name": "USE_HYBRID", "value": "true"}
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/agent-framework",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Google Cloud Run

Create `cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/agent-framework:$COMMIT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/agent-framework:$COMMIT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'agent-framework'
      - '--image'
      - 'gcr.io/$PROJECT_ID/agent-framework:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--set-env-vars'
      - 'NODE_ENV=production,USE_HYBRID=true'
      - '--set-secrets'
      - 'OPENAI_API_KEY=openai-key:latest'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--max-instances'
      - '10'
```

### Azure Container Instances

```bash
# Create resource group
az group create --name agent-framework-rg --location eastus

# Create container instance
az container create \
  --resource-group agent-framework-rg \
  --name agent-framework \
  --image your-registry/agent-framework:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3000 \
  --dns-name-label agent-framework-unique \
  --environment-variables \
    NODE_ENV=production \
    USE_HYBRID=true \
  --secure-environment-variables \
    OPENAI_API_KEY=your_key \
    REDIS_URL=redis://your-redis:6379
```

## Kubernetes Deployment

### Deployment Manifest

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-framework
  labels:
    app: agent-framework
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-framework
  template:
    metadata:
      labels:
        app: agent-framework
    spec:
      containers:
      - name: agent-framework
        image: agent-framework:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: USE_HYBRID
          value: "true"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: agent-framework-service
spec:
  selector:
    app: agent-framework
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer

---
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
data:
  openai-key: <base64-encoded-key>
  openrouter-key: <base64-encoded-key>
```

Deploy:

```bash
# Apply manifests
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get pods -l app=agent-framework
kubectl get service agent-framework-service

# View logs
kubectl logs -f deployment/agent-framework
```

## Redis Configuration

### Production Redis Setup

#### Option 1: Managed Redis (Recommended)

**AWS ElastiCache:**
```bash
# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id agent-framework-redis \
  --description "Redis for Agent Framework" \
  --num-cache-clusters 2 \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0
```

**Google Cloud Memorystore:**
```bash
gcloud redis instances create agent-framework-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

**Azure Cache for Redis:**
```bash
az redis create \
  --resource-group agent-framework-rg \
  --name agent-framework-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

#### Option 2: Self-Managed Redis

Docker Compose:
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --requirepass yourpassword
  volumes:
    - redis_data:/data
    - ./redis.conf:/usr/local/etc/redis/redis.conf
  ports:
    - "6379:6379"
  restart: unless-stopped
```

Redis Configuration (`redis.conf`):
```
# Memory optimization for production
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass yourpassword

# Networking
bind 0.0.0.0
protected-mode yes

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

## Monitoring and Logging

### Health Checks

The framework provides comprehensive health endpoints:

```bash
# Basic health check
curl http://localhost:3000/health

# System statistics
curl http://localhost:3000/api/system/stats

# Redis status
curl http://localhost:3000/api/system/redis
```

### Logging Configuration

Configure structured logging:

```bash
# Environment variables
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/app/logs/app.log
```

### Monitoring with Prometheus

Add metrics endpoint to your deployment:

```javascript
// Add to server configuration
import prometheus from 'prom-client';

// Create metrics registry
const register = new prometheus.Registry();

// Add default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Log Aggregation

**ELK Stack (Elasticsearch, Logstash, Kibana):**
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    labels: "service=agent-framework"
```

**Fluentd:**
```yaml
logging:
  driver: "fluentd"
  options:
    fluentd-address: "localhost:24224"
    tag: "agent-framework"
```

## Security Configuration

### Production Security Checklist

- [ ] Use environment variables for secrets
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Use HTTPS in production
- [ ] Configure Redis authentication
- [ ] Set up firewall rules
- [ ] Use container scanning
- [ ] Configure security headers

### HTTPS Configuration

**Using reverse proxy (Nginx):**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Scaling and Performance

### Horizontal Scaling

The hybrid architecture is designed for stateless scaling:

1. **Load Balancer**: Use sticky sessions for WebSocket connections
2. **Redis Cluster**: Configure Redis clustering for high availability
3. **Container Orchestration**: Use Kubernetes or Docker Swarm
4. **Auto-scaling**: Configure based on CPU/memory usage

### Performance Tuning

**Redis Optimization:**
```bash
# Memory optimization
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb

# Connection pooling
redis-cli CONFIG SET tcp-keepalive 60
redis-cli CONFIG SET timeout 300
```

**Node.js Optimization:**
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable clustering
NODE_ENV=production PM2_INSTANCES=max pm2 start dist/server/index.js
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server status
   - Verify connection string
   - Check firewall/security groups

2. **High Memory Usage**
   - Monitor Redis memory
   - Check TTL settings
   - Review execution patterns

3. **WebSocket Disconnections**
   - Check load balancer configuration
   - Verify heartbeat settings
   - Review network stability

4. **Rate Limiting Issues**
   - Adjust rate limit settings
   - Check client IP addresses
   - Review request patterns

### Debug Commands

```bash
# Check Redis keys
redis-cli KEYS "*"

# Monitor Redis operations
redis-cli MONITOR

# Check Redis memory usage
redis-cli INFO memory

# View active connections
redis-cli CLIENT LIST

# Check application logs
docker logs agent-framework

# Check resource usage
docker stats agent-framework
```

## Backup and Recovery

### Redis Backup

**Automated backup script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create Redis backup
redis-cli --host $REDIS_HOST --port $REDIS_PORT BGSAVE
sleep 10

# Copy RDB file
cp /var/lib/redis/dump.rdb $BACKUP_DIR/dump_$DATE.rdb

# Compress backup
gzip $BACKUP_DIR/dump_$DATE.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "dump_*.rdb.gz" -mtime +7 -delete
```

### Application Backup

**Configuration backup:**
```bash
#!/bin/bash
tar -czf configs_backup_$(date +%Y%m%d).tar.gz ./configs
aws s3 cp configs_backup_$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Daily**: Monitor logs and metrics
2. **Weekly**: Check Redis memory usage and cleanup
3. **Monthly**: Review and rotate logs
4. **Quarterly**: Update dependencies and security patches

### Monitoring Alerts

Set up alerts for:
- High memory usage (>80%)
- High CPU usage (>80%)  
- Redis connection failures
- Execution failures (>5% error rate)
- WebSocket disconnection rate

### Update Procedure

1. **Test Environment**: Deploy and test new version
2. **Database Migration**: Run any necessary migrations  
3. **Rolling Update**: Use blue-green or rolling deployment
4. **Health Check**: Verify all endpoints respond correctly
5. **Rollback Plan**: Have rollback procedure ready