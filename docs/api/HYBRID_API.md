# Hybrid Agent Framework API Documentation

## Overview

The Hybrid Agent Framework provides both REST API and WebSocket interfaces for managing and executing AI agents and crews. The system uses Redis for stateless operations with TTL-based storage and real-time updates via PubSub.

## Base URL

- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

## Authentication

Currently, the API uses basic rate limiting. Authentication can be added via middleware.

## HTTP REST API

### Health Check

#### GET /health

Check system health and Redis connectivity.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-24T10:00:00Z",
  "redis": {
    "connected": true,
    "keys": 145,
    "memory": "45MB",
    "connections": 3,
    "version": "7.0.11"
  },
  "health": {
    "redis": "connected",
    "mcp": "ready"
  }
}
```

### System Information

#### GET /api/system/stats

Get system statistics and performance metrics.

**Response:**
```json
{
  "activeExecutions": 5,
  "completedToday": 120,
  "totalExecutions": 1547,
  "redisMemory": "45MB",
  "uptime": 3600000,
  "connections": 8
}
```

#### GET /api/system/redis

Get detailed Redis information.

**Response:**
```json
{
  "connected": true,
  "keys": 145,
  "memory": "45MB",
  "connections": 3,
  "version": "7.0.11"
}
```

#### GET /api/system/executions/active

List all active executions.

**Response:**
```json
{
  "executions": ["agent_123", "crew_456"],
  "count": 2
}
```

### Agent Operations

#### POST /api/agents/execute

Execute an agent directly (stateless).

**Request Body:**
```json
{
  "configPath": "examples/agents/basic-agent.yaml",
  "task": "Research AI trends in 2025",
  "context": {
    "focus": "healthcare applications"
  },
  "options": {
    "streaming": false,
    "timeout": 60000,
    "ttl": 3600
  }
}
```

**Response:**
```json
{
  "executionId": "agent_abc123",
  "status": "started"
}
```

#### GET /api/agents/status/:executionId

Get execution status (Redis TTL: 1 hour).

**Response:**
```json
{
  "executionId": "agent_abc123",
  "status": "running",
  "progress": 0.75,
  "currentStep": "processing",
  "startTime": "2025-01-24T10:00:00Z",
  "metadata": {
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Research AI trends in 2025"
  }
}
```

#### GET /api/agents/results/:executionId

Get execution results (available after completion).

**Response:**
```json
{
  "executionId": "agent_abc123",
  "result": "Based on my research, here are the key AI trends for 2025...",
  "metadata": {
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Research AI trends in 2025",
    "tokensUsed": 1500
  },
  "executionTime": 45000,
  "completedAt": "2025-01-24T10:01:30Z"
}
```

#### GET /api/agents/active

List active agent executions.

**Response:**
```json
{
  "executions": ["agent_abc123", "agent_def456"]
}
```

### Crew Operations

#### POST /api/crews/execute

Execute a crew directly (stateless).

**Request Body:**
```json
{
  "configPath": "examples/crews/research-crew.yaml",
  "input": "Analyze healthcare AI market trends",
  "context": {
    "region": "North America",
    "timeframe": "2024-2025"
  },
  "options": {
    "streaming": true,
    "timeout": 120000,
    "maxIterations": 10
  }
}
```

**Response:**
```json
{
  "executionId": "crew_xyz789",
  "status": "started"
}
```

#### GET /api/crews/status/:executionId

Get crew execution status.

**Response:**
```json
{
  "executionId": "crew_xyz789",
  "status": "running",
  "progress": 0.4,
  "currentStep": "task_2",
  "startTime": "2025-01-24T10:00:00Z",
  "metadata": {
    "configPath": "examples/crews/research-crew.yaml",
    "input": "Analyze healthcare AI market trends"
  }
}
```

#### GET /api/crews/results/:executionId

Get crew execution results.

**Response:**
```json
{
  "executionId": "crew_xyz789",
  "result": {
    "finalReport": "Comprehensive analysis of healthcare AI...",
    "taskResults": [
      { "task": "research", "result": "..." },
      { "task": "analysis", "result": "..." }
    ]
  },
  "metadata": {
    "configPath": "examples/crews/research-crew.yaml",
    "input": "Analyze healthcare AI market trends",
    "tokensUsed": 3500
  },
  "executionTime": 180000,
  "completedAt": "2025-01-24T10:05:00Z"
}
```

#### GET /api/crews/active

List active crew executions.

**Response:**
```json
{
  "executions": ["crew_xyz789", "crew_abc123"]
}
```

### Configuration Management

#### GET /api/config/agents

List available agent configurations (cached for 1 hour).

**Response:**
```json
[
  {
    "id": "basic-agent",
    "name": "Basic Research Agent",
    "role": "researcher",
    "description": "A general-purpose research agent..."
  }
]
```

#### GET /api/config/crews

List available crew configurations (cached for 1 hour).

**Response:**
```json
[
  {
    "id": "research-crew",
    "name": "Research Crew",
    "process": "sequential",
    "agents": 3,
    "tasks": 5
  }
]
```

#### GET /api/config/agents/:configPath

Get specific agent configuration (cached for 24 hours).

#### GET /api/config/crews/:configPath

Get specific crew configuration (cached for 24 hours).

#### POST /api/config/validate

Validate a configuration file.

**Request Body:**
```json
{
  "type": "agent",
  "configPath": "examples/agents/basic-agent.yaml"
}
```

**Response:**
```json
{
  "valid": true,
  "config": { ... },
  "type": "agent"
}
```

### Tools Information

#### GET /api/tools

List all available tools (native and MCP).

**Response:**
```json
{
  "native": [
    { "name": "web_scraper", "type": "native" },
    { "name": "redis", "type": "native" }
  ],
  "mcp": [
    { "name": "filesystem", "type": "mcp", "serverId": "fs-server" }
  ],
  "total": 3
}
```

#### GET /api/tools/mcp/status

Get MCP server status and health.

**Response:**
```json
{
  "status": "running",
  "connections": 2,
  "connectedServers": ["fs-server", "web-server"],
  "health": [
    { "serverId": "fs-server", "status": "healthy" }
  ],
  "uptime": 3600
}
```

## WebSocket API

### Connection

Connect to `ws://localhost:3000/ws`

### Message Format

All WebSocket messages follow this format:

```json
{
  "id": "unique-request-id",
  "type": "message_type",
  "data": { ... },
  "timestamp": "2025-01-24T10:00:00Z"
}
```

### Message Types

#### Client → Server

**Subscribe to Execution:**
```json
{
  "id": "req-123",
  "type": "subscribe_execution",
  "data": {
    "executionId": "agent_abc123",
    "type": "agent"
  }
}
```

**Unsubscribe from Execution:**
```json
{
  "id": "req-124",
  "type": "unsubscribe_execution",
  "data": {
    "executionId": "agent_abc123"
  }
}
```

**Ping:**
```json
{
  "id": "req-125",
  "type": "ping",
  "data": {}
}
```

#### Server → Client

**Subscription Confirmed:**
```json
{
  "type": "subscription_confirmed",
  "data": {
    "executionId": "agent_abc123",
    "type": "agent",
    "message": "Subscribed to agent execution: agent_abc123"
  }
}
```

**Execution Progress:**
```json
{
  "type": "execution_progress",
  "data": {
    "executionId": "agent_abc123",
    "status": "running",
    "progress": 0.6,
    "currentStep": "analysis",
    "timestamp": "2025-01-24T10:00:30Z"
  }
}
```

**Execution Completed:**
```json
{
  "type": "execution_progress",
  "data": {
    "executionId": "agent_abc123",
    "status": "completed",
    "progress": 1.0,
    "result": "Final execution result...",
    "timestamp": "2025-01-24T10:01:00Z"
  }
}
```

**System Update:**
```json
{
  "type": "system_update",
  "data": {
    "message": "System maintenance in 5 minutes",
    "level": "warning"
  }
}
```

**Error:**
```json
{
  "type": "error",
  "data": {
    "message": "Invalid execution ID"
  }
}
```

**Pong:**
```json
{
  "type": "pong",
  "data": {
    "timestamp": "2025-01-24T10:00:00Z"
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found (execution/config not found)
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "configPath",
      "message": "Config path is required",
      "value": null
    }
  ],
  "timestamp": "2025-01-24T10:00:00Z"
}
```

## Rate Limiting

- **Default Limit**: 100 requests per 15 minutes per IP
- **Headers Returned**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time

## TTL (Time To Live) Configuration

- **Executions**: 1 hour (3600 seconds)
- **Configurations**: 24 hours (86400 seconds)
- **Results**: 4 hours (14400 seconds)
- **Statistics**: 1 day (86400 seconds)

## Redis Data Structure

### Execution Storage
```
executions:{executionId} = ExecutionStatus (TTL: 1h)
active_executions = Set<executionId> (TTL: 1h)
results:{executionId} = ExecutionResult (TTL: 4h)
```

### Configuration Cache
```
configs:{base64(configPath)} = Config (TTL: 24h)
config:agents:list = AgentList (TTL: 1h)
config:crews:list = CrewList (TTL: 1h)
```

### Statistics
```
stats:completed:{date} = count (TTL: 2 days)
system:cleanup_stats = CleanupInfo (TTL: 1 day)
```

## PubSub Channels

- `execution:{executionId}` - Execution-specific updates
- `executions:all` - All execution updates
- `agent:{agentId}` - Agent-specific updates
- `crew:{crewId}` - Crew-specific updates
- `system:updates` - System-wide updates

## Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# CORS Configuration
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000

# Hybrid Server Configuration
USE_HYBRID=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```