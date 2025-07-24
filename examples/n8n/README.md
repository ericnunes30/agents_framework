# n8n Integration Examples

This directory contains examples for integrating the Agent Framework with n8n automation platform.

## Overview

The Agent Framework provides both HTTP REST APIs and WebSocket streaming capabilities that can be easily integrated with n8n workflows.

## Integration Methods

### 1. HTTP REST API Integration

Use the standard HTTP Request nodes in n8n to interact with the Agent Framework.

**Available Endpoints:**
- `POST /api/agents/execute` - Execute agent directly
- `GET /api/agents/status/:id` - Get execution status
- `GET /api/agents/results/:id` - Get execution results
- `POST /api/crews/execute` - Execute crew directly
- `GET /api/crews/status/:id` - Get execution status
- `GET /api/crews/results/:id` - Get execution results

### 2. WebSocket Streaming Integration

Use custom Code nodes to establish WebSocket connections for real-time execution monitoring.

## Examples

### HTTP Agent Execution (`http-agent-execution.json`)

A complete n8n workflow that:
1. Executes an agent via HTTP API
2. Polls for status updates
3. Retrieves results when completed
4. Includes retry logic with wait periods

**Import Instructions:**
1. Copy the JSON content
2. In n8n, go to "Import from URL or clipboard"
3. Paste the JSON and import
4. Update the Agent Framework URL if needed

### HTTP Crew Execution (`http-crew-execution.json`)

Similar to agent execution but for crew workflows:
1. Executes a crew with multiple agents
2. Monitors progress with longer timeout
3. Processes final results
4. Includes data transformation

### WebSocket Streaming (`websocket-streaming.js`)

A custom JavaScript code for real-time execution monitoring:
1. Establishes WebSocket connection
2. Starts execution via HTTP API
3. Subscribes to real-time updates
4. Returns results when completed

**Usage in n8n:**
1. Add a "Code" node to your workflow
2. Set mode to "Run Once for All Items"
3. Paste the JavaScript code
4. Provide input data with `configPath`, `task`, and `type` fields

## Configuration

### Environment Variables

Set these environment variables in your Agent Framework deployment:

```bash
# Agent Framework Configuration
REDIS_URL=redis://localhost:6379
PORT=3000
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# CORS Configuration for n8n
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:5678,https://your-n8n-instance.com
```

### n8n Configuration

If using n8n with authentication, create credentials:

1. Go to n8n Settings > Credentials
2. Create "Header Auth" credential
3. Add header: `Authorization: Bearer your-token`
4. Use this credential in HTTP Request nodes

## API Response Formats

### Execution Start Response
```json
{
  "executionId": "agent_12345",
  "status": "started"
}
```

### Status Response
```json
{
  "executionId": "agent_12345",
  "status": "running",
  "progress": 0.75,
  "currentStep": "processing",
  "startTime": "2025-01-24T10:00:00Z"
}
```

### Results Response
```json
{
  "executionId": "agent_12345",
  "result": "The agent's final output",
  "metadata": {
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Research AI trends",
    "tokensUsed": 1500
  },
  "executionTime": 45000,
  "completedAt": "2025-01-24T10:01:30Z"
}
```

## WebSocket Message Formats

### Subscribe to Execution
```json
{
  "id": "n8n-123",
  "type": "subscribe_execution",
  "data": {
    "executionId": "agent_12345",
    "type": "agent"
  }
}
```

### Progress Update
```json
{
  "type": "execution_progress",
  "data": {
    "executionId": "agent_12345",
    "status": "running",
    "progress": 0.5,
    "currentStep": "research",
    "timestamp": "2025-01-24T10:00:30Z"
  }
}
```

## Error Handling

### HTTP Errors
- `400` - Bad Request (invalid configuration or parameters)
- `404` - Not Found (execution or configuration not found)
- `429` - Rate Limited (too many requests)
- `500` - Internal Server Error

### WebSocket Errors
- Connection timeout after 5 minutes
- Invalid message format
- Subscription failures

## Best Practices

1. **Use HTTP for Simple Executions**: If you don't need real-time updates, HTTP polling is simpler
2. **Use WebSocket for Long-Running Tasks**: For crews or complex agents, WebSocket provides better UX
3. **Implement Timeouts**: Always set reasonable timeouts for executions
4. **Handle Errors Gracefully**: Include error handling and retry logic
5. **Cache Configurations**: Use the configuration caching API for repeated executions
6. **Monitor Rate Limits**: Be aware of rate limiting and implement backoff strategies

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check if Agent Framework is running on correct port
2. **CORS Errors**: Ensure CORS is configured for your n8n instance
3. **Authentication Errors**: Verify API keys and authentication headers
4. **Timeout Issues**: Increase timeout values for complex executions
5. **WebSocket Disconnections**: Implement reconnection logic

### Debug Tips

1. Enable logging in Agent Framework with `DEBUG=true`
2. Use n8n's execution log to see detailed request/response data
3. Test HTTP endpoints directly with curl or Postman first
4. Check Redis connectivity if using TTL-based features

## Support

For issues with n8n integration:
1. Check the Agent Framework logs
2. Verify configuration files exist and are valid
3. Test direct API calls outside of n8n
4. Check network connectivity between n8n and Agent Framework